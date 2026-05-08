# Phase 5: DevRev Webhook & Reply Loop - Research

**Researched:** 2026-05-08
**Domain:** DevRev snap-in development (native events), CircleCI pipeline API integration, two-stage agent conversation loop
**Confidence:** HIGH

## Summary

This phase builds a DevRev snap-in that replaces the hourly cron with immediate event-driven triggers. The snap-in listens for `work_created` and `timeline_entry_created` native events, validates that issues are genuine nitpick submissions (tag + code identifiers + screenshots), and triggers CircleCI pipelines via API. The agent now operates in two stages: (1) analysis that posts fix options without creating a PR, and (2) fix/revision stages triggered by user replies. All communication happens conversationally on the DevRev issue timeline.

The snap-in follows the proven figma-validator pattern from `arcade/design-system/Scripts/figma-validator/`: manifest.yaml with native DevRev event sources, function-factory.ts exports, esbuild dual-output build, and local test server for development. The key architectural difference is that the figma-validator uses external webhooks (`flow-custom-webhook` type) while this snap-in uses native DevRev events (`devrev-webhook` type) for `work_created` and `timeline_entry_created`.

The implementation spans two repositories: (1) the snap-in code in `arcade/plugins/nitpick/snap-in/` handling event reception, validation, and CircleCI triggers, and (2) modifications to devrev-web for the shell runner (two-stage flow with MODE injection), prompt template (conditional analysis/fix/revision sections), and helper scripts for mid-run DevRev comment posting.

**Primary recommendation:** Build the snap-in as a thin event router (validate issue, determine mode, trigger pipeline) with all complex logic in the shell runner and agent prompt. Keep the snap-in itself as simple as possible -- it only needs to parse events, apply scope guards, and fire CircleCI API calls.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** DevRev snap-in using native DevRev events (`work:created` + `work:comment`), NOT external webhooks. Follows figma-validator pattern.
- **D-02:** Snap-in lives in `arcade/plugins/nitpick/snap-in/` -- same build pattern: esbuild -> `dist/`, `function-factory.ts` exports, `manifest.yaml`, `.devrev/repo.yml`.
- **D-03:** Immediate trigger on issue creation replaces hourly cron entirely. No cron fallback.
- **D-04:** Deploy via GitHub Actions marketplace workflow on PR merge.
- **D-05:** Validates ALL of: (a) has "nitpicked" tag, (b) body contains "### Code identifiers" section, (c) has screenshot artifacts.
- **D-06:** Validation failure -> post comment -> remove tag -> don't trigger.
- **D-07:** Issue body ends with "Made with [Nitpick](repo-link)" as marker (Chrome extension change).
- **D-08:** Single "Nitpick Bot" service account shared between snap-in and CI agent (same PAT).
- **D-09:** Loop guard: snap-in ignores comments where author == its own service account ID.
- **D-10:** "retry" / "try again" recognized as keywords to re-trigger a failed run.
- **D-11:** Stage 1 (Analysis): Agent posts root cause + 2-4 fix options. No PR.
- **D-12:** Stage 2 (Fix): Triggered by user reply. Agent reads choice, implements fix, creates PR.
- **D-13:** Stage 3+ (Revision): User requests changes -> agent fixes, pushes new commit.
- **D-14:** Fix options format: root cause (1 line) + numbered options with before/after snippets.
- **D-15:** All user replies processed as natural language. Not a number parser.
- **D-16:** Branch naming: `fix/ISS-XXXX-short-description` (per devrev-web CLAUDE.md).
- **D-17:** PR created following `/create-pr` skill pattern with full template.
- **D-18:** Preview URL posted: `https://devrev-web-<PR_NUMBER>.e2e.dev.devrev-eng.ai`.
- **D-19-D-26:** Conversational bot comment templates at each stage.
- **D-27-D-28:** Error handling: explain what went wrong, include CircleCI log link.
- **D-29:** Per-issue cap: max 5 total runs.
- **D-30-D-34:** Nitpick stage custom field lifecycle + DevRev work item link API.
- **D-35-D-38:** Fresh run with full comment history injected. Git as memory for revisions.
- **D-39-D-41:** Single prompt template with conditional sections. MODE injection by shell runner.
- **D-42-D-44:** Separate CircleCI pipeline per issue. Concurrency guard.
- **D-45-D-46:** CircleCI API token in DevRev keyring. Project slug as org input.
- **D-47-D-49:** CODEOWNERS integration for tagging reviewers.
- **D-50-D-52:** Testing: ngrok + real DevRev org, local snap-in-server, unit tests for filtering.

### Claude's Discretion
- Helper script implementation details (how it authenticates to DevRev API)
- Exact CircleCI API calls for pipeline trigger and sandbox gate approval
- Comment markdown formatting details
- Metrics logging format and storage
- How to parse CODEOWNERS file for path matching

