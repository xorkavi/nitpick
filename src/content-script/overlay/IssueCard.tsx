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
  viewportScreenshotUrl,
  tagSearchResults,
  tagSearchLoading,
  selectedTags,
} from '../signals';
import { useRef } from 'preact/hooks';
import { useSignal, useSignalEffect } from '@preact/signals';
import { ChipDropdown } from './ChipDropdown';
import { TagChipMultiSelect } from './TagChipMultiSelect';
import { PRIORITY_OPTIONS } from '../../shared/constants';
import type { PartType } from '../../shared/types';
import type { ComponentChildren } from 'preact';
import { h } from 'preact';

function getInitials(name: string): string {
  return name.split(/[\s-]+/).map(w => w[0]?.toUpperCase() || '').slice(0, 2).join('');
}

const AVATAR_COLORS = [
  '67, 120, 60', '71, 158, 96', '69, 160, 143', '78, 153, 184',
  '103, 124, 175', '126, 116, 191', '113, 86, 166', '155, 121, 181',
  '169, 55, 55', '195, 92, 92', '179, 111, 89', '189, 157, 57',
  '207, 102, 67', '249, 138, 102', '208, 119, 146', '199, 86, 107',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return `rgba(${AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]}, 1)`;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  p0: { bg: 'var(--core-chili-red-200)', text: 'var(--core-chili-red-700)' },
  p1: { bg: 'var(--core-marmalade-orange-200)', text: 'var(--core-marmalade-orange-700)' },
  p2: { bg: 'var(--core-yuzu-yellow-200)', text: 'var(--core-yuzu-yellow-700)' },
  p3: { bg: 'var(--core-matcha-green-200)', text: 'var(--core-matcha-green-700)' },
};

const PART_COLORS: Record<string, string> = {
  product: 'var(--core-plum-purple-400)',
  feature: 'var(--core-blueberry-blue-400)',
  capability: 'var(--core-blueberry-blue-500)',
  enhancement: 'var(--core-wasabi-teal-500)',
  runnable: 'var(--core-yuzu-yellow-600)',
  microservice: 'var(--core-marmalade-orange-500)',
  linkable: 'var(--core-marmalade-orange-500)',
};

