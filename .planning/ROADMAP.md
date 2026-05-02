# Roadmap: Nitpick

## Milestones

- v1.0 Chrome Extension MVP - Phases 1-3 (shipped 2026-04-25)
- v2.0 Cloud Fix Pipeline - Phases 4-7 (in progress)

## Phases

<details>
<summary>v1.0 Chrome Extension MVP (Phases 1-3) - SHIPPED 2026-04-25</summary>

- [x] **Phase 1: Extension Shell & Element Picker** - Working Chrome extension with hover-highlight, click-select, area-drag, and element inspection on any page
- [x] **Phase 2: Capture, AI Analysis & Issue Creation** - Full pipeline from screenshot capture through AI-enriched description to DevRev issue submission
- [x] **Phase 3: Shortcuts & UI Fit-and-Finish** - Keyboard activation and Arcade design system integration across all UI surfaces

</details>

### v2.0 Cloud Fix Pipeline (Revised 2026-05-03)

Architecture pivot: Claude Code CLI via Bedrock on CircleCI (following devrev/mobius prior art), NOT custom Claude API + GitHub Actions + Supabase. See [04-CONTEXT.md](phases/04-foundation-agent-core/04-CONTEXT.md).

- [ ] **Phase 4: Agent Core & CircleCI Pipeline** - Claude Code CLI agent prompt, shell runner, CircleCI job with cron + manual dispatch, self-review loop, and draft PR creation
- [ ] **Phase 5: DevRev Webhook & Reply Loop** - Webhook subscription for issue comments, CircleCI re-trigger, agent reads user feedback, updates draft PR
- [ ] **Phase 6: Status Dashboard** - Read-only arcade-gen dashboard showing nitpick issues, DevRev lifecycle status, PR links, and CI log links
- [ ] **Phase 7: Visual Verification** - Before/after Playwright screenshots in CircleCI, attached to PR and DevRev issue

## Phase Details

<details>
<summary>v1.0 Phase Details (Phases 1-3)</summary>

### Phase 1: Extension Shell & Element Picker
**Goal:** Users can activate Nitpick on any page and select elements (or areas) to inspect, seeing their properties captured accurately.
**Depends on:** Nothing (first phase)
**Requirements:** CORE-01, CORE-02, ELEM-01, ELEM-02, ELEM-03, ELEM-04
**Success Criteria** (what must be TRUE):
  1. User clicks the extension icon and the cursor changes to a comment-pin mode; clicking again deactivates it
  2. User can enter a DevRev PAT and OpenAI API key in the settings panel, and those credentials persist across browser sessions
  3. User hovers over any element on the page and sees a bounding-box highlight; clicking that element selects it and its CSS properties, computed styles, classes, DOM path, and accessibility data appear in the side panel
  4. User can click-and-drag to draw a selection rectangle, and all elements within the region are captured with their metadata
  5. The extension overlay does not break the host page's layout or styles
**Plans:** 4/4 complete

### Phase 2: Capture, AI Analysis & Issue Creation
**Goal:** Users can report a UI bug end-to-end: capture screenshots, describe the problem in plain language, get an AI-enriched technical description, review/edit all fields, and submit a DevRev issue.
**Depends on:** Phase 1
**Requirements:** CAPT-01, CAPT-02, CAPT-03, AI-01, AI-02, AI-03, AI-04, ISSU-01, ISSU-02, ISSU-03, ISSU-04
**Success Criteria** (what must be TRUE):
  1. When the user selects an element, a full viewport screenshot and a cropped detail screenshot are captured automatically
  2. User types a plain-language bug description and within 5 seconds the AI generates a technical issue title and description
  3. The AI filters captured metadata to show only properties relevant to the user's description and suggests a DevRev part and owner
  4. User can review and edit every field before submission
  5. User clicks "Create Issue" and a DevRev issue is created via works.create API with all metadata attached
**Plans:** 5/5 complete

### Phase 3: Shortcuts & UI Fit-and-Finish
**Goal:** Users can activate comment mode via keyboard shortcut. All extension UI surfaces use the Arcade design system.
**Depends on:** Phase 2
**Requirements:** CORE-04, DSGN-01
**Success Criteria** (what must be TRUE):
  1. User presses Cmd+Shift+' (Mac) or Ctrl+Shift+' (Windows) and comment mode activates
  2. Settings page uses Arcade design system components and looks visually consistent
  3. Content script overlay uses Arcade design tokens and matches the design system's visual language
  4. Issue card shows a small thumbnail of the cropped screenshot
**Plans:** 2/2 complete

</details>

### Phase 4: Agent Core & CircleCI Pipeline
**Goal**: A Claude Code CLI agent on CircleCI can pick up a nitpick-tagged DevRev issue, analyze the bug using captured metadata, produce a code fix with self-review, and open a draft PR
**Depends on**: Phase 3 (v1.0 complete)
**Requirements**: AGNT-01, AGNT-02, AGNT-03, AGNT-04, CICD-01, CICD-02, CICD-03
**Success Criteria** (what must be TRUE):
  1. Hourly cron triggers a CircleCI job that queries DevRev for new nitpick-tagged issues and runs the agent against each one
  2. Manual CircleCI pipeline dispatch can target a specific DevRev issue ID for on-demand fix sessions
  3. The agent analyzes the issue's captured metadata (DOM path, CSS properties, screenshots, AI description) and produces a code fix
  4. Self-review loop runs up to 3 rounds: hostile review against CLAUDE.md conventions, `nx affected --target=typecheck`, `pnpm run workspace-lint`
  5. Agent creates a `nitpick/ISS-XXXX-description` branch, commits with `PRE_COMMIT_AUTO_RUN=1`, and opens a draft PR via `gh`
  6. Concurrency groups keyed on issue ID prevent duplicate agent sessions
  7. Tool access is restricted via `--allowedTools`; `--permission-mode bypassPermissions` for headless execution
