---
name: nitpick-fix
description: "Fetch a Nitpick-filed DevRev issue and fix it in the current repo using the captured metadata"
argument-hint: "<issue-display-id> e.g. ISS-1234"
model: sonnet
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

**IMPORTANT**: This PAT is for the **prod** environment (`api.devrev.ai`). Always use the prod base URL.

## 3. Fetch the issue

Use `GET /works.get` with the display ID directly — no need to search or list:

```bash
source .env 2>/dev/null
curl -s -X GET "https://api.devrev.ai/works.get?id=<DISPLAY_ID>" \
  -H "Authorization: $DEVREV_PAT" \
  | jq '{work: .work | {title, body, display_id, priority, priority_v2, tags, artifacts, applies_to_part, owned_by, reported_by}}'
```

The `id` parameter accepts display IDs like `ISS-69076` directly. The `jq` filter strips `custom_fields` and other bulk data that wastes context tokens — only bug-relevant fields are kept.

## 4. Parse the issue

Extract these fields from `response.work`:
- **title** — the bug summary
- **body** — the AI-generated description (contains inline screenshots, CSS properties, DOM context, page URL)
- **priority** / **priority_v2** — severity level (p0-p3, with color and label)
- **tags** — array of `{ tag: { name, id, style_new } }` objects
- **artifacts** — array of attached files (older issues store screenshots here)
- **applies_to_part** — the part/enhancement the issue is filed against
- **owned_by** / **reported_by** — user assignments

## 4b. Cross-check captured element vs. bug description

Before searching code, verify that the captured DOM element matches what the bug description is actually about:

1. Compare the element's CSS classes/state with the title and description. Example: if the title says "inline edit" but the element class says "not-inline-editing", the capture likely hit the wrong element.
2. Compare the detail screenshot with the viewport screenshot. Is the highlighted element actually the one exhibiting the bug?
3. If there's a mismatch, don't trust the DOM path. Use the React component chain, visible text content, or page URL route to search more broadly for the actual target component.

## 5. Extract screenshots

Screenshots can appear in **two places** depending on the Nitpick version:

