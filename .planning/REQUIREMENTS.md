# Requirements: Nitpick

**Defined:** 2026-04-24
**Core Value:** End-to-end UI bug lifecycle — from "this looks wrong" to merged PR — with AI doing the heavy lifting at every step.

## v1.0 Requirements (Completed)

### Extension Core

- [x] **CORE-01**: User can activate/deactivate comment mode by clicking the extension icon
- [x] **CORE-02**: User can configure settings: DevRev PAT, OpenAI API key, active domain list
- [x] **CORE-04**: User can activate comment mode via configurable keyboard shortcut

### Element Interaction

- [x] **ELEM-01**: User can hover over page elements to see bounding box highlight, then click to select
- [x] **ELEM-02**: Selected element's CSS properties, computed styles, applied classes, and DOM path are captured
- [x] **ELEM-03**: User can click-and-drag to select an area, capturing all elements within the region
- [x] **ELEM-04**: Accessibility data (ARIA roles, labels, contrast ratio) captured for selected elements

### Capture

- [x] **CAPT-01**: Full viewport screenshot captured automatically on element/area selection
- [x] **CAPT-02**: Cropped detail screenshot of the selected element or dragged area
- [x] **CAPT-03**: Browser/OS metadata captured: URL, page hierarchy, viewport size, user agent

### AI Analysis

- [x] **AI-01**: AI generates technical issue description by cross-referencing user's comment with element properties
- [x] **AI-02**: AI generates concise, searchable issue title from the bug context
- [x] **AI-03**: AI filters captured metadata to show only properties relevant to the user's description
- [x] **AI-04**: AI suggests the right DevRev part and owner by analyzing issue context

### Issue Creation

- [x] **ISSU-01**: Issue created in DevRev via works.create API with screenshots, metadata, and AI content attached
- [x] **ISSU-02**: User enters plain-language bug description in a comment input near the selected element
- [x] **ISSU-03**: User can review and edit all fields (title, description, part, owner, priority) before submission
- [x] **ISSU-04**: Owner defaults to the reporting user; AI-suggested part and owners shown as recommendations

### Design System

- [x] **DSGN-01**: Extension UI surfaces visually match the DevRev design system via Arcade components and design tokens

**Dropped:** CORE-03 (domain detection — hardcoded instead), ANNO-01 (annotation — replaced by DSGN-01)

## v2.0 Requirements (Revised 2026-05-03)

Requirements for the Cloud Fix Pipeline milestone.
**Architecture:** Claude Code CLI (`claude -p`) via Bedrock on CircleCI, following devrev/mobius prior art. See [04-CONTEXT.md](phases/04-foundation-agent-core/04-CONTEXT.md) for decisions.

### Agent Core

- [ ] **AGNT-01**: Claude Code CLI (`claude -p`) via Bedrock processes a nitpick-tagged DevRev issue end-to-end — analyzes captured metadata (DOM path, CSS properties, screenshots, AI description) and produces a code fix
- [ ] **AGNT-02**: Agent prompt template adapted from the nitpick-fix skill's 15-step analysis flow, stored in `scripts/circleci/nitpick_fix_prompt.md` in devrev-web
- [ ] **AGNT-03**: Agent enforces 65-turn cap with self-review loop (up to 3 rounds of hostile self-review against CLAUDE.md conventions) including `nx affected --target=typecheck` and `pnpm run workspace-lint` verification
- [ ] **AGNT-04**: Tool access restricted via `--allowedTools` flag (Read, Grep, Glob, Edit, Write, Bash); `--permission-mode bypassPermissions` for headless CI execution

### CI/CD Pipeline

- [ ] **CICD-01**: CircleCI job in devrev-web's `.circleci/config.yml` with hourly cron schedule + manual pipeline dispatch trigger
- [ ] **CICD-02**: Concurrency groups keyed on DevRev issue ID prevent duplicate agent sessions
- [ ] **CICD-03**: Agent creates `nitpick/ISS-XXXX-description` branch, commits, pushes, and opens a draft PR via `gh`

### DevRev Integration

- [ ] **DREV-01**: Agent posts 2-4 fix options as a DevRev issue comment with code context (not raw diffs)
- [ ] **DREV-02**: DevRev webhook subscription on issue comment events triggers CircleCI pipeline re-run
- [ ] **DREV-03**: Agent reads user reply from DevRev issue, updates the draft PR with the revised fix direction
- [ ] **DREV-04**: Issue status transitions automatically: triage → in development (fix started) → completed (PR merged)
- [ ] **DREV-05**: PR link added to DevRev issue timeline when draft PR is created

### Dashboard

- [ ] **DASH-01**: Read-only status dashboard lists nitpick-tagged issues with DevRev lifecycle status and links to PRs and CircleCI logs
- [ ] **DASH-02**: Dashboard reads from DevRev API — no Supabase layer
- [ ] **DASH-03**: All dashboard UI uses `@xorkavi/arcade-gen` components and design tokens exclusively — no custom CSS or component code

### Visual Verification

- [ ] **VISU-01**: Playwright captures before/after screenshots of the affected page within CircleCI
- [ ] **VISU-02**: Screenshots attached to draft PR and posted on DevRev issue comment for user review

## v2.0 Dropped Requirements

Previously planned for v2.0, dropped due to architecture pivot (Claude Code CLI + CircleCI replaces custom Claude API + GitHub Actions + Supabase).