### Deferred Ideas (OUT OF SCOPE)
- Multi-repo support
- Auto-merge after codeowner approval
- Slack notifications
- Batch fix sessions
- Real-time streaming dashboard
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DREV-01 | Agent posts 2-4 fix options as a DevRev issue comment with code context | DevRev `timeline_entries.create` API, service account token at `context.secrets.service_account_token`, helper script `post_devrev_comment.sh` in agent's allowedTools |
| DREV-02 | DevRev webhook subscription on issue comment events triggers CircleCI pipeline re-run | Native `timeline_entry_created` event in snap-in manifest, CircleCI pipeline trigger API (`POST /api/v2/project/{slug}/pipeline`), mode detection from nitpick_stage field |
| DREV-03 | Agent reads user reply from DevRev issue, updates draft PR with revised fix direction | Shell runner fetches all timeline entries via `timeline_entries.list?object={issue_id}`, injects as COMMENT_HISTORY into prompt, agent processes natural language direction |
| DREV-04 | Issue status transitions: triage -> in development -> completed | Shell runner calls `works.update` with stage changes, completion via DevRev automation rule on linked PR merge |
| DREV-05 | PR link added to DevRev issue timeline when draft PR is created | Agent posts comment with PR URL via helper script + DevRev link API for formal association |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Event reception (work_created, timeline_entry_created) | DevRev Snap-in | -- | Platform delivers native events to registered functions |
| Issue validation (scope guard) | DevRev Snap-in | -- | Must filter before triggering expensive CI pipelines |
| CircleCI pipeline triggering | DevRev Snap-in | -- | HTTP POST to CircleCI API from within snap-in function |
| Loop guard (ignore own comments) | DevRev Snap-in | -- | Compare event author to service account ID at event level |
| Mode detection (analysis/fix/revision) | Shell Runner (CI) | DevRev Snap-in (hint) | Snap-in passes issue context; runner reads nitpick_stage + comment history to determine mode |
| Comment history retrieval | Shell Runner (CI) | -- | Fetches full timeline before invoking agent |
| Agent execution (analysis/fix/revision) | CI Runner (CircleCI) | -- | Claude Code CLI with mode-conditional prompt |
| Mid-run comment posting | Agent (via Bash tool) | -- | Helper script `post_devrev_comment.sh` in allowedTools |
| PR creation and preview URL | Agent (via gh CLI) | Shell Runner (post-run) | Agent creates PR; runner approves sandbox gate and posts preview URL |
| Stage field updates | Shell Runner (CI) | -- | Runner updates nitpick_stage at each transition |
| CODEOWNERS lookup | Agent (in-process) | -- | Agent reads `.github/CODEOWNERS` and parses for affected paths |
| Conversational comments | Shell Runner + Agent | -- | Runner posts start/completion messages; agent posts analysis/fix results |

## Standard Stack

### Core (Snap-in)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.0 | Snap-in implementation language | [VERIFIED: figma-validator/code/package.json] Same as figma-validator |
| esbuild | ^0.28.0 | Dual-output build (dist/index.cjs + dist/functions/) | [VERIFIED: npm registry] Required by DevRev platform for snap-in packaging |
| zod | ^4.4.3 | Event payload validation schemas | [VERIFIED: npm registry] Used in figma-validator for payload parsing |
| express | ^5.2.1 | Local test server (snap-in-server.ts) | [VERIFIED: npm registry] Used in figma-validator for ngrok-based local testing |
| tsx | ^4.21.0 | TypeScript execution for dev/test | [VERIFIED: npm registry] Dev dependency from figma-validator pattern |

### Core (Shell Runner / devrev-web)
| Library/Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-code | Latest (runtime install) | CLI agent runtime | [VERIFIED: Phase 4 research] `claude -p` with mode-conditional prompt |
| curl | System | DevRev API calls from shell runner | Pre-installed in CI images; used for timeline_entries.list, works.update |
| jq | System | JSON parsing of API responses | [ASSUMED] Pre-installed in cimg/node; parses DevRev timeline data |
| envsubst | System | Prompt template variable injection | [ASSUMED] Used by Phase 4 pattern for MODE, COMMENT_HISTORY, METADATA substitution |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @biomejs/biome | ^2.4.14 | Linting for snap-in code | [VERIFIED: npm registry] Matches figma-validator pattern |
| rimraf | ^6.0.0 | Clean dist/ before builds | [VERIFIED: figma-validator] Required for reliable builds |
| dotenv | ^16.0.3 | Local development env loading | For `.env` with DEVREV_PAT during local testing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native DevRev events | External webhook (flow-custom-webhook) | External webhooks require Rego policy + custom event keys; native events are simpler for DevRev-native events |
| Service account for all automation | Separate snap-in token + CI token | Single identity simplifies loop guard (D-08); one PAT to manage |
| curl in shell runner | DevRev Node.js SDK | Shell runner is bash; adding Node dependency just for API calls adds complexity without benefit |

**Installation (snap-in):**
```bash
cd arcade/plugins/nitpick/snap-in/code
npm install typescript esbuild zod express dotenv tsx rimraf @biomejs/biome --save-dev
npm install zod express dotenv
```

## Architecture Patterns

### System Architecture Diagram

```
     User files issue via Chrome Extension
                    |
                    v
     DevRev (issue with "nitpicked" tag)
     +----------------------------------+
     | work_created event               |
     +----------------+-----------------+
                      |
                      v
     Snap-in Function (handle_nitpick_event)
     +----------------------------------+
     | 1. Loop guard (author != self)   |
     | 2. Validate: tag + body + images |
     | 3. Determine mode (from stage)   |
     | 4. Trigger CircleCI pipeline     |
     | 5. Post "looking into it..." msg |
     | 6. Update nitpick_stage field    |
     +----------------+-----------------+
                      |
                      | POST /api/v2/project/{slug}/pipeline
                      v
     CircleCI (per-issue pipeline)
     +----------------------------------+
     | run_nitpick_fix_agent.sh         |
     | - Fetch issue + timeline history |
     | - Detect MODE (analysis/fix/rev) |
     | - Inject into prompt template    |
     | - Invoke claude -p               |
     | - Post results to DevRev         |
     | - Update nitpick_stage           |
     +----------------+-----------------+
                      |
           +----------+----------+
           |                     |
     MODE=analysis          MODE=fix/revision
           |                     |
           v                     v
     Post fix options      Create/update PR
     (no PR created)       Post PR + preview URL
           |                     |
           v                     v
     Set stage:            Set stage:
     "Awaiting choice"     "In review"
           |                     |
           v                     v
     User replies  <------  User requests revision
     (timeline_entry_created)
           |
           v
     Snap-in re-triggers CircleCI
     (loop continues until PR merges or cap hit)
```

