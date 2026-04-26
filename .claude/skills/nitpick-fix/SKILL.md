---
name: nitpick-fix
description: "Fetch a Nitpick-filed DevRev issue and fix it in the current repo using the captured metadata"
argument-hint: "<issue-display-id> e.g. ISS-1234"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Agent
  - WebFetch
---

<objective>
Fetch a DevRev issue by display ID, parse the Nitpick-captured metadata (title, AI-generated description, screenshots, element DOM path, CSS properties, page URL), and use it to locate and fix the bug in the current repository.
</objective>

<process>

## 1. Validate input

The user must provide an issue display ID (e.g. `ISS-1234`). If missing, ask for it.

## 2. Resolve DevRev PAT

Check for the PAT in this order:
1. Environment variable `DEVREV_PAT`
2. `.env` file in the project root — read it with: `source .env 2>/dev/null`
3. If not found, ask the user to set it in `.env`: `DEVREV_PAT=your-pat-here`

**IMPORTANT**: This PAT is for the **dev** environment (`api.dev.devrev-eng.ai`), not prod. Always use the dev base URL.

## 3. Fetch the issue

Use `GET /works.get` with the display ID directly — no need to search or list:

```bash
source .env 2>/dev/null
curl -s -X GET "https://api.dev.devrev-eng.ai/works.get?id=<DISPLAY_ID>" \
  -H "Authorization: $DEVREV_PAT"
```

The `id` parameter accepts display IDs like `ISS-69076` directly. This returns a single `work` object with all fields.

## 4. Parse the issue

Extract these fields from `response.work`:
- **title** — the bug summary
- **body** — the AI-generated description (contains inline screenshots, CSS properties, DOM context, page URL)
- **priority** / **priority_v2** — severity level (p0-p3, with color and label)
- **tags** — array of `{ tag: { name, id, style_new } }` objects
- **artifacts** — array of attached files (older issues store screenshots here)
- **applies_to_part** — the part/enhancement the issue is filed against
- **owned_by** / **reported_by** — user assignments

## 5. Extract screenshots

Screenshots can appear in **two places** depending on the Nitpick version:

### Inline images (current format)
The `body` field contains markdown images with authenticated download URLs:
```
![viewport-screenshot.png](https://api.dev.devrev-eng.ai/internal/artifacts.download?id=...&key=...)
![detail-screenshot.png](https://api.dev.devrev-eng.ai/internal/artifacts.download?id=...&key=...)
```

Parse these with a regex like `!\[([^\]]*)\]\((https?://[^)]+)\)` to extract image name and URL.

To download the images for viewing, use curl with **`-L`** (the DevRev API returns a 303 redirect to S3 — without `-L`, curl saves the redirect JSON body instead of the actual image):
```bash
curl -s -L -o /tmp/viewport-screenshot.png \
  -H "Authorization: $DEVREV_PAT" \
  "<artifact_download_url>"
```

Verify the download is a real image (not a JSON error):
```bash
file /tmp/viewport-screenshot.png
# Should say "PNG image data" — if it says "JSON" or "ASCII text", the download failed
```

### Artifacts array (older format)
Older issues store screenshots in the `artifacts` array with `file.name` like `viewport-screenshot.png` and `detail-screenshot.png`. The artifact ID can be used to construct a download URL:
```
https://api.dev.devrev-eng.ai/internal/artifacts.download?id=<artifact_id>
```

**Always check both locations.** Download the screenshots to `/tmp/` so you can view them for context. **Always use `-L` flag** — all artifact download URLs 303-redirect to S3.

## 6. Determine target repo (do this IN PARALLEL with screenshot downloads)

Extract the Page URL from the Environment table immediately. This tells you which repo the bug lives in. **Do this BEFORE any code search.**

### Step 1: Check if the current repo is the target

If the page URL's domain matches the current working directory's purpose, just proceed — the developer is already in the right place.

### Step 2: Domain → repo mapping

```
app.devrev.ai              → devrev-web
app.dev.devrev-eng.ai      → devrev-web
app.qa.devrev-eng.ai       → devrev-web
support.devrev.ai          → devrev-web
support.dev.devrev-eng.ai  → devrev-web

devrev.ai                  → devrev-marketing
developer.devrev.ai        → devrev-marketing
```

### Step 3: Locate the repo on disk

If the current directory IS the target repo, skip this step.

If not, search for it:
```bash
find /Users -maxdepth 5 -type d -name "*devrev-web*" 2>/dev/null
```

- If **one result** → use it.
- If **multiple results** → show all options to the developer and ask which one to use.
- If **no results** → ask the developer for the repo location.

**Always confirm with the developer before searching in a different repo.** Don't silently switch repos.

## 7. Fast-path: check for strong identifiers

Before doing any broad search, check if the description contains any of these one-grep-to-source identifiers:

1. **data-drid** or **data-testid** value
2. **React component name** — on the element OR any ancestor (ancestor names like `ChatMembersTitle` are equally valuable)
3. **Constraining Tailwind class** — e.g. `max-w-32`, `truncate`, `line-clamp-2`

**If any of these exist → skip to the fast path:**
```
grep -r "identifier" <target-repo-path> → read the file → fix → done
```

For React component names, also try: `glob "**/<ComponentName>*"` in the target repo.

For Tailwind classes, grep in the directory narrowed by the page URL route.

Only continue to step 8 if NO strong identifiers are found in the description.

## 8. Full search (fallback)

If no strong identifiers exist, search in **strict priority order** — stop as soon as you get a match:

1. **data-drid / data-testid** — from element AND ancestors. One grep finds the exact component.
2. **React component name** — from element AND ancestors. Ancestor names (e.g. `ChatMembersTitle`, `RecipientDisplay`) often map more directly to filenames than the clicked element's generic `<div>`.
3. **Tailwind utility classes** — constraining classes like `max-w-32`, `truncate` are directly greppable in source. Grep within the route directory.
4. **Custom/semantic class names** — Non-utility classes (skip `flex`, `items-center`, etc.).
5. **Page URL → route mapping** — Narrows search to a directory.
6. **CSS property values** — Last resort, most ambiguous.

Use Grep and Glob aggressively. Spawn an Explore agent if the search space is large.

**Design system defaults**: If the description mentions a size/variant mismatch, check the component's default props in the design system — the element may not have an explicit prop and is relying on a default.

## 9. Fix the bug

Once the source is located:
1. Read the relevant file(s)
2. Understand the current implementation
3. Apply the fix based on the description
4. Verify the fix makes sense (type-check if applicable)

## 10. Report

Summarize:
- What the issue described
- Which file(s) were changed
- What the fix was
- Any caveats or things to verify visually

Do NOT commit unless the user asks. Present the changes for review.

</process>

<guidelines>
- The description quality varies. If the description is too vague to act on, say so explicitly — that feedback helps improve the Nitpick AI prompt.
- Screenshots are the most valuable context. Always download and view them before attempting a fix.
- The current repo may not be the repo where the bug exists. Check the page URL in the description to confirm it matches the current codebase.
- Prefer minimal fixes. Don't refactor surrounding code.
- If multiple interpretations of the bug are possible, state your assumptions before fixing.
- The description has two layers of code identifiers: (1) AI-generated in the "Code identifiers" section, and (2) auto-captured in the "Raw code identifiers" section at the bottom. Trust the raw section — it comes directly from the DOM, not from AI interpretation.
</guidelines>
