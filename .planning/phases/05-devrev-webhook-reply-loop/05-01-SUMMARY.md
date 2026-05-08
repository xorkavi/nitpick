---
phase: 05-devrev-webhook-reply-loop
plan: 01
subsystem: snap-in
tags: [devrev, snap-in, webhook, circleci, event-router]
dependency_graph:
  requires: []
  provides: [snap-in-scaffold, event-handler, validation, circleci-trigger, mode-detection]
  affects: [05-02, 05-03]
tech_stack:
  added: [typescript, esbuild, express, zod, dotenv]
  patterns: [function-factory, dual-esbuild-output, native-devrev-events, loop-guard]
key_files:
  created:
    - snap-in/manifest.yaml
    - snap-in/.devrev/repo.yml
    - snap-in/code/package.json
    - snap-in/code/tsconfig.json
    - snap-in/code/src/index.ts
    - snap-in/code/src/function-factory.ts
    - snap-in/code/src/types.ts
    - snap-in/code/src/snap-in-server.ts
    - snap-in/code/src/functions/handle_nitpick_event/index.ts
    - snap-in/code/src/lib/validation.ts
    - snap-in/code/src/lib/circleci-api.ts
    - snap-in/code/src/lib/devrev-api.ts
    - snap-in/code/src/lib/mode-detection.ts
    - snap-in/code/package-lock.json
  modified: []
decisions:
  - "Followed figma-validator pattern exactly for scaffold (function-factory, snap-in-server, dual esbuild)"
  - "Used native devrev-webhook type (not flow-custom-webhook) for DevRev events"
  - "Keyrings accessed as raw strings per deploy FAQ pattern"
metrics:
  duration: "2m 41s"
  completed: "2026-05-08"
  tasks_completed: 2
  tasks_total: 2
  files_created: 14
---

# Phase 05 Plan 01: Snap-in Scaffold & Event Handler Summary

DevRev snap-in that validates nitpick-tagged issues (tag + Code identifiers + screenshots), applies loop guard via service account ID comparison, detects mode from nitpick_stage field, and triggers CircleCI pipelines with issue ID and mode parameters.

## Task Completion

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Snap-in scaffold (manifest, build config, boilerplate) | 2fbbec3 | Done |
| 2 | Event handler + library modules (validation, mode detection, APIs) | 71e20ae | Done |
| - | Package lock for reproducible builds | 13e731f | Done |

## Key Outputs

- **manifest.yaml**: Native `devrev-webhook` event source with `work_created` and `timeline_entry_created`; keyrings for CircleCI token; org inputs for project slug and branch
- **handle_nitpick_event/index.ts**: Routes events to handleWorkCreated (validates, posts pickup msg, triggers analysis) and handleCommentCreated (loop guard, run cap, mode detection, triggers pipeline)
- **validation.ts**: Checks 3 criteria -- nitpicked tag, "### Code identifiers" in body, screenshot artifacts or inline images
- **circleci-api.ts**: POST to CircleCI pipeline trigger API with only nitpick_issue_id and nitpick_mode (no user content in parameters)
- **devrev-api.ts**: postComment, updateWork, listTimeline, getWork helpers
- **mode-detection.ts**: Reads nitpick_stage custom field to determine analysis/fix/revision

## Verification Results

- TypeScript typecheck passes cleanly (zero errors)
- Esbuild dual output verified: `dist/index.cjs` (9.0kb) + `dist/functions/handle_nitpick_event/index.js` (8.9kb)
- All must-have artifacts present with correct exports
- Loop guard uses `event.context.dev_oid` comparison (T-05-01 mitigated)
- Only issue_id and mode passed as pipeline params (T-05-02 mitigated)
- MAX_RUNS=5 cap enforced on comment triggers (T-05-03 mitigated)
- Keyrings never logged (T-05-04 mitigated)

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface

No additional threat surface beyond what is documented in the plan's threat model. All 5 mitigations implemented as specified.