### Recommended Project Structure

```
arcade/plugins/nitpick/snap-in/
+-- manifest.yaml                    # Snap-in config (events, keyrings, inputs, functions)
+-- .devrev/
|   +-- repo.yml                     # deployable: true
+-- code/
|   +-- package.json                 # Build scripts, dependencies
|   +-- tsconfig.json                # TypeScript config
|   +-- src/
|   |   +-- index.ts                 # Re-exports functionFactory
|   |   +-- function-factory.ts      # Registers all snap-in functions
|   |   +-- functions/
|   |   |   +-- handle_nitpick_event/
|   |   |       +-- index.ts         # Main event handler (validation, routing, trigger)
|   |   +-- lib/
|   |   |   +-- devrev-api.ts        # DevRev API helpers (post comment, update work, list timeline)
|   |   |   +-- circleci-api.ts      # CircleCI trigger + sandbox gate approval
|   |   |   +-- validation.ts        # Issue validation logic (tag, body, artifacts)
|   |   |   +-- mode-detection.ts    # Determine analysis/fix/revision from stage + history
|   |   +-- snap-in-server.ts        # Local test server (Express, /handle/async)
|   |   +-- types.ts                 # Shared type definitions
|   +-- dist/                        # Built output (gitignored)

arcade/devrev-web/scripts/circleci/  # (to be created on feature branch)
+-- run_nitpick_fix_agent.sh         # Shell runner (MODE-aware, two-stage)
+-- nitpick_fix_prompt.md            # Prompt template (conditional sections)
+-- post_devrev_comment.sh           # Helper: post comment to DevRev from agent
+-- query_nitpick_issues.sh          # REMOVED (replaced by snap-in trigger)
```

### Pattern 1: Snap-in Manifest with Native DevRev Events
**What:** manifest.yaml configuring `devrev-webhook` type event sources for `work_created` and `timeline_entry_created`.
**When to use:** This is the snap-in's core configuration.
**Example:**
```yaml
# Source: developer.devrev.ai/snapin-development/references/event-sources [VERIFIED]
version: "2"
name: Nitpick Bot
description: Listens for nitpick-tagged issues, validates them, and triggers fix pipelines.

service_account:
  display_name: Nitpick Bot

keyrings:
  organization:
    - name: circleci_token
      display_name: CircleCI API Token
      description: API token for triggering CircleCI pipelines.
      types:
        - snap_in_secret

inputs:
  organization:
    - name: circleci_project_slug
      description: >
        CircleCI project slug in format: gh/org-name/repo-name
        (e.g., gh/devrev/devrev-web)
      field_type: text
      is_required: true
      ui:
        display_name: CircleCI Project Slug

    - name: circleci_branch
      description: >
        Branch to trigger pipelines on (usually main).
      field_type: text
      is_required: true
      default_value: main
      ui:
        display_name: CircleCI Pipeline Branch

event_sources:
  organization:
    - name: devrev-webhook
      display_name: DevRev Events
      type: devrev-webhook
      config:
        event_types:
          - work_created
          - timeline_entry_created

functions:
  - name: handle_nitpick_event
    description: Validates nitpick issues and triggers CircleCI fix pipelines.

automations:
  - name: nitpick_work_created
    source: devrev-webhook
    event_types:
      - work_created
    function: handle_nitpick_event

  - name: nitpick_comment_created
    source: devrev-webhook
    event_types:
      - timeline_entry_created
    function: handle_nitpick_event
```

### Pattern 2: Event Handler with Validation and Loop Guard
**What:** The main snap-in function that validates events and routes to CircleCI.
**When to use:** Every incoming event hits this handler.
**Example:**
```typescript
// Source: figma-validator pattern + DevRev event docs [VERIFIED]
import { validateIssue } from '../../lib/validation';
import { triggerPipeline } from '../../lib/circleci-api';
import { postComment, updateWork, listTimeline } from '../../lib/devrev-api';
import { detectMode } from '../../lib/mode-detection';

export const run = async (events: any[]) => {
  for (const event of events) {
    try {
      const serviceAccountToken = event.context?.secrets?.service_account_token;
      const devrevEndpoint = event.execution_metadata?.devrev_endpoint || 'https://api.devrev.ai';
      const keyrings = event.input_data?.keyrings;
      const globalValues = event.input_data?.global_values;

      const circleciToken = keyrings?.circleci_token as string;
      const projectSlug = globalValues?.circleci_project_slug as string;
      const branch = globalValues?.circleci_branch || 'main';

      if (!serviceAccountToken || !circleciToken || !projectSlug) {
        console.error('[nitpick] Missing required configuration');
        continue;
      }

      const eventType = event.execution_metadata?.event_type;
      const payload = event.payload;

      if (eventType === 'work_created') {
        await handleWorkCreated(payload, { serviceAccountToken, circleciToken, projectSlug, branch, devrevEndpoint });
      } else if (eventType === 'timeline_entry_created') {
        await handleCommentCreated(payload, { serviceAccountToken, circleciToken, projectSlug, branch, devrevEndpoint });
      }
    } catch (err) {
      console.error('[nitpick] Error:', err instanceof Error ? err.message : String(err));
    }
  }
};

async function handleWorkCreated(payload: any, config: Config) {
  const work = payload.work_created?.work;
  if (!work || work.type !== 'issue') return;

  // Validation (D-05)
  const validation = validateIssue(work);
  if (!validation.valid) {
    // D-06: Post comment and remove tag
    await postComment(config.serviceAccountToken, config.devrevEndpoint, work.id,
      "This doesn't look like it was filed through the Nitpick extension. Was the nitpicked tag added by mistake? Removing it for now.");
    // Remove tag via works.update
    return;
  }

  // Trigger analysis pipeline
  await postComment(config.serviceAccountToken, config.devrevEndpoint, work.id,
    "Nitpick Bot is looking into this... will post fix options soon");
  await triggerPipeline(config.circleciToken, config.projectSlug, config.branch, {
    nitpick_issue_id: work.display_id,
    nitpick_mode: 'analysis'
  });
}

async function handleCommentCreated(payload: any, config: Config) {
  const entry = payload.timeline_entry_created?.entry;
  if (!entry) return;

  // D-09: Loop guard -- ignore own comments
  const serviceAccountId = event.context?.dev_oid;
  if (entry.created_by?.id === serviceAccountId) return;

  // Determine mode from stage + content
  const mode = await detectMode(config.serviceAccountToken, config.devrevEndpoint, entry.object);

  await triggerPipeline(config.circleciToken, config.projectSlug, config.branch, {
    nitpick_issue_id: entry.object_display_id,
    nitpick_mode: mode
  });
}
```

