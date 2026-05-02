# Phase 4: Foundation & Agent Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 04-Foundation & Agent Core
**Areas discussed:** Agent tool design, Supabase event schema, Repo targeting, Session lifecycle (+ architecture rethink triggered by mobius prior art)

---

## Agent Tool Design (pre-rethink)

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror skill | read_file, write_file, search_code (grep), list_files, run_check. Matches local skill. | ✓ |
| Minimal — no shell | read_file, write_file, search_code, list_files only | |
| Extended — add bash | All above plus sandboxed bash | |

**User's choice:** Mirror skill (Recommended)
**Notes:** This decision was made before the architecture pivot. Post-pivot, the CLI's built-in tools replace custom tool schemas entirely.

### run_check scope (pre-rethink)

| Option | Description | Selected |
|--------|-------------|----------|
| Type-check only | Just `tsc --noEmit` | ✓ |
| Type-check + lint | tsc + eslint | |
| Type-check + test suite | tsc + related tests | |

**User's choice:** Type-check only (Recommended)
**Notes:** Post-pivot, verification uses devrev-web's actual pipeline: `nx affected --target=typecheck` + `pnpm run workspace-lint`.

---

## Architecture Rethink (triggered by team Slack thread)

User shared screenshots of internal Slack discussion showing Divya's team already built a working Claude Code CLI agent on CircleCI for devrev/mobius (PRs #1523, #1524). Shanay suggested a cron-based approach for Nitpick. This triggered a complete rethink of Phase 4's architecture.

### Agent Runtime

| Option | Description | Selected |
|--------|-------------|----------|
| Claude Code CLI | Mirror mobius: shell script + prompt + `claude -p` via Bedrock | ✓ |
| Claude API (original) | Custom tool loop with streaming to Supabase | |
| Hybrid — CLI now, API later | CLI for batch, API for interactive sessions later | |

**User's choice:** Claude Code CLI
**Notes:** User asked "which would align with what everybody discussed?" — analysis showed all team members (Divya, Shanay, Kapil, Sunil) are building on the CLI pattern.

### CI Platform

| Option | Description | Selected |
|--------|-------------|----------|
| CircleCI | Same CI as devrev-web and mobius | ✓ |
| GitHub Actions | Original plan — separate from target repo's CI | |
| Either — you decide | Let researcher determine | |

**User's choice:** CircleCI

### Job Location

| Option | Description | Selected |
|--------|-------------|----------|
| Inside devrev-web | Add job to devrev-web's .circleci/config.yml | ✓ |
| Shared nitpick repo | Agent code in xorkavi/nitpick, clones target at runtime | |
| Inside each target repo | Each repo adds its own job with shared prompt template | |

**User's choice:** Inside devrev-web

### Interaction Model

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: DevRev + Draft PR | Agent posts options on DevRev AND creates draft PR with best-guess fix | ✓ |
| DevRev comments only | All interaction in DevRev, PR only after confirmation | |
| Custom dashboard (later) | Start hybrid, add dashboard as v2.x enhancement | |

**User's choice:** Hybrid: DevRev + Draft PR (Recommended)
**Notes:** User initially asked for clarification on how the draft PR would update based on DevRev comments. Confirmed: webhook re-triggers agent, agent reads reply, force-pushes updated fix to draft PR.

### Trigger Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Cron + manual dispatch | Hourly cron for auto-pickup + manual CircleCI trigger for on-demand | ✓ |
| Cron (hourly) | Check every hour, pick up one issue per run | |
| Webhook auto-trigger | DevRev webhook on issue creation → immediate CircleCI trigger | |

**User's choice:** Cron + manual dispatch

### Reply Pickup Loop

| Option | Description | Selected |
|--------|-------------|----------|
| DevRev webhook → CircleCI | Webhook fires on issue comment → triggers pipeline | ✓ |
| Next cron cycle | ~1 hour latency between reply and pickup | |
| Manual re-trigger | User manually kicks off pipeline after commenting | |

**User's choice:** DevRev webhook → CircleCI

### Dashboard Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal dashboard (v2.0) | Status page with issue list, PR links, CI logs. Read-only, arcade-gen. | ✓ |
| DevRev + GitHub is enough | No dashboard at all for v2.0 | |
| Full dashboard (original) | Interactive Next.js dashboard with Supabase | |

**User's choice:** Minimal dashboard (v2.0)
**Notes:** User clarified they want interactivity ("the agent should ask for opinions") but confirmed the hybrid DevRev+PR model satisfies this without a custom streaming dashboard.

### Verification Commands

User directed to check devrev-web repo directly rather than choosing from options. Found: pre-commit pipeline uses lint-staged + nx affected:typecheck + circular deps check + unit test validation + translations check.

### Roadmap Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh phase breakdown | New phases matching revised architecture | ✓ |
| Revise phase goals (keep 4-7) | Same numbers, updated goals | |

**User's choice:** Fresh phase breakdown

---

## Claude's Discretion

- Prompt template structure and content
- CircleCI job resource class and timeout
- Exact `--allowedTools` allowlist
- DevRev webhook implementation details

## Deferred Ideas

- Full interactive streaming dashboard (Supabase Realtime) → v2.x
- Multi-repo agent support → v2.x
- Webhook auto-trigger on issue creation (not just comments) → v2.x
- Cross-repo context for error tracing → v2.x (Divya flagged)
- Figma plugin for DS discrepancy detection → separate product (Arthur)
- Quality metrics pipeline integration → separate product (Anirudh)
