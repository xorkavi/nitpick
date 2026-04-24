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
    showIssueCard.value = false;
    issueCardLoading.value = false;
  }

  function handleRefresh(): void {
    issueFormData.value = { title: '', description: '', part: '', owner: '', priority: '' };
    issueCardLoading.value = false;
  }

  function handleCreateIssue(): void {
    // Phase 2 wires this to DevRev API
  }

  return (
    <div class="nitpick-issue-card" role="dialog" aria-label="New issue form">
      <div class="nitpick-issue-header">
        <span class="nitpick-issue-badge">New Issue</span>
        <div class="nitpick-issue-header-actions">
          <button class="nitpick-icon-btn" onClick={handleRefresh} aria-label="Reset form">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 7C1.5 3.96 3.96 1.5 7 1.5C10.04 1.5 12.5 3.96 12.5 7C12.5 10.04 10.04 12.5 7 12.5C5.18 12.5 3.58 11.59 2.6 10.2M1.5 3V7H5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="nitpick-icon-btn" onClick={handleClose} aria-label="Close issue form">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3L11 11M3 11L11 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div class="nitpick-skeleton nitpick-skeleton--title" />
      ) : (
        <input
          type="text"
          class="nitpick-issue-title"
          placeholder="Issue title"
          value={form.title}
          onInput={(e) => {
            issueFormData.value = { ...form, title: (e.target as HTMLInputElement).value };
          }}
        />
      )}

      {isLoading ? (
        <div class="nitpick-skeleton nitpick-skeleton--desc" />
      ) : (
        <textarea
          class="nitpick-issue-desc"
          placeholder="Describe the problem..."
          value={form.description}
          onInput={(e) => {
            issueFormData.value = { ...form, description: (e.target as HTMLTextAreaElement).value };
          }}
          rows={3}
        />
      )}

      <div class="nitpick-chips-row">
        <button class="nitpick-chip" aria-label="Select part">
          {form.part || 'Part'}
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 4L5 7L8 4" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
        </button>
        <button class="nitpick-chip" aria-label="Select owner">
          {form.owner || 'Owner'}
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 4L5 7L8 4" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
        </button>
        <button class="nitpick-chip" aria-label="Select priority">
          {form.priority || 'Priority'}
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 4L5 7L8 4" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
        </button>
      </div>

      <button class="nitpick-create-btn" onClick={handleCreateIssue} disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Issue'}
      </button>
    </div>
  );
}