### Pattern 3: CircleCI Pipeline Trigger
**What:** HTTP call to trigger a CircleCI pipeline with parameters for issue ID and mode.
**When to use:** From snap-in function after validation passes.
**Example:**
```typescript
// Source: circleci.com/docs/api/v2 [VERIFIED]
export async function triggerPipeline(
  token: string,
  projectSlug: string,
  branch: string,
  parameters: { nitpick_issue_id: string; nitpick_mode: string }
): Promise<void> {
  const response = await fetch(
    `https://circleci.com/api/v2/project/${projectSlug}/pipeline`,
    {
      method: 'POST',
      headers: {
        'Circle-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ branch, parameters }),
    }
  );

  if (!response.ok) {
    throw new Error(`CircleCI trigger failed: ${response.status} ${await response.text()}`);
  }
}
```

### Pattern 4: Shell Runner Two-Stage Flow (MODE-aware)
**What:** Enhanced shell runner that detects mode, fetches comment history, and injects into prompt.
**When to use:** Every CircleCI pipeline invocation.
**Example:**
```bash
#!/usr/bin/env bash
# Source: Phase 4 run_nitpick_fix_agent.sh pattern (to be recreated on feature branch)
set -euo pipefail

ISSUE_ID="${NITPICK_ISSUE_ID:?'Required'}"
MODE="${NITPICK_MODE:-analysis}"  # analysis | fix | revision
PROMPT_FILE="scripts/circleci/nitpick_fix_prompt.md"
MAX_TURNS=65

# --- Fetch issue + full timeline history ---
ISSUE_DATA=$(curl -s "https://api.devrev.ai/works.get?id=${ISSUE_ID}" \
  -H "Authorization: ${DEVREV_PAT}")
TITLE=$(echo "${ISSUE_DATA}" | jq -r '.work.title // ""')
DESCRIPTION=$(echo "${ISSUE_DATA}" | jq -r '.work.body // ""')

# Fetch ALL timeline entries for context injection (D-36)
TIMELINE=$(curl -s -X GET \
  "https://api.devrev.ai/timeline_entries.list?object=${ISSUE_ID}" \
  -H "Authorization: ${DEVREV_PAT}" | jq '[.timeline_entries[] | {body, created_by: .created_by.display_name, created_date}]')

# --- Update nitpick_stage (D-31) ---
case "${MODE}" in
  analysis) STAGE="Analyzing" ;;
  fix)      STAGE="Fixing" ;;
  revision) STAGE="Revising" ;;
esac
curl -s -X POST "https://api.devrev.ai/works.update" \
  -H "Authorization: ${DEVREV_PAT}" \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"${WORK_ID}\", \"custom_fields\": {\"nitpick_stage\": \"${STAGE}\"}}"

# --- For revisions: checkout existing branch (D-37) ---
if [ "${MODE}" = "revision" ]; then
  BRANCH_NAME="fix/${ISSUE_ID}-$(echo ${TITLE} | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | head -c 30)"
  git checkout "${BRANCH_NAME}" 2>/dev/null || git checkout -b "${BRANCH_NAME}"
fi

# --- Inject into prompt ---
export ISSUE_ID TITLE DESCRIPTION MODE TIMELINE
PROMPT=$(envsubst '${ISSUE_ID} ${TITLE} ${DESCRIPTION} ${MODE} ${TIMELINE}' < "${PROMPT_FILE}")

# --- Run agent ---
claude -p "${PROMPT}" \
  --model sonnet \
  --max-turns "${MAX_TURNS}" \
  --permission-mode bypassPermissions \
  --allowedTools "Read" "Grep" "Glob" "Edit" "Write" \
    "Bash(pnpm run workspace-lint *)" "Bash(pnpm run affected:typecheck *)" \
    "Bash(git add *)" "Bash(git commit *)" "Bash(git push *)" \
    "Bash(git diff *)" "Bash(git log *)" "Bash(git status *)" \
    "Bash(git checkout *)" "Bash(git branch *)" \
    "Bash(gh pr create *)" "Bash(gh pr view *)" "Bash(gh pr edit *)" \
    "Bash(nx affected *)" \
    "Bash(bash scripts/circleci/post_devrev_comment.sh *)" \
  --output-format json \
  --verbose