function PartTypeIcon({ type }: { type?: PartType }): ComponentChildren {
  const size = 14;
  const color = (type && PART_COLORS[type]) || 'var(--core-neutrals-600)';
  switch (type) {
    case 'product':
      return h('svg', { width: size, height: size, viewBox: '0 0 16 17', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
        h('path', { 'fill-rule': 'evenodd', 'clip-rule': 'evenodd', d: 'M2.17489 7.98619L7.50222 13.8455C7.76889 14.1389 8.22955 14.1389 8.49622 13.8455C9.70555 12.5162 12.7776 9.13686 13.8249 7.98553C14.0336 7.75619 14.0576 7.41286 13.8829 7.15686L11.5249 3.69419C11.4009 3.51219 11.1956 3.40353 10.9762 3.40353H5.02555C4.80622 3.40353 4.60089 3.51219 4.47689 3.69419L2.11689 7.15553C1.94155 7.41219 1.96555 7.75619 2.17489 7.98619Z', stroke: color, 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      );
    case 'feature':
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
        h('path', { d: 'M6.21879 9.44774C7.26019 10.4891 7.26019 12.1776 6.21879 13.219C5.17739 14.2604 3.48895 14.2604 2.44755 13.219C1.40615 12.1776 1.40615 10.4891 2.44755 9.44774C3.48895 8.40634 5.17739 8.40634 6.21879 9.44774', stroke: color, 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        h('path', { d: 'M13.5523 9.44774C14.5937 10.4891 14.5937 12.1776 13.5523 13.219C12.5109 14.2604 10.8224 14.2604 9.78105 13.219C8.73965 12.1776 8.73965 10.4891 9.78105 9.44774C10.8224 8.40634 12.5109 8.40634 13.5523 9.44774', stroke: color, 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        h('path', { d: 'M9.88529 2.78105C10.9267 3.82245 10.9267 5.51089 9.88529 6.55228C8.84389 7.59368 7.15545 7.59368 6.11406 6.55228C5.07266 5.51088 5.07266 3.82244 6.11406 2.78105C7.15546 1.73965 8.8439 1.73965 9.88529 2.78105', stroke: color, 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      );
    case 'capability':
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
        h('path', { d: 'M2.66699 5.33333L8.00033 2L13.3337 5.33333V10.6667L8.00033 14L2.66699 10.6667V5.33333L8.00033 8.25V14V8.25L13.3337 5.33333', stroke: color, 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      );
    case 'enhancement':
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
        h('rect', { x: '2', y: '4', width: '12', height: '10', rx: '3', stroke: color, 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        h('path', { d: 'M3.66675 1.99996H12.3334', stroke: color, 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        h('path', { 'fill-rule': 'evenodd', 'clip-rule': 'evenodd', d: 'M7.47695 6.99197C7.57521 6.79283 7.77801 6.66675 8.00007 6.66675C8.22213 6.66675 8.42493 6.79283 8.52319 6.99197L8.81999 7.59362C8.90493 7.76582 9.06919 7.88519 9.25921 7.91281L9.92312 8.00931C10.1428 8.04126 10.3253 8.19512 10.3939 8.40623C10.4625 8.61734 10.4054 8.8491 10.2465 9.00411L9.7659 9.47289C9.62851 9.6069 9.56583 9.79992 9.59827 9.98908L9.71168 10.6502C9.74919 10.869 9.65924 11.0901 9.47964 11.2206C9.30004 11.3511 9.06193 11.3684 8.8654 11.2651L8.27145 10.9529C8.10155 10.8637 7.8986 10.8637 7.7287 10.9529L7.13475 11.2651C6.93822 11.3684 6.7001 11.3511 6.5205 11.2206C6.3409 11.0901 6.25095 10.869 6.28847 10.6502L6.40187 9.98908C6.43432 9.79992 6.37164 9.6069 6.23425 9.47289L5.75364 9.00411C5.59474 8.8491 5.5376 8.61734 5.60623 8.40623C5.67486 8.19512 5.85735 8.04126 6.07703 8.00931L6.74094 7.91281C6.93096 7.88519 7.09521 7.76582 7.18016 7.59362L7.47695 6.99197Z', stroke: color, 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      );
    case 'component':
    case 'custom_part':
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
        h('rect', { x: '8.294', y: '8.294', width: '12.706', height: '12.706', rx: '2.118', fill: 'none', stroke: color, 'stroke-miterlimit': '10', 'stroke-width': '1.25' }),
        h('circle', { cx: '9.353', cy: '9.353', r: '6.353', fill: 'none', stroke: color, 'stroke-miterlimit': '10', 'stroke-width': '1.25' }),
      );
    case 'linkable':
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
        h('rect', { x: '8.294', y: '8.294', width: '12.706', height: '12.706', rx: '2.118', fill: 'none', stroke: color, 'stroke-miterlimit': '10', 'stroke-width': '1.25' }),
        h('circle', { cx: '9.353', cy: '9.353', r: '6.353', fill: 'none', stroke: color, 'stroke-miterlimit': '10', 'stroke-width': '1.25' }),
      );
    case 'runnable':
    case 'microservice':
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
        h('path', { d: 'M13.78 4L10.22 20', stroke: color, 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        h('path', { d: 'M18 8L22 12L18 16', stroke: color, 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        h('path', { d: 'M6 16L2 12L6 8', stroke: color, 'stroke-width': '1.25', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      );
    default:
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
        h('rect', { x: '8.294', y: '8.294', width: '12.706', height: '12.706', rx: '2.118', fill: 'none', stroke: color, 'stroke-miterlimit': '10', 'stroke-width': '1.25' }),
        h('circle', { cx: '9.353', cy: '9.353', r: '6.353', fill: 'none', stroke: color, 'stroke-miterlimit': '10', 'stroke-width': '1.25' }),
      );
  }
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
      el.style.height = `${Math.min(el.scrollHeight, 190)}px`;
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
    selectedTags.value = [];
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
    selectedTags.value = [];
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
          artifactIds: [],
          tagIds: selectedTags.value.map(t => t.id),
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
    selectedTags.value = [];

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
    icon: PartTypeIcon({ type: p.part_type }),
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

  function handleTagSearch(query: string): void {
    tagSearchLoading.value = true;
    chrome.runtime.sendMessage(
      { action: 'SEARCH_TAGS', query, limit: 20 },
      (response: { action?: string; tags?: unknown[] } | undefined) => {
        tagSearchLoading.value = false;
        if (response?.action === 'SEARCH_TAGS_RESULT') {
          tagSearchResults.value = (response.tags || []) as import('../../shared/types').DevRevTag[];
        }
      },
    );
  }

  const thumbnailCache = useSignal<Record<string, string>>({});

  useSignalEffect(() => {
    const users = userSearchResults.value;
    users.forEach((u) => {
      if (thumbnailCache.value[u.id]) return;

      if (u.display_picture_id) {
        chrome.runtime.sendMessage(
          { action: 'LOCATE_ARTIFACT', artifactId: u.display_picture_id },
          (response: { dataUrl?: string | null } | undefined) => {
            if (response?.dataUrl) {
              thumbnailCache.value = { ...thumbnailCache.value, [u.id]: response.dataUrl };
            } else if (u.thumbnail) {
              chrome.runtime.sendMessage(
                { action: 'FETCH_THUMBNAIL', url: u.thumbnail },
                (fallback: { dataUrl?: string | null } | undefined) => {
                  if (fallback?.dataUrl) {
                    thumbnailCache.value = { ...thumbnailCache.value, [u.id]: fallback.dataUrl };
                  }
                },
              );
            }
          },
        );
      } else if (u.thumbnail) {
        chrome.runtime.sendMessage(
          { action: 'FETCH_THUMBNAIL', url: u.thumbnail },
          (response: { dataUrl?: string | null } | undefined) => {
            if (response?.dataUrl) {
              thumbnailCache.value = { ...thumbnailCache.value, [u.id]: response.dataUrl };
            }
          },
        );
      }
    });
  });

  const ownerOptions = userSearchResults.value.map((u) => {
    const name = u.full_name || u.display_name;
    return {
      id: u.id,
      label: name,
      initials: getInitials(name),
      avatarUrl: thumbnailCache.value[u.id] || undefined,
      avatarBg: getAvatarColor(name),
    };
  });

  const priorityOptions = PRIORITY_OPTIONS.map((p) => ({
    id: p.id,
    label: p.label,
    colorBg: PRIORITY_COLORS[p.id]?.bg,
    colorText: PRIORITY_COLORS[p.id]?.text,
  }));

  // Chips disabled during streaming (before AI_DONE)
  const chipsDisabled = isLoading;

  return (
    <div class="nitpick-issue-card" role="dialog" aria-label="New issue form">
      <div class="nitpick-issue-header">
        <nav class="nitpick-issue-breadcrumb" aria-label="Breadcrumb">
          {devrevSelf.value?.org_name && (
            <>
              <span class="nitpick-issue-breadcrumb-org">{devrevSelf.value.org_name}</span>
              <svg class="nitpick-issue-breadcrumb-sep" width="16" height="16" viewBox="0 0 32 32" fill="currentColor">
                <path d="M12.3 8.3a1 1 0 0 1 1.4 0l7 7a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4-1.4L18.58 16l-6.3-6.3a1 1 0 0 1 0-1.4z"/>
              </svg>
            </>
          )}
          <span class="nitpick-issue-breadcrumb-current">New Issue</span>
        </nav>
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
            el.style.height = `${Math.min(el.scrollHeight, 190)}px`;
          }}
          rows={3}
        />
      )}

      {(croppedScreenshotUrl.value || viewportScreenshotUrl.value) && (
        <div class="nitpick-screenshots-section">
          <span class="nitpick-screenshots-label">Attaching screenshots:</span>
          <div class="nitpick-screenshots-row">
            {croppedScreenshotUrl.value && (
              <img
                src={croppedScreenshotUrl.value}
                alt="Cropped screenshot"
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
                aria-label="View cropped screenshot"
              />
            )}
            {viewportScreenshotUrl.value && (
              <img
                src={viewportScreenshotUrl.value}
                alt="Full viewport screenshot"
                class="nitpick-screenshot-thumbnail"
                onClick={() => {
                  const dataUrl = viewportScreenshotUrl.value!;
                  const byteString = atob(dataUrl.split(',')[1]);
                  const mimeType = dataUrl.split(':')[1].split(';')[0];
                  const ab = new ArrayBuffer(byteString.length);
                  const ia = new Uint8Array(ab);
                  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                  const blob = new Blob([ab], { type: mimeType });
                  window.open(URL.createObjectURL(blob), '_blank');
                }}
                role="button"
                aria-label="View full viewport screenshot"
              />
            )}
          </div>
        </div>
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
          selectedIcon={PartTypeIcon({ type: partSearchResults.value.find(p => p.id === form.partId)?.part_type })}
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
          selectedAvatarUrl={form.ownerId ? thumbnailCache.value[form.ownerId] : undefined}
          selectedAvatarBg={form.owner ? getAvatarColor(form.owner) : undefined}
          selectedInitials={form.owner ? getInitials(form.owner) : undefined}
        />
        <ChipDropdown
          label="Priority"
          value={form.priority}
          options={priorityOptions}
          onSelect={(id, label) => {
            issueFormData.value = { ...issueFormData.value, priority: label, priorityId: id };
          }}
          disabled={chipsDisabled}
          selectedColorBg={PRIORITY_COLORS[form.priorityId]?.bg}
          selectedColorText={PRIORITY_COLORS[form.priorityId]?.text}
        />
        <TagChipMultiSelect
          tags={tagSearchResults.value}
          selectedTags={selectedTags.value}
          onSearch={handleTagSearch}
          onToggle={(tag) => {
            const current = selectedTags.value;
            const exists = current.find(t => t.id === tag.id);
            selectedTags.value = exists
              ? current.filter(t => t.id !== tag.id)
              : [...current, tag];
          }}
          loading={tagSearchLoading.value}
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
