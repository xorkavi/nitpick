---
name: nitpick-fix
description: "Fetch a Nitpick-filed DevRev issue and fix it in the current repo using the captured metadata"
argument-hint: "<issue-display-id or DevRev link> e.g. ISS-1234 or https://app.devrev.ai/foo/works/ISS-1234"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Agent
  - WebFetch
  - AskUserQuestion
---

<objective>
Fetch a DevRev issue by display ID or work item link, parse the Nitpick-captured metadata (title, AI-generated description, screenshots, element DOM path, CSS properties, page URL), and use it to locate and fix the bug in the current repository.
</objective>

<process>

## 1. Validate input

The user must provide either:
- An issue display ID (e.g. `ISS-1234`)
- A DevRev work item link (e.g. `https://app.devrev.ai/org-slug/works/ISS-1234`)

If a link is provided, extract the display ID from the last path segment (the part matching `[A-Z]+-\d+`).

If neither is provided, ask for it.

## 2. Resolve DevRev PAT

Check for the PAT in this order:
1. Environment variable `DEVREV_PAT`
2. `.env` file in the project root — read it with: `source .env 2>/dev/null`
3. If not found, ask the user to set it in `.env`: `DEVREV_PAT=your-pat-here`

**IMPORTANT**: This PAT is for the **prod** environment (`api.devrev.ai`). Always use the prod base URL.

## 3. Fetch the issue

```bash
source .env 2>/dev/null
curl -s -X GET "https://api.devrev.ai/works.get?id=<DISPLAY_ID>" \
  -H "Authorization: $DEVREV_PAT" \
  | jq '{work: .work | {title, body, display_id, priority, priority_v2, tags, artifacts, applies_to_part, owned_by, reported_by}}'
```

## 4. Parse the issue body

Extract: title, body (AI description + screenshots + DOM context + page URL), priority, tags, artifacts, part, owner.

**Cross-check the captured element** before searching code:
- Compare element classes/state with the title. If they don't match, the capture likely hit the wrong element.
- Compare detail screenshot vs viewport screenshot. Is the highlighted element the one with the bug?
- Check `data-state` and `data-feedback` attributes for component state.
- On mismatch: don't trust DOM path. Use React component chain or visible text content instead.

## 5. Extract screenshots

Parse inline images from body: `!\[([^\]]*)\]\((https?://[^)]+)\)`

Download with `-L` flag (DevRev 303-redirects to S3):
```bash
curl -s -L -o /tmp/viewport-screenshot.png -H "Authorization: $DEVREV_PAT" "<url>"
file /tmp/viewport-screenshot.png  # verify it's PNG, not JSON error
```

Also check the `artifacts` array for older-format screenshots.

## 6. Determine target repo

Extract page URL from Environment table. Map domain to repo:
```
app.devrev.ai / app.dev.devrev-eng.ai / support.devrev.ai → devrev-web
devrev.ai / developer.devrev.ai → devrev-marketing
```

If the target repo is **devrev-web**, read [devrev-web-reference.md](devrev-web-reference.md) for codebase-specific guidance (monorepo structure, theme architecture, URL→feature mapping, DRID resolution, DS bug patterns).

## 7. Resolve runtime identifiers

Before grepping `data-drid` values, check if they're runtime-generated (segmented with `--` separators). If so, grep the base segment to find the tracker file, then trace the constant to its JSX usage.

## 8. Fast-path: strong identifiers

Check description for one-grep-to-source identifiers (stop at first match):

1. **React component chain** — e.g. `Input → EditableInput → AddNewTask`. Each name maps to a file.
2. **data-drid / data-testid** — after resolving runtime drids
3. **CSS source classes** — e.g. `background-color: class input-bg-idle`. The class name leads to the theme config or component file.
4. **Constraining Tailwind class** — e.g. `max-w-32`, `px-core-base` (ignore `overflow-hidden`, `truncate`)

For React names: `glob "**/<ComponentName>*"`. For classes: grep in the directory narrowed by page URL route.

## 9. Full search (fallback)

Search in priority order — stop at first match:
1. React component chain (selected element first, then context)
2. data-drid / data-testid (resolve runtime drids first)
3. CSS source classes (grep in theme configs or Tailwind config)
4. Tailwind utility classes (in route directory)
5. Ancestor layout styles (for spacing/padding bugs)
6. Custom/semantic class names
7. Page URL → route mapping
8. CSS property values (last resort)