```

### Pattern 5: Mid-Run Comment Helper Script
**What:** Lightweight bash script the agent calls to post comments to DevRev during execution.
**When to use:** Agent posts analysis results, fix options, PR links, revision updates mid-run.
**Example:**
```bash
#!/usr/bin/env bash
# scripts/circleci/post_devrev_comment.sh
# Usage: bash scripts/circleci/post_devrev_comment.sh "ISS-12345" "Comment body here"
# Source: DevRev timeline_entries.create API [VERIFIED]
set -euo pipefail

ISSUE_ID="$1"
BODY="$2"

curl -s -X POST "https://api.devrev.ai/timeline-entries.create" \
  -H "Authorization: ${DEVREV_PAT}" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"timeline_comment\",
    \"object\": \"${ISSUE_ID}\",
    \"body\": $(echo "${BODY}" | jq -Rs .),
    \"visibility\": \"external\"
  }"
```

### Pattern 6: Sandbox Gate Approval
**What:** After PR is created, approve the `deploy-to-sandbox-gate` job in CircleCI for preview deployment.
**When to use:** After agent creates PR and pushes (fix/revision modes).
**Example:**
```bash
# Source: circleci.com/docs/api/v2 workflow approve endpoint [VERIFIED]
# 1. Get workflow ID from the pipeline triggered by the PR push
PIPELINE_ID=$(curl -s "https://circleci.com/api/v2/project/${PROJECT_SLUG}/pipeline?branch=${BRANCH}" \
  -H "Circle-Token: ${CIRCLE_TOKEN}" | jq -r '.items[0].id')

# 2. Get workflow from pipeline
WORKFLOW_ID=$(curl -s "https://circleci.com/api/v2/pipeline/${PIPELINE_ID}/workflow" \
  -H "Circle-Token: ${CIRCLE_TOKEN}" | jq -r '.items[0].id')

# 3. Find the pending approval job
APPROVAL_ID=$(curl -s "https://circleci.com/api/v2/workflow/${WORKFLOW_ID}/job" \
  -H "Circle-Token: ${CIRCLE_TOKEN}" | jq -r '.items[] | select(.name == "deploy-to-sandbox-gate" and .status == "on_hold") | .approval_request_id')

# 4. Approve it
curl -s --request POST \
  "https://circleci.com/api/v2/workflow/${WORKFLOW_ID}/approve/${APPROVAL_ID}" \
  -H "Circle-Token: ${CIRCLE_TOKEN}"
