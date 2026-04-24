/**
 * Issue card popover -- Step 2 of the two-step popover flow.
 *
 * Per D-07: Slides in below comment bubble with loading skeleton while
 * AI generates content.
 *
 * Per D-08: Contains "New Issue" badge, refresh icon, X close button,
 * title input, description textarea, 3 attribute chips (Part, Owner,
 * Priority), and purple "Create Issue" button.
 *
 * Per D-09: All three attribute chips start EMPTY. No pre-fill, no AI
 * suggestions in Phase 1.
 *
 * Per D-10: X button closes ONLY the issue card. Comment bubble and
 * element selection remain.
 *
 * Per D-11: Refresh icon resets the form to empty (clears all fields).
 *
 * Per UI-SPEC Copywriting:
 * - Badge: "New Issue"
 * - Title placeholder: "Issue title"
 * - Description placeholder: "Describe the problem..."
 * - Chip labels: "Part", "Owner", "Priority"
 * - Create button: "Create Issue" / "Creating..."
 * - Refresh: aria-label="Reset form"
 * - Close: aria-label="Close issue form"
 */

import {
  showIssueCard,
  issueCardLoading,
  issueFormData,
} from '../signals';

export function IssueCard() {
  if (!showIssueCard.value) return null;

  const isLoading = issueCardLoading.value;
  const form = issueFormData.value;

  function handleClose(): void {
    // D-10: X closes ONLY the issue card. Comment bubble and selection remain.
    showIssueCard.value = false;
    issueCardLoading.value = false;
  }

  function handleRefresh(): void {
    // D-11: Reset form to empty
    issueFormData.value = {
      title: '',
      description: '',
      part: '',
      owner: '',
      priority: '',
    };
    issueCardLoading.value = false;
  }

  function handleCreateIssue(): void {
    // Phase 2 will wire this to DevRev API
    // For now, show a placeholder behavior
  }

  return (
    <div
      class="nitpick-issue-card"
      role="dialog"
      aria-label="New issue form"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Header row */}
      <div class="nitpick-issue-header">
        <span class="nitpick-issue-badge">New Issue</span>
        <div class="nitpick-issue-header-actions">
          <button
            class="nitpick-icon-btn"
            onClick={handleRefresh}
            aria-label="Reset form"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1.5 7C1.5 3.96 3.96 1.5 7 1.5C10.04 1.5 12.5 3.96 12.5 7C12.5 10.04 10.04 12.5 7 12.5C5.18 12.5 3.58 11.59 2.6 10.2M1.5 3V7H5.5"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button
            class="nitpick-icon-btn"
            onClick={handleClose}
            aria-label="Close issue form"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 3L11 11M3 11L11 3"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Title field */}
      {isLoading ? (
        <div class="nitpick-skeleton nitpick-skeleton--title" />
      ) : (
        <input
          type="text"
          class="nitpick-issue-title"
          placeholder="Issue title"
          value={form.title}
          onInput={(e) => {
            issueFormData.value = {
              ...form,
              title: (e.target as HTMLInputElement).value,
            };
          }}
        />
      )}

      {/* Description field */}
      {isLoading ? (
        <div class="nitpick-skeleton nitpick-skeleton--desc" />
      ) : (
        <textarea
          class="nitpick-issue-desc"
          placeholder="Describe the problem..."
          value={form.description}
          onInput={(e) => {
            issueFormData.value = {
              ...form,
              description: (e.target as HTMLTextAreaElement).value,
            };
          }}
          rows={3}
        />
      )}

      {/* Attribute chips */}
      <div class="nitpick-chips-row">
        <button class="nitpick-chip" aria-label="Select part">
          {form.part || 'Part'}
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 4L5 7L8 4" stroke="currentColor" stroke-width="1.2" fill="none" />
          </svg>
        </button>
        <button class="nitpick-chip" aria-label="Select owner">
          {form.owner || 'Owner'}
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 4L5 7L8 4" stroke="currentColor" stroke-width="1.2" fill="none" />
          </svg>
        </button>
        <button class="nitpick-chip" aria-label="Select priority">
          {form.priority || 'Priority'}
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 4L5 7L8 4" stroke="currentColor" stroke-width="1.2" fill="none" />
          </svg>
        </button>
      </div>

      {/* Create button */}
      <button
        class="nitpick-create-btn"
        onClick={handleCreateIssue}
        disabled={isLoading}
      >
        {isLoading ? 'Creating...' : 'Create Issue'}
      </button>
    </div>
  );
}
