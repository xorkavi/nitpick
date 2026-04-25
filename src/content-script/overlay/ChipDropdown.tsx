import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';

interface ChipDropdownOption {
  id: string;
  label: string;
  description?: string;
}

interface ChipDropdownProps {
  label: string;       // "Part" | "Owner" | "Priority"
  value: string;       // Current selection display text
  options: ChipDropdownOption[];
  onSelect: (id: string, label: string) => void;
  suggested?: string;  // AI-suggested option ID (shown with AI badge)
  disabled?: boolean;  // Disabled during streaming
}

export function ChipDropdown({ label, value, options, onSelect, suggested, disabled }: ChipDropdownProps) {
  const isOpen = useSignal(false);
  const search = useSignal('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        isOpen.value = false;
        search.value = '';
      }
    }

    if (isOpen.value) {
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }
  });

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.value.toLowerCase()),
  );

  function handleToggle(): void {
    if (disabled) return;
    isOpen.value = !isOpen.value;
    if (!isOpen.value) {
      search.value = '';
    }
  }

  function handleSelect(opt: ChipDropdownOption): void {
    onSelect(opt.id, opt.label);
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
        <div class="nitpick-dropdown-menu" role="listbox" aria-label={`${label} options`}>
          <input
            class="nitpick-dropdown-search"
            placeholder={`Search ${label.toLowerCase()}...`}
            value={search.value}
            onInput={(e) => {
              search.value = (e.target as HTMLInputElement).value;
            }}
            autoFocus
          />
          <div class="nitpick-dropdown-options">
            {filtered.length === 0 && (
              <div class="nitpick-dropdown-empty">No matches</div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.id}
                class={`nitpick-dropdown-option ${opt.id === suggested ? 'nitpick-dropdown-option--suggested' : ''}`}
                role="option"
                aria-selected={opt.label === value}
                onClick={() => handleSelect(opt)}
              >
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
      )}
    </div>
  );
}