| Old ID | Description | Disposition |
|--------|-------------|-------------|
| AGNT-04 (old) | Agent streams tokens to Supabase Realtime | DEFERRED → v2.x (RTST-01) |
| STRM-01 | Supabase HTTP Broadcast relay | DEFERRED → v2.x (RTST-01) |
| STRM-02 | Dual-write to Supabase Postgres | DEFERRED → v2.x (RTST-01) |
| STRM-03 | Dashboard reconnection from Postgres | DEFERRED → v2.x (RTST-01) |
| GHAC-01 | GitHub Actions workflow_dispatch trigger | REPLACED by CICD-01 (CircleCI) |
| GHAC-02 | GH Actions concurrency + heartbeat | REPLACED by CICD-02 (CircleCI) |
| GHAC-03 | Branch/commit/push/PR via GH API | REPLACED by CICD-03 (same goal, CircleCI context) |
| DASH-02 (old) | Live session streaming view | DEFERRED → v2.x (RTST-02) |
| DASH-03 (old) | Checkpoint UI with fix options | REPLACED by DREV-01 (fix options on DevRev issue) |
| DASH-04 (old) | Approve/reject/stop session controls | REPLACED by DREV-03 (reply loop on DevRev issue) |
| DASH-06 (old) | Supabase Auth (GitHub OAuth) | DROPPED — dashboard is internal, no auth needed for v2.0 |

## v2.x Requirements

Deferred to future release. Tracked but not in current roadmap.

### Real-Time Streaming (from original v2.0)

- **RTST-01**: Supabase Realtime streaming bridge — live agent token/tool-call streaming from CI to dashboard
- **RTST-02**: Live session view in dashboard with real-time agent reasoning, tool calls, and file diffs

### Batch & Scale

- **BATC-01**: Multi-issue batch sessions — queue multiple fixes into one PR
- **BATC-02**: Deployment preview link integration in dashboard

### Automation

- **AUTO-01**: Webhook auto-trigger — start fix session automatically on issue creation (not just comments)
- **AUTO-02**: Metrics dashboard — success rate, session time, cost per fix
- **AUTO-03**: Multi-repo support — per-repo CircleCI job + prompt template with `.nitpick.yml` config

### Analysis

- **ANLY-01**: Design system impact analysis across affected components
- **ANLY-02**: Cross-theme verification (DevRev + Arcade screenshots)
- **ANLY-03**: Cross-repo context for errors spanning service → gateway boundaries

### Post-Submission (from v1.0 backlog)

- **POST-01**: Pin display shows numbered markers on the page for previously reported issues
- **POST-02**: Clicking a pin opens the linked DevRev issue

### Enhanced Capture (from v1.0 backlog)

- **ECAP-01**: Console error capture (JS console errors at time of report)
- **ECAP-02**: Multi-step bug reporting (sequence of annotated screenshots)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Autonomous merge without approval | Trust and safety — human must approve before merge |
| Real-time code editing (web IDE) | Over-engineering — diffs are sufficient for review |
| Chat/voice interaction with agent | Complexity without clear value — DevRev replies are more structured |
| Local agent execution | v1.0 nitpick-fix skill already covers this use case |
| Multi-provider AI support | Claude via Bedrock only — no abstraction layer needed |
| Custom CSS or components in dashboard | @xorkavi/arcade-gen is the exclusive component source |
| Video recording | Engineers prefer screenshots + steps-to-reproduce |
| Cross-browser screenshot comparison | Enormous complexity for marginal value |
| Offline mode | API calls require network |
| GitHub Actions hosting | CircleCI already configured for devrev-web with Bedrock IAM contexts |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v1.0 (Completed)

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Complete |
| CORE-02 | Phase 1 | Complete |
| CORE-03 | DROPPED | — |
| CORE-04 | Phase 3 | Complete |
| ELEM-01 | Phase 1 | Complete |
| ELEM-02 | Phase 1 | Complete |
| ELEM-03 | Phase 1 | Complete |
| ELEM-04 | Phase 1 | Complete |
| CAPT-01 | Phase 2 | Complete |
| CAPT-02 | Phase 2 | Complete |
| CAPT-03 | Phase 2 | Complete |
| AI-01 | Phase 2 | Complete |
| AI-02 | Phase 2 | Complete |
| AI-03 | Phase 2 | Complete |
| AI-04 | Phase 2 | Complete |
| ISSU-01 | Phase 2 | Complete |
| ISSU-02 | Phase 2 | Complete |
| ISSU-03 | Phase 2 | Complete |
| ISSU-04 | Phase 2 | Complete |
| DSGN-01 | Phase 3 | Complete |

### v2.0 (In Progress — Revised 2026-05-03)

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGNT-01 | Phase 4 | Pending |
| AGNT-02 | Phase 4 | Pending |
| AGNT-03 | Phase 4 | Pending |
| AGNT-04 | Phase 4 | Pending |
| CICD-01 | Phase 4 | Pending |
| CICD-02 | Phase 4 | Pending |
| CICD-03 | Phase 4 | Pending |
| DREV-01 | Phase 5 | Pending |
| DREV-02 | Phase 5 | Pending |
| DREV-03 | Phase 5 | Pending |
| DREV-04 | Phase 5 | Pending |
| DREV-05 | Phase 5 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |
| DASH-03 | Phase 6 | Pending |
| VISU-01 | Phase 7 | Pending |
| VISU-02 | Phase 7 | Pending |

**Coverage:**
- v2.0 requirements: 17 total (down from 20 — 11 dropped/replaced, 8 new)
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-05-03 — v2.0 revised for Claude Code CLI + CircleCI architecture pivot*
