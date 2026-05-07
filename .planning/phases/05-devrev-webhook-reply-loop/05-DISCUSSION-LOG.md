# Phase 5: DevRev Webhook & Reply Loop - Discussion Log

**Date:** 2026-05-07
**Duration:** Extended session (15 areas discussed)

## Areas Discussed

### 1. Webhook Receiver
- **Options:** DevRev snap-in / AWS Lambda / DevRev automation rule
- **Choice:** DevRev snap-in with native events
- **Follow-up:** User pointed to figma-validator in design-system repo as the pattern to follow
- **Location:** arcade/plugins/nitpick/snap-in/ (user's explicit choice)
- **Event type:** Native DevRev events (work:created + work:comment), not external webhook

### 2. Fix Options Format
- **Options:** Structured options list / Options with code snippets / You decide
- **Choice:** Options with code snippets (before/after for key changes)
- **Follow-up:** Agent explains root cause first, then shows options

### 3. Reply Parsing & Re-run
- **Options:** Fresh run with comment history / Session continuation
- **Initial choice:** Session continuation
- **Revised after discussion:** Fresh run with full comment history (session continuation doesn't work in ephemeral CI)
- **PR update:** New commit on same branch (no force-push)

### 4. Status Lifecycle
- **Options:** Agent drives transitions / Hybrid agent + DevRev automation
- **Choice:** Hybrid — shell runner handles triage→in_development, DevRev automation handles in_development→completed on PR merge
- **PR linking:** Both formal DevRev link API + comment with URL

### 5. Comment Filtering
- **Options:** Service account filter / Marker prefix / Both
- **Choice:** Service account filter
- **Identity decision:** Same service account PAT shared between snap-in and CI agent — single "Nitpick Bot" identity

### 6. Agent Prompt Changes
- **Options:** Single template with conditionals / Two separate templates
- **Choice:** Single template, conditional sections (MODE variable)

### 7. Snap-in Secrets/Config
- **Options:** DevRev keyrings / Org inputs only / Hardcoded
- **Choice:** DevRev keyrings for CircleCI token, org input for project slug

### 8. Error Handling
- **Options:** Post failure comment / Silent / Post + change status
- **Choice:** Post failure comment with explanation + CI log link
- **Retry:** "retry" keyword recognized by snap-in to re-trigger

### 9. Snap-in Deploy Pipeline
- **Options:** Manual CLI / GitHub Actions on merge
- **Choice:** GitHub Actions on merge (same as design-system)

### 10. Multi-Issue Handling
- **Options:** Sequential / Matrix / Separate pipelines
- **Discussion:** User asked about 10+ designers scenario
- **Choice:** Separate pipelines per issue (scales naturally, same mechanism for all triggers)

### 11. Agent Comment Posting
- **Options:** Shell runner posts after / Agent posts via curl / Agent posts via helper script
- **Discussion:** User asked which gets closer to fixing the issue
- **Choice:** Helper script (agent posts mid-run)
- **Major revision:** Two-stage flow decided — analysis first (post options, exit), fix after user picks (REVISES Phase 4 D-11)

### 12. Testing Strategy
- **Options:** Local snap-in server + mock / Ngrok + real DevRev
- **Choice:** Full E2E with ngrok + real DevRev test org + real CircleCI

### 13. Conversation Memory
- **Options:** Comments only / Comments + PR diff
- **Choice:** Comments + PR diff (git is the memory)

### 14. Rate Limiting & Cost
- **Discussion:** User challenged whether rate limiting is needed at all
- **Conclusion:** Per-issue cap only (max 5 runs). Per-run budget ($5) already exists. No hourly/daily caps.

### 15. Snap-in Scope Guard
- **Options:** Tag + validation only / Add part filter / Add status filter
- **Choice:** Tag + validation only (format validation is sufficient)

## Additional Decisions (from E2E review)

- Cron replaced entirely by immediate snap-in trigger on issue creation
- Issue validation: artifacts + "### Code identifiers" section + "Made with Nitpick" marker
- Custom DevRev field "Nitpick stage" created in dev environment (Dropdown: 5 values)
- Run mode detection via nitpick_stage field
- Concurrency guard: stage check + branch existence (both)
- Shell runner posts acknowledgment comment immediately on pickup
- Bot posts "analyzing..." on pickup, options after analysis, "working on it" on fix start, PR link + preview URL after fix, status updates on revision, codeowner tags on approval, celebration message on merge
- All user input treated as natural language (not just option numbers)
- Branch naming follows devrev-web convention: fix/ISS-XXXX-short-description
- PR follows full template + create-pr skill conventions
- Preview URL: https://devrev-web-<PR_NUMBER>.e2e.dev.devrev-eng.ai (sandbox gate)
- On max attempts: explain blocker + suggest codeowners from CODEOWNERS file
- On error: explain the error, why it's happening, suggest fix options
- Phase 4 code needs to be rebuilt (deleted from devrev-web)

## Deferred Ideas

- Multi-repo support (v2.x)
- Auto-merge after codeowner approval
- Slack notifications
- Batch fix sessions
- Real-time streaming dashboard

---

*Discussion completed: 2026-05-07*