**Plans**: TBD

### Phase 5: DevRev Webhook & Reply Loop
**Goal**: Users can guide the fix by replying on the DevRev issue — the agent picks up their feedback and updates the draft PR accordingly
**Depends on**: Phase 4
**Requirements**: DREV-01, DREV-02, DREV-03, DREV-04, DREV-05
**Success Criteria** (what must be TRUE):
  1. Agent posts 2-4 fix options as a DevRev issue comment with code context alongside the draft PR
  2. DevRev webhook fires on issue comment and triggers CircleCI pipeline re-run with the issue ID
  3. Agent reads the user's reply, understands the chosen direction, and updates the draft PR with the revised fix
  4. Issue status transitions automatically: triage → in development → completed (on PR merge)
  5. PR link appears in the DevRev issue timeline when the draft PR is created
**Plans**: TBD

### Phase 6: Status Dashboard
**Goal**: Users can view all nitpick issues and their fix status from a minimal web dashboard
**Depends on**: Phase 5
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. Dashboard shows a list of nitpick-tagged issues with DevRev lifecycle status (triage / in development / completed)
  2. Each issue row links to the DevRev issue, draft PR (if exists), and CircleCI job logs
  3. Dashboard reads directly from DevRev API — no intermediate database or streaming layer
  4. All UI uses `@xorkavi/arcade-gen` components and design tokens exclusively — zero custom CSS or component code
**Plans**: TBD
**UI hint**: yes

### Phase 7: Visual Verification
**Goal**: Users can visually confirm the fix worked by comparing before/after screenshots attached to the PR and DevRev issue
**Depends on**: Phase 4 (Phase 6 not required — screenshots are attached to PR/DevRev, not dashboard)
**Requirements**: VISU-01, VISU-02
**Success Criteria** (what must be TRUE):
  1. Playwright captures a screenshot of the affected page before the fix and after the fix within the CircleCI environment
  2. Before/after screenshots are attached to the draft PR as images and posted as a DevRev issue comment
**Plans**: TBD

## Progress

**Execution Order:**
4 → 5 → 6 (dashboard can be parallelized with 5 or 7)
4 → 7 (visual verification only needs the agent core, not the webhook loop)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Extension Shell & Element Picker | v1.0 | 4/4 | Complete | 2026-04-25 |
| 2. Capture, AI Analysis & Issue Creation | v1.0 | 5/5 | Complete | 2026-04-25 |
| 3. Shortcuts & UI Fit-and-Finish | v1.0 | 2/2 | Complete | 2026-04-25 |
| 4. Agent Core & CircleCI Pipeline | v2.0 | 0/? | Not started | - |
| 5. DevRev Webhook & Reply Loop | v2.0 | 0/? | Not started | - |
| 6. Status Dashboard | v2.0 | 0/? | Not started | - |
| 7. Visual Verification | v2.0 | 0/? | Not started | - |

## Coverage Map

<details>
<summary>v1.0 Coverage (19/20 mapped)</summary>

| Requirement | Phase | Category |
|-------------|-------|----------|
| CORE-01 | Phase 1 | Extension Core |
| CORE-02 | Phase 1 | Extension Core |
| CORE-03 | DROPPED | Extension Core |
| CORE-04 | Phase 3 | Extension Core |
| ELEM-01 | Phase 1 | Element Interaction |
| ELEM-02 | Phase 1 | Element Interaction |
| ELEM-03 | Phase 1 | Element Interaction |
| ELEM-04 | Phase 1 | Element Interaction |
| CAPT-01 | Phase 2 | Capture |
| CAPT-02 | Phase 2 | Capture |
| CAPT-03 | Phase 2 | Capture |
| AI-01 | Phase 2 | AI Analysis |
| AI-02 | Phase 2 | AI Analysis |
| AI-03 | Phase 2 | AI Analysis |
| AI-04 | Phase 2 | AI Analysis |
| ISSU-01 | Phase 2 | Issue Creation |
| ISSU-02 | Phase 2 | Issue Creation |
| ISSU-03 | Phase 2 | Issue Creation |
| ISSU-04 | Phase 2 | Issue Creation |
| ANNO-01 | DROPPED | Annotation |
| DSGN-01 | Phase 3 | Design System |

</details>

### v2.0 Coverage (17/17 mapped)

| Requirement | Phase | Category |
|-------------|-------|----------|
| AGNT-01 | Phase 4 | Agent Core |
| AGNT-02 | Phase 4 | Agent Core |
| AGNT-03 | Phase 4 | Agent Core |
| AGNT-04 | Phase 4 | Agent Core |
| CICD-01 | Phase 4 | CI/CD Pipeline |
| CICD-02 | Phase 4 | CI/CD Pipeline |
| CICD-03 | Phase 4 | CI/CD Pipeline |
| DREV-01 | Phase 5 | DevRev Integration |
| DREV-02 | Phase 5 | DevRev Integration |
| DREV-03 | Phase 5 | DevRev Integration |
| DREV-04 | Phase 5 | DevRev Integration |
| DREV-05 | Phase 5 | DevRev Integration |
| DASH-01 | Phase 6 | Dashboard |
| DASH-02 | Phase 6 | Dashboard |
| DASH-03 | Phase 6 | Dashboard |
| VISU-01 | Phase 7 | Visual Verification |
| VISU-02 | Phase 7 | Visual Verification |

**Mapped: 17/17. No orphans, no duplicates.**

---
*Roadmap created: 2026-04-24*
*v2.0 phases revised: 2026-05-03 — architecture pivot to Claude Code CLI + CircleCI (see 04-CONTEXT.md)*