```

### Anti-Patterns to Avoid
- **Putting business logic in the snap-in:** The snap-in should be a thin router. All analysis, fix generation, and PR management belongs in the agent running on CI. The snap-in just validates and triggers.
- **Polling for pipeline status from snap-in:** The snap-in fires-and-forgets. The shell runner posts results directly to DevRev when done. No polling loop needed.
- **Using `flow-custom-webhook` for DevRev native events:** Native events (`work_created`, `timeline_entry_created`) use `type: devrev-webhook`. External webhooks (like Figma) use `type: flow-custom-webhook`. Wrong type = events never arrive.
- **Forgetting dual esbuild output:** Platform needs BOTH `dist/index.cjs` (runtime entry) AND `dist/functions/handle_nitpick_event/index.js` (discovery). Missing either = deployment failure. [VERIFIED: figma-validator/snap-in-deploy-faq.md]
- **Treating keyrings as nested objects:** DevRev injects keyring values as raw strings, not `{access_token: "..."}`. Access directly: `keyrings.circleci_token` as string. [VERIFIED: figma-validator/snap-in-deploy-faq.md]
- **Creating the PR during analysis mode:** D-11 explicitly states NO PR during analysis. The agent explains and presents options only. PR creation happens in fix mode after user picks a direction.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event filtering | Custom webhook server | DevRev native event sources | Platform handles subscription, delivery, retry. Snap-in just processes. |
| Snap-in deployment | Manual CLI + artifact upload | `devrev/github-actions/create-marketplace-submission` Action | Handles version creation, artifact packaging, marketplace submission on PR merge. [VERIFIED: create-marketplace-submission.yml] |
| Pipeline concurrency | Custom queue/lock service | Stage field check + branch existence guard | If `nitpick_stage != Awaiting choice` AND branch already exists with open PR, skip. Sufficient for per-issue volume. |
| CODEOWNERS parsing | Custom glob-to-owner mapper | Standard CODEOWNERS format (line = pattern + owners) | Simple line parsing with glob matching. File is <50 lines. No library needed. |
| Comment loop prevention | Complex message tracking | Service account ID comparison (D-09) | One comparison: `entry.created_by.id === ownServiceAccountId`. Trivial and bulletproof. |
| Issue validation | Complex ML classifier | String checks: tag presence + body regex + artifact array | Three simple checks. "### Code identifiers" is a unique substring. Artifacts array non-empty. |

**Key insight:** The snap-in is intentionally thin. It validates, determines mode, and fires a pipeline. All intelligence lives in the Claude Code agent running on CI. This separation means snap-in deployments are rare and low-risk, while the agent prompt can iterate rapidly without redeployment.

## Common Pitfalls

### Pitfall 1: Event payload structure mismatch
**What goes wrong:** Snap-in fails to extract work item data from the event.
**Why it happens:** `work_created` wraps the work in `payload.work_created.work`, while `timeline_entry_created` uses `payload.timeline_entry_created.entry`. Different nesting for each event type.
**How to avoid:** Use separate handlers for each event type with explicit payload destructuring. Validate with zod schemas. [VERIFIED: developer.devrev.ai event sources docs]
**Warning signs:** `Cannot read properties of undefined` errors in snap-in logs.

### Pitfall 2: Loop guard false negatives
**What goes wrong:** Bot comment triggers itself, creating an infinite trigger loop.
**Why it happens:** The `created_by` field on timeline entries may use different ID formats (internal ID vs display ID vs email).
**How to avoid:** Use `event.context.dev_oid` (the snap-in's service account ID) and compare against `entry.created_by.id` (not `.display_name` or `.email`). Test with real events via ngrok. [CITED: D-09, event structure docs]
**Warning signs:** Multiple pipeline triggers in quick succession for the same issue with no user interaction.

### Pitfall 3: Dual dist output missing
**What goes wrong:** Snap-in version creation succeeds but function never gets invoked.
**Why it happens:** Platform scans `dist/functions/` to discover function names at build time, then loads via `package.json` main field at runtime. Missing either path = silent failure.
**How to avoid:** esbuild script must produce BOTH `dist/index.cjs` (from `src/index.ts`) AND `dist/functions/handle_nitpick_event/index.js` (from `src/functions/handle_nitpick_event/index.ts`). [VERIFIED: figma-validator/snap-in-deploy-faq.md]
**Warning signs:** Version deploys successfully but no events trigger the function. Check snap-in logs for "function not found" errors.

### Pitfall 4: CircleCI pipeline parameter limits
**What goes wrong:** Pipeline trigger returns 400 error.
**Why it happens:** CircleCI limits parameter values to 512 characters and keys to 128 characters. If comment history or issue body is passed as a pipeline parameter, it will exceed limits.
**How to avoid:** Only pass `nitpick_issue_id` (string) and `nitpick_mode` (string) as pipeline parameters. The shell runner fetches the full issue data and timeline directly from DevRev API at execution time. [VERIFIED: CircleCI API docs]
**Warning signs:** 400 responses from CircleCI API with "parameter value too long" message.

### Pitfall 5: Service account token expiry during long runs
**What goes wrong:** DevRev API calls from the shell runner fail with 401 mid-execution.
**Why it happens:** DevRev service account tokens have a limited validity window (30 min noted in testing docs). A long agent run (65 turns, 20+ minutes) may outlast the token.
**How to avoid:** Use the DEVREV_PAT from CircleCI context (a long-lived personal access token) for shell runner API calls, NOT the snap-in's service account token. The snap-in uses its own token for immediate calls; the CI job uses the PAT. [CITED: DevRev locally-testing docs mention 30-min token validity]
**Warning signs:** Agent successfully starts but later `post_devrev_comment.sh` calls return 401.

### Pitfall 6: Missing "Made with Nitpick" marker on existing issues
**What goes wrong:** Snap-in rejects valid nitpick issues because the Chrome extension hasn't been updated yet with D-07.
**Why it happens:** D-07 adds a new marker to the extension, but existing issues filed before the update won't have it.
**How to avoid:** Do NOT make "Made with Nitpick" a required validation criterion. The three required checks are: (a) nitpicked tag, (b) "### Code identifiers" section, (c) screenshots. The marker is an additional signal but not required for validation. Extension update for D-07 is a separate task.
**Warning signs:** All validation fails despite issues clearly being from Nitpick.

### Pitfall 7: Branch naming conflict between Phase 4 and Phase 5
**What goes wrong:** Agent creates branch with wrong prefix, PR title check fails.
**Why it happens:** Phase 4 used `nitpick/ISS-XXXX-description` prefix; Phase 5 changes to `fix/ISS-XXXX-short-description` per devrev-web CLAUDE.md conventions (D-16).
**How to avoid:** Shell runner constructs branch name with `fix/` prefix. Agent prompt explicitly states the branch naming convention. PR title must match regex: `^(fix|feat|test|refactor|chore|docs|perf|build)\(([a-zA-Z,\-\d]+|\*)\)!?:\s[a-z][a-zA-Z\d\s-,]+$`. [VERIFIED: pr-title-check.js]
**Warning signs:** CI rejects PRs with "Invalid PR Title" error.

## Code Examples

### DevRev API: Create timeline comment
```typescript
// Source: developer.devrev.ai/api-reference/timeline-entries/create [VERIFIED]
export async function postComment(
  token: string,
  endpoint: string,
  objectId: string,
  body: string
): Promise<void> {
  const response = await fetch(`${endpoint}/timeline-entries.create`, {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'timeline_comment',
      object: objectId,
      body,
      visibility: 'external',
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to post comment: ${response.status}`);
  }
}
```

### DevRev API: List timeline entries for an issue
```typescript
// Source: developer.devrev.ai/api-reference/timeline-entries/list [VERIFIED]
export async function listTimeline(
  token: string,
  endpoint: string,
  objectId: string
): Promise<TimelineEntry[]> {
  const response = await fetch(
    `${endpoint}/timeline-entries.list?object=${objectId}`,
    { headers: { 'Authorization': token } }
  );
  const data = await response.json();
  return data.timeline_entries || [];
}
```

### DevRev API: Update work item (stage + custom field)
```typescript
// Source: developer.devrev.ai/api-reference/works/update [VERIFIED]
export async function updateWork(
  token: string,
  endpoint: string,
  workId: string,
  updates: { stage?: string; customFields?: Record<string, string> }
): Promise<void> {
  const body: any = { id: workId };
  if (updates.stage) {
    body.stage = { name: updates.stage };
  }
  if (updates.customFields) {
    body.custom_fields = updates.customFields;
  }
  await fetch(`${endpoint}/works.update`, {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
```

### Issue Validation Logic
```typescript
// Source: CONTEXT.md D-05 [VERIFIED: project decisions]
interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateIssue(work: any): ValidationResult {
  // (a) Has "nitpicked" tag
  const hasTag = work.tags?.some((t: any) =>
    t.tag?.name === 'nitpicked' || t.name === 'nitpicked'
  );
  if (!hasTag) return { valid: false, reason: 'Missing nitpicked tag' };

  // (b) Body contains "### Code identifiers" section
  const body = work.body || '';
  if (!body.includes('### Code identifiers')) {
    return { valid: false, reason: 'Missing Code identifiers section' };
  }

  // (c) Has screenshot artifacts
  const hasArtifacts = (work.artifacts?.length ?? 0) > 0;
  if (!hasArtifacts) {
    // Also check for inline images in body
    const hasInlineImages = /!\[.*?\]\(https?:\/\/.*?\)/.test(body);
    if (!hasInlineImages) {
      return { valid: false, reason: 'No screenshot artifacts' };
    }
  }

  return { valid: true };
}
```

### Mode Detection Logic
```typescript
// Source: CONTEXT.md D-41 [VERIFIED: project decisions]
export async function detectMode(
  token: string,
  endpoint: string,
  workId: string
): Promise<'analysis' | 'fix' | 'revision'> {
  // Primary: read nitpick_stage field
  const response = await fetch(`${endpoint}/works.get?id=${workId}`, {
    headers: { 'Authorization': token }
  });
  const data = await response.json();
  const stage = data.work?.custom_fields?.nitpick_stage;

  switch (stage) {
    case 'Awaiting choice':
      return 'fix';       // User replied with their choice
    case 'In review':
    case 'Revising':
      return 'revision';  // User wants changes to existing PR
    default:
      return 'analysis';  // Fresh issue or unknown state
  }
}
```

### Esbuild Config (dual output)
```json
// Source: figma-validator/code/package.json [VERIFIED]
{
  "scripts": {
    "build": "rimraf ./dist && esbuild src/index.ts --bundle --outfile=dist/index.cjs --platform=node --target=node18 --format=cjs && esbuild src/functions/handle_nitpick_event/index.ts --bundle --outfile=dist/functions/handle_nitpick_event/index.js --platform=node --target=node18 --format=cjs",
    "package": "tar -cvzf build.tar.gz dist package.json package-lock.json",
    "test:server": "tsx watch src/snap-in-server.ts"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hourly cron query (Phase 4 D-08) | Immediate snap-in event trigger (Phase 5 D-03) | 2026-05 | Issues processed in seconds, not up to 60 minutes |
| Best-guess PR immediately (Phase 4 D-11) | Two-stage: analysis first, PR only after user choice (Phase 5 D-11/D-12) | 2026-05 | Higher fix accuracy, user maintains control over direction |
| `nitpick/ISS-XXXX-description` branches | `fix/ISS-XXXX-short-description` branches (D-16) | 2026-05 | Aligns with devrev-web CLAUDE.md convention for fix branches |
| Single agent run per issue | Up to 5 runs per issue (analysis + fix + revisions) | 2026-05 | Iterative refinement based on user feedback |
| DevRev CLI for snap-in deploy | GitHub Actions marketplace workflow | Current | Automated deployment on PR merge, no manual CLI steps |

**Deprecated/outdated:**
- `query_nitpick_issues.sh` (Phase 4): Replaced by snap-in trigger. No more polling.
- `nitpick/` branch prefix: Changed to `fix/` to match devrev-web conventions.
- Draft PR on first run: Replaced by analysis-only first stage.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DevRev `works.update` accepts `custom_fields` as a flat object with field name keys | Code Examples | Medium -- exact format for dropdown custom fields may differ. Test against real API. |
| A2 | `timeline_entry_created` event payload includes `created_by.id` that matches `context.dev_oid` for loop guard | Common Pitfalls | High -- if IDs don't match format, loop guard fails. Must verify with real event during ngrok testing. |
| A3 | CircleCI pipeline parameters `nitpick_issue_id` and `nitpick_mode` can be added without modifying existing config.yml setup routing | Architecture Patterns | Medium -- may need to add parameter declarations to the setup config or use a separate scheduled pipeline definition. |
| A4 | `jq` and `envsubst` are pre-installed in `cimg/node:22.22` CircleCI image | Shell Runner | Low -- easy to add installation step if missing. |
| A5 | DevRev `tags` field in `works.update` supports removal semantics (not just set-all) | Code Examples | Medium -- may need to fetch current tags, filter, and set all remaining tags. Test against API. |
| A6 | The `deploy-to-sandbox-gate` approval can be automated via CircleCI API with the same token used for pipeline triggers | Pattern 6 | Medium -- may require a different token or elevated permissions for workflow approvals. |

## Open Questions

1. **DevRev works.update tag removal semantics**
   - What we know: Tags can be updated via `works.update`. The response shows tags as array of objects.
   - What's unclear: Whether the API uses set semantics (replace all) or add/remove semantics. For D-06, we need to remove the "nitpicked" tag specifically.
   - Recommendation: Test against the real API during development. Worst case: fetch current tags, filter out "nitpicked", and PUT the remaining set.

2. **Service account ID format for loop guard**
   - What we know: `context.dev_oid` provides the snap-in's identity. `timeline_entry_created` includes `created_by`.
   - What's unclear: Whether the ID formats match exactly (both DON IDs? One is display_id?).
   - Recommendation: During ngrok testing, log both values to confirm format. Fall back to comparing `display_name` if IDs don't match.

3. **CircleCI continuation config for nitpick_mode parameter**
   - What we know: devrev-web uses dynamic config with `continuation/continue` orb. Phase 4 research recommended a separate `nitpick-agent.yml`.
   - What's unclear: Whether adding new pipeline parameters (`nitpick_mode`) requires changes to the setup job's parameter declarations.
   - Recommendation: Add `nitpick_mode` alongside `nitpick_issue_id` in the continuation config parameters. Test pipeline trigger via API before snap-in integration.

4. **Custom field exact API format for "Nitpick stage" dropdown**
   - What we know: The field exists in the dev environment as a dropdown with values: Analyzing, Awaiting choice, Fixing, In review, Revising.
   - What's unclear: The exact `custom_fields` key name and value format for API updates (is it `nitpick_stage`, `tnt__nitpick_stage`, or something else?).
   - Recommendation: Use DevRev API to inspect the field schema: `GET /custom-fields.list` to find the exact identifier. Test a manual update before automating.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Snap-in build | TBD (CI) | 22.22 (in CI image) | -- |
| esbuild | Snap-in packaging | npm install | ^0.28.0 | -- |
| DevRev org (dev) | Snap-in testing | Yes | -- | -- |
| CircleCI project | Pipeline triggers | Yes (devrev-web) | -- | -- |
| ngrok | Local snap-in testing | TBD (local) | -- | Skip local testing, deploy to dev directly |
| gh CLI | PR creation from agent | Yes (CI image) | -- | -- |
| DEVREV_PAT | API authentication | Yes (CI context) | -- | -- |

**Missing dependencies with no fallback:**
- None identified. All dependencies are either already in CI or installable.

**Missing dependencies with fallback:**
- ngrok (for local testing): Can deploy directly to dev org if ngrok unavailable locally.

## Project Constraints (from CLAUDE.md)

No project-level `CLAUDE.md` exists in the nitpick repo. The relevant constraints come from:

**devrev-web CLAUDE.md (where agent code runs):**
- Branch naming: `fix/ISS-XXXX-short-description` (type/issue-description)
- Commit format: `feat|fix|chore|refactor: short description`
- PR title: `fix(<scope>): subject` -- must pass `pr-title-check.js` regex
- Full PR template required (never remove sections; mark N/A)
- TypeScript strict mode
- `PRE_COMMIT_AUTO_RUN=1` for non-interactive environments
- Never use `--no-verify`

**User's global CLAUDE.md:**
- Never include "Co-Authored-By: Claude" in commits
- Never mention Claude/AI in PR titles or descriptions
- ALL code changes on feature branches, push, create PR, never touch main

## Sources

### Primary (HIGH confidence)
- figma-validator/manifest.yaml -- Snap-in manifest structure with event sources, keyrings, inputs [VERIFIED: direct file read]
- figma-validator/snap-in-deploy-faq.md -- Deploy pitfalls: dual dist, keyring injection as strings, REST API for versions [VERIFIED: direct file read]
- figma-validator/code/src/functions/validate_figma_design/index.ts -- Event handler pattern, keyring access, payload validation [VERIFIED: direct file read]
- figma-validator/code/src/snap-in-server.ts -- Local test server pattern [VERIFIED: direct file read]
- figma-validator/code/package.json -- Build setup (esbuild dual output, package script) [VERIFIED: direct file read]
- developer.devrev.ai/snapin-development/references/event-sources -- Native event types, devrev-webhook configuration, jq filtering [VERIFIED: WebFetch]
- developer.devrev.ai/snapin-development/references/function-invocation -- Event object structure, service_account_token location [VERIFIED: WebFetch]
- developer.devrev.ai/api-reference/timeline-entries/create -- POST endpoint, required fields (type, object, body) [VERIFIED: WebFetch]
- developer.devrev.ai/api-reference/timeline-entries/list -- GET with object filter, pagination [VERIFIED: WebFetch]
- circleci.com/docs/api/v2 -- Pipeline trigger POST, approval endpoint [VERIFIED: WebFetch]
- devrev-web/CLAUDE.md -- Branch naming, commit format, PR conventions [VERIFIED: direct file read]
- devrev-web/.github/scripts/pr-title-check.js -- Exact regex for PR title validation [VERIFIED: direct file read]
- devrev-web/.claude/skills/create-pr/SKILL.md -- 7-step PR creation workflow [VERIFIED: direct file read]
- 04-RESEARCH.md -- Phase 4 patterns (shell runner, prompt template, CLI flags) [VERIFIED: direct file read]

### Secondary (MEDIUM confidence)
- developer.devrev.ai/snapin-development/locally-testing-snap-ins -- Testing URL approach, ngrok setup, token expiry notes [VERIFIED: WebFetch]
- developer.devrev.ai/api-reference/works/update -- Stage updates, custom_fields structure [VERIFIED: WebFetch, partial]
- developer.devrev.ai/snapin-development/references/keyrings -- Keyring types and manifest configuration [VERIFIED: WebFetch]
- create-marketplace-submission.yml -- GitHub Actions deployment workflow [VERIFIED: direct file read]

### Tertiary (LOW confidence)
- DevRev works.update tag removal semantics -- Could not confirm add/remove vs set-all behavior [WebFetch, incomplete]
- Custom field exact API key format for "Nitpick stage" -- Field exists but exact API identifier unverified [ASSUMED from CONTEXT.md D-30]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Follows proven figma-validator pattern with verified package versions
- Architecture: HIGH -- Event sources, function structure, and CI trigger patterns all verified from official docs and existing code
- Pitfalls: HIGH -- Mix of verified deploy FAQ issues and documented API behaviors; two assumptions about ID formats flagged

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (stable domain; DevRev snap-in platform and CircleCI API are mature)
