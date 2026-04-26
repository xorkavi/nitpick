import {
  showIssueCard,
  issueCardLoading,
  issueFormData,
  issueError,
  isCreatingIssue,
  aiStreamingDone,
  aiSuggestedPart,
  aiSuggestedOwner,
  partSearchResults,
  partSearchLoading,
  userSearchResults,
  userSearchLoading,
  devrevSelf,
  createdIssueUrl,
  createdIssueDisplayId,
  showSuccessToast,
  commentText,
  showCommentBubble,
  selectedElement,
  selectedRect,
  areaSelection,
  screenshotsReady,
  croppedScreenshotUrl,
} from '../signals';
import { useRef } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { ChipDropdown } from './ChipDropdown';
import { PRIORITY_OPTIONS } from '../../shared/constants';

function getInitials(name: string): string {
  return name.split(/[\s-]+/).map(w => w[0]?.toUpperCase() || '').slice(0, 2).join('');
}

export function IssueCard() {
  if (!showIssueCard.value) return null;

  const descRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useSignalEffect(() => {
    const desc = issueFormData.value.description;
    const el = descRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 286)}px`;
    }
    const title = issueFormData.value.title;
    const titleEl = titleRef.current;
    if (titleEl) {
      titleEl.style.height = 'auto';
      titleEl.style.height = `${titleEl.scrollHeight}px`;
    }
  });

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
    aiStreamingDone.value = false;
    issueError.value = null;
    aiSuggestedPart.value = undefined;
    aiSuggestedOwner.value = undefined;
    const self = devrevSelf.value;
    issueFormData.value = {
      title: '', description: '',
      part: '', partId: '',
      owner: '', ownerId: '',
      priority: 'P2', priorityId: 'p2',
    };
  }

  function handleRefresh(): void {
    const self = devrevSelf.value;
    issueFormData.value = {
      title: '', description: '',
      part: '', partId: '',
      owner: '', ownerId: '',
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
          createdIssueUrl.value = response.webUrl;
          createdIssueDisplayId.value = response.displayId;
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

  function handlePartSearch(query: string): void {
    partSearchLoading.value = true;
    chrome.runtime.sendMessage(
      { action: 'SEARCH_PARTS', query, limit: 20 },
      (response: { action?: string; parts?: unknown[] } | undefined) => {
        partSearchLoading.value = false;
        if (response?.action === 'SEARCH_PARTS_RESULT') {
          partSearchResults.value = (response.parts || []) as import('../../shared/types').DevRevPart[];
        }
      },
    );
  }

  const partOptions = partSearchResults.value.map((p) => ({
    id: p.id,
    label: p.name,
    description: p.description,
  }));

  function handleUserSearch(query: string): void {
    userSearchLoading.value = true;
    chrome.runtime.sendMessage(
      { action: 'SEARCH_USERS', query, limit: 20 },
      (response: { action?: string; users?: unknown[] } | undefined) => {
        userSearchLoading.value = false;
        if (response?.action === 'SEARCH_USERS_RESULT') {
          userSearchResults.value = (response.users || []) as import('../../shared/types').DevRevUser[];
        }
      },
    );
  }

  const ownerOptions = userSearchResults.value.map((u) => {
    const name = u.full_name || u.display_name;
    return {
      id: u.id,
      label: name,
      initials: getInitials(name),
      avatarUrl: u.thumbnail,
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
            <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
              <path d="M224,128a96,96,0,0,1-94.71,96H128A95.38,95.38,0,0,1,62.1,197.8a8,8,0,0,1,11-11.63A80,80,0,1,0,71.43,71.39a3.07,3.07,0,0,1-.26.25L44.59,96H72a8,8,0,0,1,0,16H24a8,8,0,0,1-8-8V56a8,8,0,0,1,16,0V85.8L60.25,60A96,96,0,0,1,224,128Z"/>
            </svg>
          </button>
          <button class="nitpick-icon-btn" onClick={handleClose} aria-label="Close issue form">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor">
              <path d="M17.208 16.194a100 100 0 0 1 6.662 6.081l-1.59 1.59c-1.2-1.16-2.32-2.39-3.45-3.62-.894-1.006-1.789-2.004-2.65-3.04H15.8a93 93 0 0 1-6.081 6.66l-1.59-1.59c1.17-1.19 2.4-2.32 3.63-3.45 1.006-.885 1.995-1.78 3.032-2.641v-.378A100 100 0 0 1 8.13 9.725l1.59-1.59c1.2 1.16 2.32 2.4 3.45 3.62.894 1.006 1.789 2.003 2.65 3.04h.378a93 93 0 0 1 6.082-6.66l1.59 1.59c-1.17 1.19-2.4 2.32-3.63 3.45-1.006.894-1.995 1.78-3.031 2.641z"/>
            </svg>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div class="nitpick-skeleton nitpick-skeleton--title" />
      ) : (
        <textarea
          ref={titleRef}
          class="nitpick-issue-title"
          placeholder="Issue title"
          value={form.title}
          rows={1}
          onInput={(e) => {
            const el = e.target as HTMLTextAreaElement;
            issueFormData.value = { ...form, title: el.value };
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
          }}
        />
      )}

      {isLoading ? (
        <div class="nitpick-skeleton nitpick-skeleton--desc" />
      ) : (
        <textarea
          ref={descRef}
          class="nitpick-issue-desc"
          placeholder="Describe the problem..."
          value={form.description}
          onInput={(e) => {
            const el = e.target as HTMLTextAreaElement;
            issueFormData.value = { ...form, description: el.value };
            // Auto-grow textarea during streaming
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 286)}px`;
          }}
          rows={3}
        />
      )}

      {croppedScreenshotUrl.value && (
        <img
          src={croppedScreenshotUrl.value}
          alt="Cropped screenshot of selected element"
          class="nitpick-screenshot-thumbnail"
          onClick={() => {
            const dataUrl = croppedScreenshotUrl.value!;
            const byteString = atob(dataUrl.split(',')[1]);
            const mimeType = dataUrl.split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const blob = new Blob([ab], { type: mimeType });
            window.open(URL.createObjectURL(blob), '_blank');
          }}
          role="button"
          aria-label="View full-size screenshot"
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
          onSearch={handlePartSearch}
          loading={partSearchLoading.value}
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
          onSearch={handleUserSearch}
          loading={userSearchLoading.value}
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
