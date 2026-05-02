# Phase 4: Foundation & Agent Core - Context

**Gathered:** 2026-05-03
**Status:** Ready for roadmap revision (architecture rethink triggered by internal prior art)

<domain>
## Phase Boundary

A Claude Code CLI agent running in CircleCI that picks up nitpick-tagged DevRev issues in devrev-web, analyzes the bug using captured metadata (DOM path, CSS properties, screenshots, AI description), proposes fix options as DevRev issue comments with a draft PR, and iterates based on user feedback via DevRev webhook-triggered re-runs.

**Architecture pivot:** The original plan called for a custom Claude API tool loop with Supabase Realtime streaming. This was scrapped after discovering that DevRev's mobius team (Divya) already ships a working Claude Code CLI agent on CircleCI (`devrev/mobius` PRs #1523, #1524) that does autonomous code fixes with self-review loops. The entire v2.0 roadmap is being revised to align with this proven pattern.

</domain>

<decisions>
## Implementation Decisions

### Agent Runtime
- **D-01:** Use Claude Code CLI (`claude -p`) via Amazon Bedrock, not a custom Claude API tool loop. This mirrors the mobius daily tech debt agent and leverages CLI-native tools (Read, Write, Edit, Bash, Grep, Glob) without hand-rolling tool schemas.
- **D-02:** Run on CircleCI (same CI platform as devrev-web and mobius), not GitHub Actions. Bedrock IAM contexts and repo checkout are already configured in CircleCI for the org.
- **D-03:** Agent job lives inside devrev-web's `.circleci/config.yml`, not in the nitpick repo. The agent has native repo access, matching how mobius hosts its own tech debt job.

