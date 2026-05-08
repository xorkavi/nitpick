---
phase: 05-devrev-webhook-reply-loop
plan: 02
subsystem: agent-runner-prompt
tags: [shell-runner, prompt-template, devrev-api, two-stage-agent, conversation-loop]
dependency_graph:
  requires: [04-01-PLAN (shell runner base), 04-02-PLAN (prompt template base)]
  provides: [two-stage-runner, conditional-prompt, devrev-comment-helper]
  affects: [05-03-PLAN (CircleCI config references runner), snap-in (triggers runner with MODE param)]
tech_stack:
  added: [post_devrev_comment.sh, timeline-entries.list, works.update]
  patterns: [two-stage-mode-injection, conditional-prompt-sections, mid-run-comment-posting, stage-field-transitions]
key_files:
  created:
    - devrev-web/scripts/circleci/post_devrev_comment.sh
  modified:
    - devrev-web/scripts/circleci/run_nitpick_fix_agent.sh
    - devrev-web/scripts/circleci/nitpick_fix_prompt.md
decisions:
  - "Used timeline-entries.list (hyphens) as the DevRev API endpoint URL while parsing .timeline_entries (underscores) from JSON response"
  - "Branch naming uses fix/ prefix per devrev-web CLAUDE.md conventions, replacing Phase 4 nitpick/ prefix"
  - "Analysis mode stays on main branch (no branch creation) per D-11; fix/revision modes create or checkout existing branch"
  - "Concurrency guard only applies in fix mode (revision is expected to push to existing branch)"
  - "Post-run stage updates are fire-and-forget (|| true) to prevent stage API failures from blocking agent completion"
metrics:
  duration: 7m 40s
  completed: "2026-05-08T00:51:32Z"
  tasks: 2/2
  files_created: 1
  files_modified: 2
---

# Phase 05 Plan 02: Two-Stage Agent Runner & Conditional Prompt Summary

Two-stage shell runner with MODE injection, timeline history fetch, stage transitions, and a conditional prompt template defining three distinct agent behavior profiles (analysis/fix/revision) for the DevRev conversation loop.

## What Was Built

### scripts/circleci/run_nitpick_fix_agent.sh (131 lines, full rewrite)

Replaces the Phase 4 single-pass runner with a two-stage orchestrator supporting analysis, fix, and revision modes:

- **MODE detection**: Reads `NITPICK_MODE` env var (default: analysis) injected by snap-in/CircleCI
- **Timeline history fetch**: Fetches full issue timeline via `timeline-entries.list` API, injects as JSON array into prompt
- **Stage transitions (D-31)**: Updates `nitpick_stage` custom field before run (Analyzing/Fixing/Revising) and after run (Awaiting choice/In review)
- **Branch management (D-16, D-37)**: Analysis stays on main; fix/revision creates or checks out `fix/{ISSUE_ID}-{short-desc}` branch
- **Concurrency guard (D-44)**: In fix mode, skips if PR already open for the branch
- **Agent invocation**: `claude -p` with `post_devrev_comment.sh` added to allowedTools for mid-run commenting
- **PR linking (D-34)**: Post-run posts PR URL to DevRev timeline
- **Error reporting (D-27, D-28)**: On failure, posts conversational error message with CircleCI log link

### scripts/circleci/post_devrev_comment.sh (22 lines, new)

Lightweight helper script callable by the agent via Bash tool during execution:

- Accepts 2 args: `ISSUE_ID` and markdown `BODY`
- POSTs to DevRev `timeline-entries.create` endpoint
- Uses `jq -Rs` for safe JSON encoding of arbitrary markdown content
- Authenticates via `DEVREV_PAT` from environment

### scripts/circleci/nitpick_fix_prompt.md (210 lines, full rewrite)

Conditional prompt template with three distinct behavior profiles selected by `${MODE}` variable:

- **Analysis mode**: Understand bug, find source, formulate 2-4 fix options with before/after code snippets, post to DevRev. Explicitly prohibited from creating branch or PR.
- **Fix mode**: Read user's natural language choice from conversation history, implement fix, self-review (3 rounds max), create draft PR, post PR link + preview URL, tag codeowners.
- **Revision mode**: Read latest feedback, post acknowledgment ("Looking into it..."), implement changes, push new commit (never force-push/amend), post updated preview URL.
- **Shared constraints**: 8 NEVER rules + 8 ALWAYS rules in CRITICAL section surviving context compaction
- **Reference sections**: URL-to-feature-area mapping, 8 common DS bug patterns

## Task Completion

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Shell runner + comment helper | `c21f95be9ca` | `run_nitpick_fix_agent.sh`, `post_devrev_comment.sh` |
| 2 | Conditional prompt template | `6af58c312ce` | `nitpick_fix_prompt.md` |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| # | Check | Result |
|---|-------|--------|
| 1 | Shell runner passes `bash -n` syntax validation | PASS |
| 2 | Helper script passes `bash -n` syntax validation | PASS |
| 3 | Prompt template contains all three MODE sections | PASS |
| 4 | All envsubst variables referenced (ISSUE_ID, TITLE, DESCRIPTION, MODE, TIMELINE, WORK_ID, BRANCH_NAME) | PASS |
| 5 | Branch naming uses `fix/` prefix (not `nitpick/`) | PASS |
| 6 | post_devrev_comment.sh in allowedTools list | PASS |
| 7 | No secrets hardcoded in any file | PASS |

## Threat Model Compliance

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-05-06 (Prompt injection via issue body) | Mitigated | envsubst only substitutes declared variables; issue content is data in "Issue Context" section |
| T-05-07 (Agent runaway) | Mitigated | `--max-turns 65` hard cap; post-run stage update ensures state transitions even on failure |
| T-05-08 (DEVREV_PAT in logs) | Mitigated | `set -euo pipefail` + `curl -sf`; no echo of env vars; PAT from CircleCI context |
| T-05-09 (Agent tool scope) | Mitigated | `--allowedTools` restricts to Read/Write/Edit/Grep/Glob + specific Bash patterns |
| T-05-10 (Agent actions untracked) | Accepted | Git commits + DevRev comments + CI logs provide audit trail |

## Known Stubs

None. All three files are complete and functional. The runner references the snap-in trigger (Plan 01) and CircleCI config (Plan 03) which handle pipeline invocation.

## Self-Check: PASSED

- [x] `scripts/circleci/run_nitpick_fix_agent.sh` exists in devrev-web
- [x] `scripts/circleci/post_devrev_comment.sh` exists in devrev-web
- [x] `scripts/circleci/nitpick_fix_prompt.md` exists in devrev-web
- [x] Commit `c21f95be9ca` found in git log (Task 1)
- [x] Commit `6af58c312ce` found in git log (Task 2)
- [x] `05-02-SUMMARY.md` exists in planning directory