### Inline images (current format)
The `body` field contains markdown images with authenticated download URLs:
```
![viewport-screenshot.png](https://api.devrev.ai/internal/artifacts.download?id=...&key=...)
![detail-screenshot.png](https://api.devrev.ai/internal/artifacts.download?id=...&key=...)
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
https://api.devrev.ai/internal/artifacts.download?id=<artifact_id>
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

## 7. Resolve runtime identifiers

Before grepping any `data-drid` values, check if they are **runtime-generated**. Many repos construct drids from utility functions like `proxyDrids()`, `joinDrids()`, or similar builders.

**How to tell:** If the drid looks segmented (e.g. `computer--left-nav--container`), it's likely built at runtime from a constant. Grepping the full literal will return 0 results.

**What to do instead:**
1. Search for a drid utility: `grep -r "proxyDrid\|joinDrid\|buildDrid" <target-repo-path>`
2. If found, grep for the **last segment** (e.g. `container`) scoped to files near the utility
3. Use the constant name to find usage in the component

Only grep the literal drid value if no builder utility exists in the repo.

## 8. Fast-path: check for strong identifiers

Before doing any broad search, check if the description contains any of these one-grep-to-source identifiers:

1. **React component chain** — the description may contain a full fiber chain like `Input → EditableInput → AddNewTask`. This is the single most valuable identifier. Prioritize names from the **selected element's chain** over ancestor/child context names. Each name in the chain maps to a source file.
2. **data-drid** or **data-testid** value (after resolving per step 7)
3. **Constraining Tailwind class** — e.g. `max-w-32`, `px-core-base`, `line-clamp-2` (ignore ultra-common ones like `overflow-hidden`)

**If any of these exist → skip to the fast path:**
```
grep -r "identifier" <target-repo-path> → read the file → fix → done
```

For React component names, also try: `glob "**/<ComponentName>*"` in the target repo. Work outward through the chain — the first name is closest to the DOM element, the last is the outermost wrapper.

For Tailwind classes, grep in the directory narrowed by the page URL route.

Only continue to step 9 if NO strong identifiers are found in the description.

## 9. Full search (fallback)

If no strong identifiers exist, search in **strict priority order** — stop as soon as you get a match:

1. **React component chain** — from the selected element's chain first, then ancestor/child context. Names from the selected element's own fiber chain (e.g. `Input → EditableInput → AddNewTask`) are more reliable than names from sibling or child elements.
2. **data-drid / data-testid** — from element AND ancestors. Resolve runtime drids first (step 7).
3. **Tailwind utility classes** — specific classes like `px-core-base`, `max-w-32` are directly greppable in source. Skip ultra-common ones (`overflow-hidden`, `truncate`). Grep within the route directory.
4. **Ancestor layout styles** — If the bug is about spacing/padding, check the "Ancestors with layout styles" section. The parent's padding/margin classes (e.g. `p-2`, `px-core-base`) are often the fix target, not the element itself.
5. **Custom/semantic class names** — Non-utility classes (skip `flex`, `items-center`, etc.).
6. **Page URL → route mapping** — Narrows search to a directory.
7. **CSS property values** — Last resort, most ambiguous.

Use Grep and Glob aggressively. Spawn an Explore agent if the search space is large.

**Design system defaults**: If the description mentions a size/variant mismatch, check the component's default props in the design system — the element may not have an explicit prop and is relying on a default.

## 10. Identify the styling system — trace classes to their source

The Tailwind class causing the bug may NOT be in the component file. It could come from a design system theme config. **Always trace before fixing.**

### Step 1: Grep the class in the component file

If the class (e.g. `h-6`, `p-1`, `rounded-md`) appears literally in the component JSX → fix it there. Done.

### Step 2: If the class is NOT in the component file → trace the DS theme

This is the common case for DS components. The class comes from a theme config, not the JSX. Follow this traceback:

1. **Find the theme import:** Look for `useTheme('componentName', ...)` or `createThemeConfig('componentName', ...)` in the component file. The first argument (e.g. `'tabItem'`, `'tabList'`, `'button'`) is the theme key.
2. **Find the theme config:** Grep for `ThemeProviderProps['<themeKey>']` or look in `libs/design-system/shared/themes/devrev-app-theme/src/components/<component-name>.ts`. This file defines all the Tailwind classes for that component.
3. **Find the slot:** Theme configs have named slots (e.g. `root`, `listWrapper`, `itemBackground`). Each slot has a `className` string and optional `variants`/`compoundVariants`. Match the DOM classes to the right slot — that's where the bug lives.
4. **Check the math:** For layout bugs, verify that the slot's classes are geometrically consistent with parent/sibling slots. Example: if a parent slot has `p-1` (4px padding each side) and a child slot has `h-6` (24px), but the parent is only 28px tall, the child overflows (28 - 8 = 20px available, 24px needed). This arithmetic is often the root cause.

### Step 3: Decide where to fix

- **Theme config** — if the class is wrong for ALL usages of this component (e.g. `h-6` should be `h-5` everywhere)
- **Component JSX override** — if only this specific usage needs a different value (pass a className prop)
- **Consumer override** — if the DS component is correct but the consumer is using the wrong variant/size

### Fallback: other styling systems

- **`cva()` / `tv()`** — variant utilities that compose classes. Grep for the variant key.
- **CSS-in-JS / styled-components** — styles in template literals or style objects.
- **CSS Modules / SCSS** — `.module.scss` files alongside the component (check for these in the DS theme directory too).

## 11. Fix the bug

Once the source is located:
1. Read the relevant file(s)
2. Understand the current implementation
3. Apply the fix based on the description
4. Verify the fix makes sense (type-check if applicable)

## 12. Report

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