### Agent Tooling & Sandboxing
- **D-04:** Use `--allowedTools` CLI flag to restrict tool access (matching mobius pattern: `Read,Grep,Glob,Edit,Write,Bash(pnpm:*),Bash(git:*),Bash(gh:*)`). No need for custom tool schemas.
- **D-05:** `--permission-mode bypassPermissions` for headless CI execution.
- **D-06:** Verification commands: `nx affected --target=typecheck` and `pnpm run workspace-lint` (oxlint) on affected files — matches devrev-web's own pre-commit pipeline. No full test suite (too slow for agent loop).
- **D-07:** Agent prompt template lives in `scripts/circleci/nitpick_fix_prompt.md` in devrev-web (mirrors mobius's `scripts/circleci/daily_tech_debt_prompt.md`).

### Trigger & Scheduling
- **D-08:** Hourly cron schedule checks for new nitpick-tagged issues, plus manual CircleCI pipeline dispatch for on-demand fix sessions.
- **D-09:** DevRev webhook fires on issue comment → triggers CircleCI pipeline so the agent picks up user feedback near-instantly (not waiting for next cron cycle).

### Interaction Model (Hybrid DevRev + Draft PR)
- **D-10:** Agent posts fix options as a comment on the DevRev issue (2-4 options with code context, not raw diffs).
- **D-11:** Agent simultaneously creates a draft PR with its best-guess fix on a `nitpick/ISS-XXXX` branch.
- **D-12:** When user replies on the DevRev issue with their direction, the webhook re-triggers the agent. Agent reads the reply, updates the draft PR with the revised fix.
- **D-13:** User marks the PR as ready for review when satisfied. Standard code review process from there.

### Session Lifecycle
- **D-14:** Max 65 turns per agent invocation (matching mobius). Self-review loop: agent reviews its own diff, runs typecheck + lint, iterates up to 3 rounds.
- **D-15:** Concurrency groups prevent duplicate sessions per issue (CircleCI concurrency key on issue ID).
- **D-16:** Agent uses `PRE_COMMIT_AUTO_RUN=1` for non-interactive commits in devrev-web.
- **D-17:** Branch naming: `nitpick/ISS-XXXX-short-description` (includes DevRev issue ID per devrev-web convention).

### Dashboard
- **D-18:** Minimal status dashboard for v2.0 — list of nitpick issues, their DevRev lifecycle status, links to PRs and CI logs. Read-only, pulls from DevRev API. Built with `@xorkavi/arcade-gen`.
- **D-19:** No Supabase Realtime streaming layer. No live agent token streaming. The dashboard shows status, not live sessions.

### Roadmap Impact
- **D-20:** The v2.0 roadmap (Phases 4-7) will be completely restructured with a fresh phase breakdown. The scope shrinks significantly without the Supabase streaming layer and custom Claude API tool loop.

### Claude's Discretion
- Prompt template structure and content (how to adapt the nitpick-fix skill's analysis flow into a prompt for `claude -p`)
- CircleCI job resource class and timeout configuration
- Exact `--allowedTools` allowlist beyond the core set
- DevRev webhook implementation details (which webhook events, payload parsing)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mobius Prior Art (the pattern to follow)
- `devrev/mobius:scripts/circleci/daily_tech_debt_prompt.md` — Agent prompt template (the exact pattern to adapt)
- `devrev/mobius:scripts/circleci/run_daily_tech_debt_agent.sh` — Shell runner script (Bedrock auth, CLI invocation, prompt injection)
- `devrev/mobius:.circleci/config.yml` — CircleCI job definition (`daily_tech_debt_agent` job + `daily_tech_debt_schedule` workflow)
- `devrev/mobius` PR #1523 — First successful automated PR (dead code removal, self-review loop, verification)
- `devrev/mobius` PR #1524 — CCI migration + Snyk integration

### Nitpick Fix Skill (agent analysis logic to adapt)
- `~/.claude/skills/nitpick-fix/SKILL.md` — Full fix flow: issue fetch, screenshot download, element cross-check, code search, trace-to-source, fix options, retry protocol
- `~/.claude/skills/nitpick-fix/devrev-web-reference.md` — devrev-web-specific guidance (monorepo structure, theme architecture, URL→feature mapping, DS bug patterns)

### devrev-web Repository
- `/Users/kavinash/arcade/test/devrev-web/AGENTS.md` — Tool-agnostic agent entrypoint; references CLAUDE.md and PR template
- `/Users/kavinash/arcade/test/devrev-web/CLAUDE.md` — Full repo conventions: Nx monorepo, TypeScript strict, Tailwind + DS tokens, React patterns, i18n, branch naming (DevRev ID required), pre-commit hooks
- `/Users/kavinash/arcade/test/devrev-web/tools/pre-commit/steps.mjs` — Pre-commit verification pipeline: lint-staged, typecheck (nx affected), circular deps, unit test validation, translations check
- `/Users/kavinash/arcade/test/devrev-web/.circleci/config.yml` — Existing CI config to add the nitpick job to

### Existing Nitpick Code
- `.planning/PROJECT.md` — Project context, constraints, key decisions
- `.planning/REQUIREMENTS.md` — v2.0 requirements (AGNT-01 through VISU-02) — these will be revised with the new roadmap
- `src/service-worker/devrev-api.ts` — DevRev API client (works.create, tags, artifacts) — the extension already tags issues with "nitpicked"

### Team Context (Slack Discussion)
- Shanay: "Cron job every 1 hour that gets new issues with the nitpick tag and raises PRs"
- Divya: Cross-repo context is a concern; ideally the job has all relevant repo context
- Kapil: Building `.claude/skills/` that encode repo-specific patterns for Claude Code (PR #4703 in devrev/flow)
- Gil: Wants setup help, had errors with Claude Code locally (nitpick-fix skill already serves this use case)
- Arthur: Stress testing across broader journeys and components

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **nitpick-fix skill** (`~/.claude/skills/nitpick-fix/SKILL.md`): 15-step fix flow including issue fetch via DevRev API, screenshot analysis, React component chain search, theme config tracing, multi-step retry protocol. Core logic to adapt into the agent prompt template.
- **devrev-web-reference.md**: Encodes devrev-web-specific patterns (monorepo structure, Tailwind theme architecture, URL→feature mapping, DS bug patterns). Can be referenced directly in the agent prompt.
- **DevRev API client** (`src/service-worker/devrev-api.ts`): Already implements works.create with "nitpicked" tag auto-attachment. Issues created by the extension are already tagged for agent pickup.
- **mobius shell runner** (`run_daily_tech_debt_agent.sh`): 76-line template covering Bedrock auth, CLI installation, prompt injection. Can be adapted almost directly.

### Established Patterns
- **devrev-web pre-commit pipeline**: typecheck → circular deps → unit tests → translations check. Agent should run the same affected:typecheck and workspace-lint.
- **devrev-web branch naming**: `{type}/ISS-XXXX-description` — agent branches must follow this.
- **devrev-web PR template**: Full template required, non-applicable sections marked N/A. Agent uses `gh pr create` with the template.
- **`PRE_COMMIT_AUTO_RUN=1`**: Non-interactive commit flag for agents in devrev-web.
- **CircleCI contexts**: `github`, `aws-dev-account` for Bedrock, `snyk-integration` — same contexts available to the nitpick job.

### Integration Points
- **"nitpicked" tag in DevRev**: Extension auto-tags issues. Agent queries `tags.list` for issues with this tag.
- **DevRev webhooks**: Agent needs a webhook subscription for issue comment events to trigger re-runs.
- **CircleCI API**: Manual dispatch via CircleCI pipeline trigger API.
- **GitHub API**: Agent creates branches, commits, pushes, and opens draft PRs via `gh`.

</code_context>

<specifics>
## Specific Ideas

- The agent prompt should be an adaptation of the nitpick-fix skill, not a from-scratch rewrite. The skill's 15-step flow (fetch → screenshot analysis → cross-check → search → trace → fix options → fix → verify) is battle-tested.
- Self-review loop should follow mobius pattern: 2-3 rounds of hostile self-review against devrev-web's CLAUDE.md conventions, with verification between rounds.
- The "fix options" step (step 12 in nitpick-fix) maps naturally to posting a DevRev comment with 2-4 options — the agent already knows how to present choices.
- Draft PR should be created immediately with best-guess fix so the user sees real diffs alongside the options comment.
- Kapil's skills pattern (`.claude/skills/` in repos) should be leveraged — the nitpick agent prompt can reference devrev-web's existing skills for domain-specific patterns.

</specifics>

<deferred>
## Deferred Ideas

- **Full interactive streaming dashboard**: The original Supabase Realtime streaming layer with live agent token streaming. Moved to v2.x if the team wants richer UX beyond DevRev + GitHub.
- **Multi-repo support**: Agent currently targets devrev-web only. Each additional repo (mobius, flow) would need its own CircleCI job + prompt template. Per-repo `.nitpick.yml` config could standardize this.
- **Webhook auto-trigger on issue creation**: Currently cron + manual dispatch. A DevRev webhook that auto-triggers on nitpick-tagged issue creation (not just comments) is a natural v2.x enhancement.
- **Cross-repo context**: Divya flagged that errors often cross repo boundaries (service → gateway). A multi-repo agent session is out of scope for v2.0.
- **Figma plugin** (Arthur): Flagging DS discrepancies from Figma → DevRev issue creation. Separate product.
- **Quality metrics integration** (Anirudh): Auto-creating fix sessions from lowest-scoring computer sessions. Requires linking to quality metrics pipeline.

</deferred>

---

*Phase: 4-Foundation & Agent Core*
*Context gathered: 2026-05-03*
