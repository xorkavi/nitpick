import { useSignal } from '@preact/signals';
import { useRef, useEffect } from 'preact/hooks';
import type { DevRevTag } from '../../shared/types';

interface TagChipMultiSelectProps {
  tags: DevRevTag[];
  selectedTags: DevRevTag[];
  onSearch: (query: string) => void;
  onToggle: (tag: DevRevTag) => void;
  onRemove: (tagId: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function TagChipMultiSelect({
  tags,
  selectedTags,
  onSearch,
  onToggle,
  onRemove,
  loading,
  disabled,
}: TagChipMultiSelectProps) {
  const isOpen = useSignal(false);
  const flipUp = useSignal(false);
  const alignRight = useSignal(false);
  const search = useSignal('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen.value && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  });

  function handleToggle(e: MouseEvent): void {
    e.stopPropagation();
    if (disabled) return;
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
      onSearch('');
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const dropdownHeight = 264;
        const dropdownWidth = 240;
        flipUp.value = (window.innerHeight - rect.bottom) < dropdownHeight;
        alignRight.value = (rect.left + dropdownWidth) > window.innerWidth;
      }
    } else {
      search.value = '';
    }
  }

  function handleBackdropClick(e: MouseEvent): void {
    e.stopPropagation();
    isOpen.value = false;
    search.value = '';
  }

  function handleSearchInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    search.value = val;
    clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => onSearch(val), 200);
  }

  function handleSearchClick(e: MouseEvent): void {
    e.stopPropagation();
  }

  const selectedIds = new Set(selectedTags.map(t => t.id));

  return (
    <div class="nitpick-chip-dropdown" ref={containerRef}>
      <button
        class={`nitpick-chip ${disabled ? 'nitpick-chip--disabled' : ''} ${selectedTags.length > 0 ? 'nitpick-chip--selected' : ''}`}
        onClick={handleToggle}
        aria-label="Select tags"
        aria-expanded={isOpen.value}
        aria-haspopup="listbox"
        disabled={disabled}
      >
        {selectedTags.length > 0 ? `Tags (${selectedTags.length})` : 'Tags'}
        <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor">
          <path d="M16.71 20.295h-1.42l-7-7 1.59-1.59a49 49 0 0 1 5.715 6.845h.81a49 49 0 0 1 5.715-6.845l1.59 1.59z"/>
        </svg>
      </button>

      {selectedTags.length > 0 && (
        <div class="nitpick-tag-pills">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              class="nitpick-tag-pill"
              style={tag.color ? { borderColor: tag.color } : undefined}
            >
              {tag.color && (
                <span class="nitpick-tag-dot" style={{ background: tag.color }} />
              )}
              {tag.name}
              <button
                class="nitpick-tag-pill-remove"
                onClick={(e) => { e.stopPropagation(); onRemove(tag.id); }}
                aria-label={`Remove ${tag.name}`}
              >
                <svg width="10" height="10" viewBox="0 0 32 32" fill="currentColor">
                  <path d="M17.208 16.194a100 100 0 0 1 6.662 6.081l-1.59 1.59c-1.2-1.16-2.32-2.39-3.45-3.62-.894-1.006-1.789-2.004-2.65-3.04H15.8a93 93 0 0 1-6.081 6.66l-1.59-1.59c1.17-1.19 2.4-2.32 3.63-3.45 1.006-.885 1.995-1.78 3.032-2.641v-.378A100 100 0 0 1 8.13 9.725l1.59-1.59c1.2 1.16 2.32 2.4 3.45 3.62.894 1.006 1.789 2.003 2.65 3.04h.378a93 93 0 0 1 6.082-6.66l1.59 1.59c-1.17 1.19-2.4 2.32-3.63 3.45-1.006.894-1.995 1.78-3.031 2.641z"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {isOpen.value && (
        <>
          <div class="nitpick-dropdown-backdrop" onClick={handleBackdropClick} />
          <div
            class={`nitpick-dropdown-menu ${flipUp.value ? 'nitpick-dropdown-menu--flip' : ''} ${alignRight.value ? 'nitpick-dropdown-menu--right' : ''}`}
            role="listbox"
            aria-label="Tags options"
            aria-multiselectable="true"
          >
            <input
              ref={searchRef}
              class="nitpick-dropdown-search"
              placeholder="Search tags..."
              value={search.value}
              onInput={handleSearchInput}
              onClick={handleSearchClick}
              onMouseDown={handleSearchClick}
            />
            <div class="nitpick-dropdown-options">
              {tags.length === 0 && (
                <div class="nitpick-dropdown-empty">
                  {loading ? 'Searching...' : 'No tags found'}
                </div>
              )}
              {tags.map((tag) => {
                const isSelected = selectedIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    class={`nitpick-dropdown-option ${isSelected ? 'nitpick-dropdown-option--highlighted' : ''}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={(e) => { e.stopPropagation(); onToggle(tag); }}
                    onMouseDown={handleSearchClick}
                  >
                    <span class="nitpick-tag-checkbox">
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor">
                          <path d="M23.735 9.825c-3.91 3.96-7.42 8.87-9.69 13.94h-1.6l-4.18-4.93 1.71-1.45a20.9 20.9 0 0 1 2.938 4.51l.45-.01c.728-1.924 3.43-8.283 8.782-13.65z"/>
                        </svg>
                      )}
                    </span>
                    {tag.color && (
                      <span class="nitpick-tag-dot" style={{ background: tag.color }} />
                    )}
                    <span class="nitpick-dropdown-option-label">
                      {tag.name}
                      {tag.description && (
                        <span class="nitpick-dropdown-option-desc">{tag.description}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
