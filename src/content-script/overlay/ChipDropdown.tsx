import { useSignal } from '@preact/signals';
import { useRef } from 'preact/hooks';

interface ChipDropdownOption {
  id: string;
  label: string;
  description?: string;
  initials?: string;
  avatarUrl?: string;
  searchText?: string;
}

interface ChipDropdownProps {
  label: string;
  value: string;
  options: ChipDropdownOption[];
  onSelect: (id: string, label: string) => void;
  suggested?: string;
  disabled?: boolean;
}

export function ChipDropdown({ label, value, options, onSelect, suggested, disabled }: ChipDropdownProps) {
  const isOpen = useSignal(false);
  const search = useSignal('');
  const containerRef = useRef<HTMLDivElement>(null);

  const q = search.value.toLowerCase();
  const filtered = options.filter((opt) =>
    (opt.searchText || opt.label.toLowerCase()).includes(q),
  );

  function handleToggle(e: MouseEvent): void {
    e.stopPropagation();
    if (disabled) return;
    isOpen.value = !isOpen.value;
    if (!isOpen.value) {
      search.value = '';
    }
  }

  function handleSelect(e: MouseEvent, opt: ChipDropdownOption): void {
    e.stopPropagation();
    onSelect(opt.id, opt.label);
    isOpen.value = false;
    search.value = '';
  }

  function handleSearchClick(e: MouseEvent): void {
    e.stopPropagation();
  }

  function handleBackdropClick(e: MouseEvent): void {
    e.stopPropagation();
    isOpen.value = false;
    search.value = '';
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
        {value || label}
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M2 4L5 7L8 4" stroke="currentColor" stroke-width="1.2" fill="none" />
        </svg>
      </button>

      {isOpen.value && (
        <>
          <div class="nitpick-dropdown-backdrop" onClick={handleBackdropClick} />
          <div class="nitpick-dropdown-menu" role="listbox" aria-label={`${label} options`}>
            <input
              class="nitpick-dropdown-search"
              placeholder={`Search ${label.toLowerCase()}...`}
              value={search.value}
              onInput={(e) => {
                search.value = (e.target as HTMLInputElement).value;
              }}
              onClick={handleSearchClick}
              onMouseDown={handleSearchClick}
              autoFocus
            />
            <div class="nitpick-dropdown-options">
              {filtered.length === 0 && (
                <div class="nitpick-dropdown-empty">
                  {options.length === 0 ? 'Loading...' : 'No matches'}
                </div>
              )}
              {filtered.map((opt) => (
                <button
                  key={opt.id}
                  class={`nitpick-dropdown-option ${opt.id === suggested ? 'nitpick-dropdown-option--suggested' : ''}`}
                  role="option"
                  aria-selected={opt.label === value}
                  onClick={(e) => handleSelect(e as unknown as MouseEvent, opt)}
                  onMouseDown={handleSearchClick}
                >
                  {(opt.initials || opt.avatarUrl) && (
                    <span class="nitpick-avatar">
                      {opt.avatarUrl
                        ? <img src={opt.avatarUrl} alt={opt.label} />
                        : opt.initials}
                    </span>
                  )}
                  <span class="nitpick-dropdown-option-label">
                    {opt.label}
                    {opt.description && (
                      <span class="nitpick-dropdown-option-desc">{opt.description}</span>
                    )}
                  </span>
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
