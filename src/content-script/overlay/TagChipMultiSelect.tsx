import { useSignal } from '@preact/signals';
import { useRef, useEffect } from 'preact/hooks';
import type { DevRevTag } from '../../shared/types';

interface TagChipMultiSelectProps {
  tags: DevRevTag[];
  selectedTags: DevRevTag[];
  onSearch: (query: string) => void;
  onToggle: (tag: DevRevTag) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function TagChipMultiSelect({
  tags,
  selectedTags,
  onSearch,
  onToggle,
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

  const selectedInList = tags.filter(t => selectedIds.has(t.id));
  const unselectedInList = tags.filter(t => !selectedIds.has(t.id));
  const selectedNotInSearch = selectedTags.filter(t => !tags.some(s => s.id === t.id));
  const orderedTags = [...selectedNotInSearch, ...selectedInList, ...unselectedInList];
  const showDivider = (selectedNotInSearch.length + selectedInList.length) > 0 && unselectedInList.length > 0;
  const dividerAfterIndex = selectedNotInSearch.length + selectedInList.length - 1;

  function renderChipContent() {
    if (selectedTags.length === 0) {
      return <>Tags</>;
    }
    if (selectedTags.length === 1) {
      const tag = selectedTags[0];
      return (
        <>
          {tag.color && <span class="nitpick-tag-dot" style={{ background: tag.color }} />}
          <span class="nitpick-chip-label">{tag.name}</span>
        </>
      );
    }
    const visibleDots = selectedTags.slice(0, 3);
    return (
      <>
        <span class="nitpick-tag-dots-stack">
          {visibleDots.map((tag, i) => (
            <span
              key={tag.id}
              class="nitpick-tag-dot-stacked"
              style={{
                background: tag.color || 'var(--fg-neutral-subtle)',
                zIndex: visibleDots.length - i,
                marginLeft: i === 0 ? '0' : '-4px',
              }}
            />
          ))}
        </span>
        {selectedTags.length} tags
      </>
    );
  }

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
        {renderChipContent()}
        <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor">
          <path d="M16.71 20.295h-1.42l-7-7 1.59-1.59a49 49 0 0 1 5.715 6.845h.81a49 49 0 0 1 5.715-6.845l1.59 1.59z"/>
        </svg>
      </button>

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
              {orderedTags.length === 0 && (
                <div class="nitpick-dropdown-empty">
                  {loading ? 'Searching...' : 'No tags found'}
                </div>
              )}
              {orderedTags.map((tag, index) => {
                const isSelected = selectedIds.has(tag.id);
                return (
                  <>
                    <button
                      key={tag.id}
                      class={`nitpick-dropdown-option ${isSelected ? 'nitpick-dropdown-option--highlighted' : ''}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={(e) => { e.stopPropagation(); onToggle(tag); }}
                      onMouseDown={handleSearchClick}
                    >
                      <span class={`nitpick-tag-checkbox ${isSelected ? 'nitpick-tag-checkbox--checked' : ''}`}>
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 32 32" fill="currentColor">
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
                    {showDivider && index === dividerAfterIndex && (
                      <div class="nitpick-dropdown-divider" />
                    )}
                  </>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
