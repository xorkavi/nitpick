# Phase 5: DevRev Webhook & Reply Loop - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

A DevRev snap-in that listens for issue creation and comment events, validates nitpick-format issues, and triggers CircleCI pipelines immediately. The agent runs in two stages: first an analysis run that explains the bug and posts fix options, then a fix run after the user picks a direction. The agent communicates conversationally on the DevRev issue timeline throughout, posts preview URLs, handles revisions, tags codeowners for approval, and posts a completion message with timing when the PR merges.

**Architecture:** DevRev snap-in (native events, following figma-validator pattern from design-system repo) replaces the hourly cron as primary trigger. All implementation lives in devrev-web (`/Users/kavinash/arcade/devrev-web/`) on a feature branch + snap-in code in this repo (`arcade/plugins/nitpick/snap-in/`).

**Revises Phase 4 decisions:** D-08 (cron replaced by immediate snap-in trigger), D-11 (no best-guess PR — agent waits for user choice before creating PR).

</domain>

<decisions>
## Implementation Decisions

### Webhook Receiver (Snap-in)
- **D-01:** DevRev snap-in using native DevRev events (`work:created` + `work:comment`), NOT external webhooks. Follows figma-validator pattern from `design-system/Scripts/figma-validator/`.
- **D-02:** Snap-in lives in `arcade/plugins/nitpick/snap-in/` — same build pattern: esbuild → `dist/`, `function-factory.ts` exports, `manifest.yaml`, `.devrev/repo.yml`.
- **D-03:** Immediate trigger on issue creation replaces hourly cron entirely. No cron fallback.
- **D-04:** Deploy via GitHub Actions marketplace workflow on PR merge (same pattern as design-system's `create-marketplace-submission.yml`).

### Issue Validation (Scope Guard)
- **D-05:** Snap-in validates ALL of: (a) has "nitpicked" tag, (b) body contains "### Code identifiers" section, (c) has screenshot artifacts. All three must pass.
- **D-06:** If validation fails → post conversational comment ("This doesn't look like it was filed through the Nitpick extension. Was the nitpicked tag added by mistake? Removing it for now.") → remove tag → don't trigger.
- **D-07:** Issue body will end with "Made with [Nitpick](https://github.com/xorkavi/nitpick)" as additional marker (Chrome extension change).

### Comment Filtering & Loop Guard
- **D-08:** Single "Nitpick Bot" service account shared between snap-in and CI agent (same PAT). All automation shows as one identity.
- **D-09:** Loop guard: snap-in ignores comments where author == its own service account ID. Simple, reliable.
- **D-10:** "retry" / "try again" recognized as special keywords to re-trigger a failed run.

### Agent Two-Stage Flow (REVISES Phase 4 D-11)
- **D-11:** Stage 1 (Analysis): Agent analyzes issue, explains the root cause in one line, then posts 2-4 fix options with code snippets. Exits without creating a PR.
- **D-12:** Stage 2 (Fix): Triggered by user reply. Agent reads user's choice (natural language — not just option numbers), implements fix, creates PR following devrev-web conventions.
- **D-13:** Stage 3+ (Revision): User requests changes → agent posts "Looking into it...", fixes, pushes new commit (no force-push), posts updated PR + preview links.

### Fix Options Format
- **D-14:** Agent first explains the root cause (one line), then presents numbered options with before/after code snippets, affected files, and plain language approach.
- **D-15:** All user replies processed as natural language. Agent understands "option 2 but do it differently" — not a dumb number parser.

### PR Creation (devrev-web conventions)
- **D-16:** Branch naming: `fix/ISS-XXXX-short-description` (per devrev-web CLAUDE.md: "All branches must include a DevRev issue ID: `chore/ISS-XXXX-short-description`"). Use `fix/` prefix for nitpick branches.
- **D-17:** PR created following `/create-pr` skill pattern: full PR template, title validation via `.github/scripts/pr-title-check.js`, DevRev work item linked, session ID populated.
- **D-18:** Preview URL posted alongside PR: `https://devrev-web-<PR_NUMBER>.e2e.dev.devrev-eng.ai` (requires `deploy-to-sandbox-gate` approval in CircleCI — agent approves this via CircleCI API).

### Conversational Bot Comments
- **D-19:** On pickup: "🔍 Nitpick Bot is looking into this... will post fix options soon"
- **D-20:** After analysis: Root cause explanation + fix options + "Which approach works for you?"
- **D-21:** On fix start: "Working on it — implementing your suggestion now..."
- **D-22:** After PR: "Here's the fix applied in PR #XXXX: [link]. Preview it live: [preview URL]. Take a look and let me know if anything needs adjusting."
- **D-23:** On revision start: "Looking into it..."
- **D-24:** After revision: "Updated the fix — new commit pushed. PR #XXXX: [link]. Preview (updated): [preview URL]. Check if this looks right."
- **D-25:** On user approval: "Tagging the code owners for review: @owner1 @owner2 (owners of [path]). PR #XXXX is ready for their review."
- **D-26:** On merge: "All done! Fixed [issue summary] in [Xh Ym] (from report to merge). PR #XXXX merged — this issue is now resolved. The fix will be live in the next deployment."

### Error Handling & Communication
- **D-27:** On failure: Agent posts explanation of what went wrong (e.g., "TypeScript is complaining: [error]"), explains WHY the error happens, then presents fix options for the error itself. Listens to user's direction.
- **D-28:** Failure comment includes CircleCI log link for debugging.
- **D-29:** Per-issue cap: max 5 total runs. After cap: "I've given this 5 attempts and can't quite crack it. [Explains the blocker]. Developers who own this area: @owner1, @owner2 (from CODEOWNERS). They'll have the context to resolve this quickly."

### Status Lifecycle
- **D-30:** Custom DevRev field `Nitpick stage` (dropdown: Analyzing, Awaiting choice, Fixing, In review, Revising) — already created in dev environment.
- **D-31:** Shell runner updates `nitpick_stage` at each transition. Agent never touches it.
- **D-32:** triage → in_development: shell runner on first pickup (idempotent).
- **D-33:** in_development → completed: DevRev automation rule on linked PR merge.
- **D-34:** PR linked via both DevRev link API (formal association for automation) AND comment with URL (for visibility).

### Re-run Context & Memory
- **D-35:** Fresh run with full comment history injected (no session continuation — ephemeral CI).
- **D-36:** Shell runner fetches ALL DevRev timeline entries for the issue, injects into prompt.
- **D-37:** For revision runs: shell runner checks out existing branch so agent can read its own previous diff (`git diff main...HEAD`). Git is the memory.
- **D-38:** New commit on same branch for revisions (no force-push). Full iteration history preserved in PR.

### Agent Prompt & Shell Runner Changes
- **D-39:** Single prompt template with conditional sections. Shell runner injects MODE (analysis/fix/revision) + COMMENT_HISTORY + METADATA.
- **D-40:** Agent posts mid-run via helper script (`scripts/circleci/post_devrev_comment.sh`) added to `--allowedTools`.
- **D-41:** Mode detection: shell runner reads `nitpick_stage` field + checks comment history as fallback.

### Multi-Issue Scaling
- **D-42:** Separate CircleCI pipeline per issue (via pipeline trigger API). Each runs independently.
- **D-43:** Same pipeline mechanism for creation-triggered runs and comment-triggered re-runs.
- **D-44:** Concurrency guard: both stage check AND branch existence check must pass to skip.

### Snap-in Secrets & Config
- **D-45:** CircleCI API token: DevRev keyring (`devrev-snap-in-secret` type).
- **D-46:** CircleCI project slug: org input (text field, configurable at install).

### Codeowners Integration
- **D-47:** Agent reads `.github/CODEOWNERS` to identify owners for affected paths.
- **D-48:** Tags codeowners in DevRev comment when user approves the fix (for PR review).
- **D-49:** Lists codeowners when max attempts reached (for human handoff).

### Testing
- **D-50:** Full E2E: ngrok + real DevRev test org + real CircleCI (following figma-validator pattern).
- **D-51:** Local snap-in server (`snap-in-server.ts`) for rapid iteration.
- **D-52:** Unit tests for snap-in function (filtering logic, payload parsing, mode detection).

### Claude's Discretion
- Helper script implementation details (how it authenticates to DevRev API)
- Exact CircleCI API calls for pipeline trigger and sandbox gate approval
- Comment markdown formatting details
- Metrics logging format and storage
- How to parse CODEOWNERS file for path matching

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Figma Validator Snap-in (the pattern to follow)
- `arcade/design-system/Scripts/figma-validator/manifest.yaml` — Snap-in manifest structure (event sources, functions, automations, keyrings, inputs)
- `arcade/design-system/Scripts/figma-validator/code/src/function-factory.ts` — Function factory pattern (snap-in runtime contract)
- `arcade/design-system/Scripts/figma-validator/code/src/functions/validate_figma_design/index.ts` — Event handler pattern (events array, keyring injection, payload validation)
- `arcade/design-system/Scripts/figma-validator/code/src/snap-in-server.ts` — Local test server pattern (Express, `/handle/async` endpoint)
- `arcade/design-system/Scripts/figma-validator/snap-in-deploy-faq.md` — Critical deploy pitfalls (dual dist outputs, keyring injection as raw strings, REST API for version creation)
- `arcade/design-system/Scripts/figma-validator/code/package.json` — Build setup (esbuild dual output, `npm run package` for tar.gz)
- `arcade/design-system/.github/workflows/create-marketplace-submission.yml` — GitHub Actions deploy workflow

### devrev-web Repository (target for agent code)
- `/Users/kavinash/arcade/devrev-web/CLAUDE.md` § "Git & PR Conventions" — Branch naming (`fix/ISS-XXXX-short-description`), commit format, PR title conventions
- `/Users/kavinash/arcade/devrev-web/.github/pull_request_template.md` — Full PR template (Documentation, Changes, Media, Tests, Checklists)
- `/Users/kavinash/arcade/devrev-web/.github/scripts/pr-title-check.js` — PR title validation regex
- `/Users/kavinash/arcade/devrev-web/.claude/skills/create-pr/SKILL.md` — PR creation workflow (7-step process, metadata extraction, body drafting)
- `/Users/kavinash/arcade/devrev-web/.github/CODEOWNERS` — Path-to-owner mapping for tagging reviewers
- `/Users/kavinash/arcade/devrev-web/scripts/circleci/run_nitpick_fix_agent.sh` — Phase 4 shell runner (to be modified)
- `/Users/kavinash/arcade/devrev-web/scripts/circleci/nitpick_fix_prompt.md` — Phase 4 prompt template (to be modified)
- `/Users/kavinash/arcade/devrev-web/scripts/circleci/query_nitpick_issues.sh` — Phase 4 query script (to be replaced by snap-in trigger)

### Nitpick Extension (issue format reference)
- `src/service-worker/ai-analysis.ts` — How the extension generates issue titles and descriptions (TITLE/DESCRIPTION/PART/OWNER format, "Code identifiers" section auto-appended)
- `src/service-worker/messages.ts` lines 143-195 — Issue creation flow (artifact upload, inline markdown images, body assembly)
- `src/shared/types.ts` → `CreateIssuePayload` — Issue payload structure (title, description, partId, ownerId, priority, artifactIds, tagIds)

### Phase 4 Context (decisions carried forward)
- `.planning/phases/04-foundation-agent-core/04-CONTEXT.md` — All D-01 through D-20 decisions. Phase 5 revises D-08 (cron → snap-in) and D-11 (no best-guess PR).
- `.planning/phases/04-foundation-agent-core/04-RESEARCH.md` — Agent runtime details, CircleCI config patterns, prompt template design

### DevRev Platform
- Per-PR preview URL pattern: `https://devrev-web-<PR_NUMBER>.e2e.dev.devrev-eng.ai` (deploy-to-sandbox-gate approval required)
- `Nitpick stage` custom field: already created in dev environment (Dropdown: Analyzing, Awaiting choice, Fixing, In review, Revising)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **figma-validator snap-in** (`design-system/Scripts/figma-validator/`): Complete reference implementation — manifest, function factory, snap-in server, deploy FAQ. Adapt structure directly.
- **Phase 4 shell runner** (`devrev-web/scripts/circleci/run_nitpick_fix_agent.sh`): 157 lines covering agent lifecycle, concurrency guard, Bedrock auth, post-run guardrails. Modify for two-stage flow.
- **Phase 4 prompt template** (`devrev-web/scripts/circleci/nitpick_fix_prompt.md`): Add conditional sections for analysis vs fix vs revision modes.
- **CODEOWNERS file** (`devrev-web/.github/CODEOWNERS`): Maps file paths to GitHub usernames. Agent reads this to tag reviewers.
- **create-pr skill** (`devrev-web/.claude/skills/create-pr/SKILL.md`): 7-step PR creation workflow. Agent prompt should follow same conventions.

### Established Patterns
- **devrev-web branch naming**: `fix/ISS-XXXX-short-description` — agent branches must follow this exact pattern.
- **PR title format**: `fix(<scope>): short description` — must pass `pr-title-check.js` regex.
- **CircleCI sandbox deploy**: `deploy-to-sandbox-gate` manual approval → per-PR Kubernetes namespace → preview URL.
- **Snap-in deploy**: GitHub Actions `create-marketplace-submission` on PR merge → DevRev marketplace.
- **`PRE_COMMIT_AUTO_RUN=1`**: Non-interactive commit flag for agents in devrev-web.

### Integration Points
- **DevRev events API**: `work:created` and `work:comment` event types for snap-in triggers.
- **CircleCI pipeline trigger API**: `POST /api/v2/project/{slug}/pipeline` with `parameters.nitpick_issue_id`.
- **CircleCI sandbox gate API**: Approve `deploy-to-sandbox-gate` job for preview deployment.
- **DevRev works.update API**: Stage transitions, field updates (`nitpick_stage`).
- **DevRev timeline_entries.create API**: Posting comments on issues.
- **DevRev tags API**: Remove nitpicked tag on validation failure.
- **GitHub CODEOWNERS**: Parse for path-based owner lookup.

</code_context>

<specifics>
## Specific Ideas

- Bot comments should be conversational and short — not robotic status messages. Examples throughout decisions D-19 to D-26.
- Agent explains the root cause FIRST (one clear line) before presenting fix options. Users need to understand the bug before choosing a direction.
- All user replies are natural language input. The agent is not a dumb option-number parser — it understands "option 2 but use className instead of props" as a composite instruction.
- After each fix/revision, post both PR link AND preview URL so user can visually verify before requesting more changes.
- On completion (PR merge), post timing ("Fixed in Xh Ym from report to merge") + celebration message. Makes the automation feel rewarding.
- On max attempts, don't just say "failed" — explain what's blocking it and suggest specific codeowners who can help, with their GitHub handles from CODEOWNERS.
- The Chrome extension issue body should end with "Made with [Nitpick](repo-link)" — serves as both attribution and a validation marker for the snap-in.
- Phase 4 code was deleted from devrev-web — needs to be rebuilt on a fresh branch in `/Users/kavinash/arcade/devrev-web/`.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-repo support**: Agent currently targets devrev-web only. Each additional repo needs its own CircleCI job + prompt template. Future v2.x.
- **Auto-merge after codeowner approval**: Currently agent just tags owners. Could auto-merge once approved. Trust/safety concern — keep human in the loop for now.
- **Slack notifications**: Notify user via Slack when fix is ready for review. Currently DevRev issue is the only notification channel.
- **Batch fix sessions**: Queue multiple issues into one agent session for efficiency. Currently one pipeline per issue.
- **Real-time streaming dashboard** (from v2.x backlog): Live agent token streaming. Replaced by conversational DevRev comments for now.

</deferred>

---

*Phase: 5-DevRev Webhook & Reply Loop*
*Context gathered: 2026-05-07*
