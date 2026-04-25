import {
  showIssueCard,
  issueCardLoading,
  issueFormData,
  issueError,
  isCreatingIssue,
  aiStreamingDone,
  aiSuggestedPart,
  aiSuggestedOwner,
  devrevParts,
  devrevUsers,
  devrevSelf,
  createdIssueUrl,
  showSuccessToast,
  commentText,
  showCommentBubble,
  selectedElement,
  selectedRect,
  areaSelection,
  screenshotsReady,
} from '../signals';
import { ChipDropdown } from './ChipDropdown';
import { PRIORITY_OPTIONS } from '../../shared/constants';

function getInitials(name: string): string {
  return name.split(/[\s-]+/).map(w => w[0]?.toUpperCase() || '').slice(0, 2).join('');
}

export function IssueCard() {
  if (!showIssueCard.value) return null;

  const isLoading = issueCardLoading.value;
  const form = issueFormData.value;
  const error = issueError.value;
  const creating = isCreatingIssue.value;
  const streamingDone = aiStreamingDone.value;

  const isButtonDisabled =
    isLoading || creating || (!streamingDone && !error) || !form.title.trim() || !form.partId;

  function handleClose(): void {
    showIssueCard.value = false;
    issueCardLoading.value = false;
  }

  function handleRefresh(): void {
    const self = devrevSelf.value;
    issueFormData.value = {
      title: '', description: '',
      part: '', partId: '',
      owner: self?.display_name || '', ownerId: self?.id || '',
      priority: 'P2', priorityId: 'p2',
    };
    issueError.value = null;
    aiSuggestedPart.value = undefined;
    aiSuggestedOwner.value = undefined;
    aiStreamingDone.value = false;
  }

  function handleCreateIssue(): void {
    // Validate required fields
    if (!form.title.trim()) {
      issueError.value = 'Title is required';
      return;
    }

    isCreatingIssue.value = true;
    issueError.value = null;

    // Get reported_by from self
    const self = devrevSelf.value;
    const reportedById = self?.id || form.ownerId;

    chrome.runtime.sendMessage(
      {
        action: 'CREATE_ISSUE',
        issueData: {
          title: form.title.trim(),
          description: form.description.trim(),
          partId: form.partId,
          ownerId: form.ownerId || reportedById,
          priority: form.priorityId as 'p0' | 'p1' | 'p2' | 'p3',
          reportedById,
          artifactIds: [], // Service worker adds artifact IDs from screenshot store
        },
      },
      (response) => {
        isCreatingIssue.value = false;

        if (!response) {
          issueError.value = 'No response from service worker. Please retry.';
          return;
        }

        if (response.action === 'ISSUE_CREATED') {
          // Success (D-12): show toast with issue link
          createdIssueUrl.value = response.webUrl;
          showSuccessToast.value = true;

          // Close the issue card and comment bubble
          showIssueCard.value = false;
          showCommentBubble.value = false;

          // Reset form
          issueFormData.value = {
            title: '', description: '',
            part: '', partId: '',
            owner: '', ownerId: '',
            priority: 'P2', priorityId: 'p2',
          };
          commentText.value = '';
          aiStreamingDone.value = false;
          aiSuggestedPart.value = undefined;
          aiSuggestedOwner.value = undefined;

          // Clear selection state
          selectedElement.value = null;
          selectedRect.value = null;
          areaSelection.value = null;
          screenshotsReady.value = false;
        } else if (response.action === 'ISSUE_ERROR') {
          // Error (D-13): inline error with retry, form preserved
          issueError.value = response.message;
        }
      },
    );
  }

  function handleRetry(): void {
    // Clear error state; the user can re-send from the comment bubble
    issueError.value = null;
    issueCardLoading.value = true;
    aiStreamingDone.value = false;

    // Re-trigger the send by resetting loading -- the actual retry
    // is triggered from CommentBubble's handleSend via signal coordination
    issueCardLoading.value = false;
    issueError.value = 'Press Send again to retry.';
  }

  // Build dropdown option arrays
  const partOptions = devrevParts.value.map((p) => ({
    id: p.id,
    label: p.name,
    description: p.description,
  }));

  const ownerOptions = devrevUsers.value.map((u) => {
    const name = u.full_name || u.display_name;
    return {
      id: u.id,
      label: name,
      initials: getInitials(name),
      avatarUrl: u.profile_picture_url,
      searchText: `${u.display_name} ${u.full_name || ''}`.toLowerCase(),
    };
  });

  const priorityOptions = PRIORITY_OPTIONS.map((p) => ({
    id: p.id,
    label: p.label,
  }));

  // Chips disabled during streaming (before AI_DONE)
  const chipsDisabled = isLoading;

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
            const el = e.target as HTMLTextAreaElement;
            issueFormData.value = { ...form, description: el.value };
            // Auto-grow textarea during streaming
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
          }}
          rows={3}
        />
      )}

      {error && (
        <div class="nitpick-issue-error">
          <span>{error}</span>
          <button class="nitpick-retry-btn" onClick={handleRetry}>Retry</button>
        </div>
      )}

      <div class="nitpick-chips-row">
        <ChipDropdown
          label="Part"
          value={form.part}
          options={partOptions}
          onSelect={(id, label) => {
            issueFormData.value = { ...issueFormData.value, part: label, partId: id };
          }}
          suggested={aiSuggestedPart.value}
          disabled={chipsDisabled}
        />
        <ChipDropdown
          label="Owner"
          value={form.owner}
          options={ownerOptions}
          onSelect={(id, label) => {
            issueFormData.value = { ...issueFormData.value, owner: label, ownerId: id };
          }}
          suggested={aiSuggestedOwner.value}
          disabled={chipsDisabled}
        />
        <ChipDropdown
          label="Priority"
          value={form.priority}
          options={priorityOptions}
          onSelect={(id, label) => {
            issueFormData.value = { ...issueFormData.value, priority: label, priorityId: id };
          }}
          disabled={chipsDisabled}
        />
      </div>

      <button
        class="nitpick-create-btn"
        onClick={handleCreateIssue}
        disabled={isButtonDisabled}
      >
        {creating ? 'Creating...' : 'Create Issue'}
      </button>
    </div>
  );
}