## 10. Trace classes to their source

The class may not be in the component file — it could come from a design system theme config.

1. **In the JSX?** → fix there. Done.
2. **Not in JSX?** → find `useTheme('key', ...)` in the component → look up the theme config → find the slot → fix the class in the config.
3. **Decide fix location:** Theme config (affects all consumers) vs component override (specific usage) vs consumer (wrong prop).

For color bugs: trace the CSS variable chain (Tailwind class → config → CSS var → palette var).

## 11. DS bug vs local bug

Determine where the bug lives before fixing:
- `useTheme(...)` in the component? → likely theme config problem
- Hardcoded classes? → local/consumer problem
- Bug on multiple pages? → DS layer. One page only? → consumer.
- Check consumer count for DS fixes: `grep -r "<ComponentName" libs/ apps/ --include="*.tsx" -l | wc -l` — if >10, flag to user.

## 12. Present fix options to the user

After completing your analysis (steps 6–11) but BEFORE editing any source file, you MUST pause and present your findings to the user using `AskUserQuestion`. This is not optional.

### What to present

Summarize your analysis as context in the question text:
1. **What the problem is** — one sentence restating the bug in terms of the code you found (not just the issue title).
2. **Where it lives** — the file(s), line(s), and the current value/class/token causing the issue.
3. **The candidate fixes** — each option as a concrete code change the user can evaluate.

### How to build the options

Gather candidate values/approaches from the codebase:
- Grep for design system tokens, CSS variables, Tailwind config values, or theme config entries that are plausible replacements.
- Check what sibling or related elements use for the same property (for consistency).
- If the fix could go in different files (theme config vs component vs consumer), each location is a separate option.

Present 2–4 options using `AskUserQuestion`. Use the `preview` field to show the actual code diff for each option so the user can compare at a glance.

### Example

Issue says: "spacing between items is too tight in the sidebar nav"

After analysis you find the gap is set to `gap-1` in `SidebarNav.tsx:42` and the design system has `gap-1.5`, `gap-2`, and `gap-3` as tokens used elsewhere in similar nav components.

→ Ask with question text:
"The sidebar nav items in `SidebarNav.tsx:42` use `gap-1` (4px). Similar nav components in the app use `gap-2`. Which spacing should we use?"

→ Options with previews showing the line change for `gap-1.5`, `gap-2` (Recommended), `gap-3`.

### When NOT to ask
Only skip this step when ALL of these are true:
- The issue explicitly states the exact target value (e.g. "change to 8px", "should use rounded-full")
- There is exactly one file/location where the fix applies
- The fix is a direct value swap with zero ambiguity

## 13. Fix the bug

1. Read the relevant file(s)
2. If DS-layer fix, check consumer count and flag if broad
3. Apply the fix the user chose (or the only reasonable fix)
4. Type-check if applicable

Do NOT commit unless the user asks.

## 14. Report

Summarize: what the issue described, which files changed, what the fix was, caveats to verify visually.

## 15. Fix didn't work — retry protocol

If the user says the fix didn't work (possibly with a new screenshot):

1. **Review your diff** — `git diff` or `git log -1 -p`
2. **Classify the failure:**
   - **No effect** → wrong file, wrong theme, wrong selector, or overridden by higher specificity
   - **Partial effect** → right file, wrong property or value
   - **Wrong element** → element capture was misleading
   - **Right fix, wrong layer** → changed consumer but bug is in theme config (or vice versa)
3. **Lock what you tried** — write it down: "Changed X in file Y — did NOT fix it"
4. **Widen based on failure type:**
   - No effect → check both themes (devrev + arcade), check `.module.scss` overrides, check portal rendering
   - Partial → re-examine screenshot for different property, check compound variant states
   - Wrong element → ignore DOM path, use viewport screenshot + visible text only
   - Wrong layer → if fixed theme but consumer overrides it, or vice versa; if fixed devrev theme but arcade is active

</process>

<guidelines>
- Screenshots are the most valuable context. Always download and view them first.
- The current repo may not be where the bug exists. Check the page URL.
- Prefer minimal fixes. Don't refactor surrounding code.
- Trust the raw "Code identifiers" section over the AI-generated analysis — it comes directly from the DOM.
- If the description is too vague to act on, say so — that feedback improves the plugin.
- If multiple interpretations are possible, state your assumptions before fixing.
</guidelines>
