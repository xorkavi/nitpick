import { useSignal } from '@preact/signals';
import { useRef, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

export interface ChipDropdownOption {
  id: string;
  label: string;
  description?: string;
  initials?: string;
  avatarUrl?: string;
  searchText?: string;
  icon?: ComponentChildren;
  colorBg?: string;
  colorText?: string;
}

interface ChipDropdownProps {
  label: string;
  value: string;
  options: ChipDropdownOption[];
  onSelect: (id: string, label: string) => void;
  onSearch?: (query: string) => void;
  suggested?: string;
  disabled?: boolean;
  loading?: boolean;
  selectedIcon?: ComponentChildren;
  selectedColorBg?: string;
  selectedColorText?: string;
}

export function ChipDropdown({ label, value, options, onSelect, onSearch, suggested, disabled, loading, selectedIcon, selectedColorBg, selectedColorText }: ChipDropdownProps) {
  const isOpen = useSignal(false);
  const flipUp = useSignal(false);
  const alignRight = useSignal(false);
  const search = useSignal('');
  const highlightIndex = useSignal(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen.value && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  });

  const q = search.value.toLowerCase();
  const filtered = onSearch
    ? options
    : options.filter((opt) => (opt.searchText || opt.label.toLowerCase()).includes(q));

  function selectOption(opt: ChipDropdownOption): void {
    onSelect(opt.id, opt.label);
    isOpen.value = false;
    search.value = '';
    highlightIndex.value = 0;
  }

  function handleToggle(e: MouseEvent): void {
    e.stopPropagation();
    if (disabled) return;
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
      if (onSearch) onSearch('');
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = 264;
        const dropdownWidth = 240;
        flipUp.value = spaceBelow < dropdownHeight;
        alignRight.value = (rect.left + dropdownWidth) > window.innerWidth;
      }
    } else {
      search.value = '';
      highlightIndex.value = 0;
    }
  }

  function handleSelect(e: MouseEvent, opt: ChipDropdownOption): void {
    e.stopPropagation();
    selectOption(opt);
  }

  function handleSearchClick(e: MouseEvent): void {
    e.stopPropagation();
  }

  function handleBackdropClick(e: MouseEvent): void {
    e.stopPropagation();
    isOpen.value = false;
    search.value = '';
    highlightIndex.value = 0;
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (!isOpen.value) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightIndex.value = Math.min(highlightIndex.value + 1, filtered.length - 1);
      scrollHighlightedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIndex.value = Math.max(highlightIndex.value - 1, 0);
      scrollHighlightedIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0 && highlightIndex.value < filtered.length) {
        selectOption(filtered[highlightIndex.value]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isOpen.value = false;
      search.value = '';
      highlightIndex.value = 0;
    }
  }

  function scrollHighlightedIntoView(): void {
    setTimeout(() => {
      const container = optionsRef.current;
      if (!container) return;
      const highlighted = container.querySelector('.nitpick-dropdown-option--highlighted');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }, 0);
  }

  function handleSearchInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    search.value = val;
    highlightIndex.value = 0;

    if (onSearch) {
      clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        onSearch(val);
      }, 200);
    }
  }

  return (
    <div class="nitpick-chip-dropdown" ref={containerRef}>
      <button
        class={`nitpick-chip ${disabled ? 'nitpick-chip--disabled' : ''} ${value ? 'nitpick-chip--selected' : ''}`}
        onClick={handleToggle}
        aria-label={`Select ${label}`}
        aria-expanded={isOpen.value}
        aria-haspopup="listbox"
        disabled={disabled}
      >
        {selectedIcon && value && <span class="nitpick-chip-icon">{selectedIcon}</span>}
        {value && selectedColorBg ? (
          <span class="nitpick-chip-priority-label" style={{ background: selectedColorBg, color: selectedColorText }}>{value}</span>
        ) : (
          <span class="nitpick-chip-label">{value || label}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor">
          <path d="M16.71 20.295h-1.42l-7-7 1.59-1.59a49 49 0 0 1 5.715 6.845h.81a49 49 0 0 1 5.715-6.845l1.59 1.59z"/>
        </svg>
      </button>

      {isOpen.value && (
        <>
          <div class="nitpick-dropdown-backdrop" onClick={handleBackdropClick} />
          <div class={`nitpick-dropdown-menu ${flipUp.value ? 'nitpick-dropdown-menu--flip' : ''} ${alignRight.value ? 'nitpick-dropdown-menu--right' : ''}`} role="listbox" aria-label={`${label} options`}>
            <input
              ref={searchRef}
              class="nitpick-dropdown-search"
              placeholder={`Search ${label.toLowerCase()}...`}
              value={search.value}
              onInput={handleSearchInput}
              onKeyDown={handleKeyDown}
              onClick={handleSearchClick}
              onMouseDown={handleSearchClick}
            />
            <div class="nitpick-dropdown-options" ref={optionsRef}>
              {filtered.length === 0 && (
                <div class="nitpick-dropdown-empty">
                  {loading ? 'Searching...' : options.length === 0 ? 'Type to search...' : 'No matches'}
                </div>
              )}
              {filtered.map((opt, i) => (
                <button
                  key={opt.id}
                  class={`nitpick-dropdown-option ${i === highlightIndex.value ? 'nitpick-dropdown-option--highlighted' : ''} ${opt.id === suggested ? 'nitpick-dropdown-option--suggested' : ''}`}
                  role="option"
                  aria-selected={opt.label === value}
                  onClick={(e) => handleSelect(e as unknown as MouseEvent, opt)}
                  onMouseDown={handleSearchClick}
                  onMouseEnter={() => { highlightIndex.value = i; }}
                >
                  {opt.icon && <span class="nitpick-chip-icon">{opt.icon}</span>}
                  {(opt.initials || opt.avatarUrl) && (
                    <span class="nitpick-avatar">
                      {opt.avatarUrl
                        ? <img src={opt.avatarUrl} alt={opt.label} />
                        : opt.initials}
                    </span>
                  )}
                  {opt.colorBg ? (
                    <span class="nitpick-chip-priority-label" style={{ background: opt.colorBg, color: opt.colorText }}>
                      {opt.label}
                    </span>
                  ) : (
                    <span class="nitpick-dropdown-option-label">
                      {opt.label}
                      {opt.description && (
                        <span class="nitpick-dropdown-option-desc">{opt.description}</span>
                      )}
                    </span>
                  )}
                  {opt.id === suggested && <span class="nitpick-ai-badge">AI</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
