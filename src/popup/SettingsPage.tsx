import { useSignal, useComputed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { STORAGE_KEYS, DEFAULT_DOMAINS } from '../shared/constants';

export function SettingsPage() {
  const pat = useSignal('');
  const openaiKey = useSignal('');
  const domains = useSignal<string[]>([...DEFAULT_DOMAINS]);
  const newDomain = useSignal('');

  const patTouched = useSignal(false);
  const openaiKeyTouched = useSignal(false);
  const domainError = useSignal('');

  const showPat = useSignal(false);
  const showOpenaiKey = useSignal(false);

  const saveStatus = useSignal<'idle' | 'saving' | 'saved'>('idle');

  const patError = useComputed(() =>
    patTouched.value && !pat.value
      ? 'A valid token is required to create issues'
      : '',
  );

  const openaiKeyError = useComputed(() =>
    openaiKeyTouched.value && !openaiKey.value
      ? 'A valid API key is required'
      : '',
  );

  const isSetup = useComputed(() => !pat.value && !openaiKey.value);
  const canSave = useComputed(() => !!pat.value && !!openaiKey.value);

  // Load existing settings on mount
  useEffect(() => {
    chrome.storage.local
      .get([STORAGE_KEYS.pat, STORAGE_KEYS.openaiKey, STORAGE_KEYS.domains])
      .then((result) => {
        if (result[STORAGE_KEYS.pat]) {
          pat.value = result[STORAGE_KEYS.pat] as string;
        }
        if (result[STORAGE_KEYS.openaiKey]) {
          openaiKey.value = result[STORAGE_KEYS.openaiKey] as string;
        }
        if (result[STORAGE_KEYS.domains]) {
          domains.value = result[STORAGE_KEYS.domains] as string[];
        }
      });
  }, []);

  const handleSave = async () => {
    if (!canSave.value) return;
    saveStatus.value = 'saving';
    await chrome.storage.local.set({
      [STORAGE_KEYS.pat]: pat.value,
      [STORAGE_KEYS.openaiKey]: openaiKey.value,
      [STORAGE_KEYS.domains]: domains.value,
    });
    saveStatus.value = 'saved';
    setTimeout(() => {
      saveStatus.value = 'idle';
    }, 1500);
  };

  const handleAddDomain = () => {
    const value = newDomain.value.trim().toLowerCase();
    if (!value) return;

    // Basic domain validation
    const domainPattern = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
    if (!domainPattern.test(value)) {
      domainError.value = 'Enter a valid domain';
      return;
    }
    if (domains.value.includes(value)) {
      domainError.value = 'Domain already added';
      return;
    }

    domains.value = [...domains.value, value];
    newDomain.value = '';
    domainError.value = '';
  };

  const handleRemoveDomain = (domain: string) => {
    domains.value = domains.value.filter((d) => d !== domain);
  };

  const handleDomainKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDomain();
    }
  };

  return (
    <div
      style={{
        width: '360px',
        padding: '32px',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#FFFFFF',
      }}
    >
      {/* Heading */}
      <h1
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#1A1A1A',
          margin: '0 0 24px 0',
          lineHeight: '1.3',
        }}
      >
        {isSetup.value ? 'Setup Required' : 'Nitpick Settings'}
      </h1>

      {/* DevRev PAT Field */}
      <div style={{ marginBottom: '16px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 500,
            color: '#1A1A1A',
            marginBottom: '6px',
            lineHeight: '1.4',
          }}
        >
          DevRev Personal Access Token
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPat.value ? 'text' : 'password'}
            value={pat.value}
            placeholder="Paste your token here"
            onInput={(e) => {
              pat.value = (e.target as HTMLInputElement).value;
            }}
            onBlur={() => {
              patTouched.value = true;
            }}
            style={{
              width: '100%',
              padding: '8px 36px 8px 12px',
              backgroundColor: '#F5F5F5',
              border: `1px solid ${patError.value ? '#DC2626' : '#E5E5E5'}`,
              borderRadius: '6px',
              fontSize: '14px',
              color: '#1A1A1A',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => {
              showPat.value = !showPat.value;
            }}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#666666',
              padding: '2px 4px',
            }}
          >
            {showPat.value ? 'Hide' : 'Show'}
          </button>
        </div>
        <p
          style={{
            fontSize: '11px',
            color: patError.value ? '#DC2626' : '#666666',
            margin: '4px 0 0 0',
            lineHeight: '1.4',
          }}
        >
          {patError.value ||
            'Find this in DevRev > Settings > Account > Developer'}
        </p>
      </div>

      {/* OpenAI API Key Field */}
      <div style={{ marginBottom: '16px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 500,
            color: '#1A1A1A',
            marginBottom: '6px',
            lineHeight: '1.4',
          }}
        >
          OpenAI API Key
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showOpenaiKey.value ? 'text' : 'password'}
            value={openaiKey.value}
            placeholder="sk-..."
            onInput={(e) => {
              openaiKey.value = (e.target as HTMLInputElement).value;
            }}
            onBlur={() => {
              openaiKeyTouched.value = true;
            }}
            style={{
              width: '100%',
              padding: '8px 36px 8px 12px',
              backgroundColor: '#F5F5F5',
              border: `1px solid ${openaiKeyError.value ? '#DC2626' : '#E5E5E5'}`,
              borderRadius: '6px',
              fontSize: '14px',
              color: '#1A1A1A',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => {
              showOpenaiKey.value = !showOpenaiKey.value;
            }}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#666666',
              padding: '2px 4px',
            }}
          >
            {showOpenaiKey.value ? 'Hide' : 'Show'}
          </button>
        </div>
        <p
          style={{
            fontSize: '11px',
            color: openaiKeyError.value ? '#DC2626' : '#666666',
            margin: '4px 0 0 0',
            lineHeight: '1.4',
          }}
        >
          {openaiKeyError.value || 'Used for AI-powered issue descriptions'}
        </p>
      </div>

      {/* Domain List Section */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#1A1A1A',
            margin: '0 0 4px 0',
            lineHeight: '1.4',
          }}
        >
          Active Domains
        </h2>
        <p
          style={{
            fontSize: '11px',
            color: '#666666',
            margin: '0 0 8px 0',
            lineHeight: '1.4',
          }}
        >
          Nitpick activates on these domains
        </p>

        {/* Domain list */}
        <div
          style={{
            maxHeight: '120px',
            overflowY: 'auto',
            marginBottom: '8px',
          }}
        >
          {domains.value.length === 0 && (
            <p
              style={{
                fontSize: '11px',
                color: '#666666',
                margin: '0',
                padding: '8px',
                textAlign: 'center',
                lineHeight: '1.4',
              }}
            >
              No domains configured. Add a domain to get started.
            </p>
          )}
          {domains.value.map((domain) => (
            <div
              key={domain}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                backgroundColor: '#F5F5F5',
                borderRadius: '4px',
                marginBottom: '4px',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  color: '#1A1A1A',
                }}
              >
                {domain}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveDomain(domain)}
                aria-label={`Remove ${domain}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#999999',
                  fontSize: '14px',
                  padding: '0 4px',
                  lineHeight: '1',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Add domain input */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={newDomain.value}
            placeholder="example.com"
            onInput={(e) => {
              newDomain.value = (e.target as HTMLInputElement).value;
              domainError.value = '';
            }}
            onKeyDown={handleDomainKeyDown}
            style={{
              flex: 1,
              padding: '6px 10px',
              backgroundColor: '#F5F5F5',
              border: `1px solid ${domainError.value ? '#DC2626' : '#E5E5E5'}`,
              borderRadius: '6px',
              fontSize: '13px',
              color: '#1A1A1A',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={handleAddDomain}
            style={{
              padding: '6px 12px',
              backgroundColor: '#F5F5F5',
              border: '1px solid #E5E5E5',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#1A1A1A',
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
        {domainError.value && (
          <p
            style={{
              fontSize: '11px',
              color: '#DC2626',
              margin: '4px 0 0 0',
              lineHeight: '1.4',
            }}
          >
            {domainError.value}
          </p>
        )}
      </div>

      {/* Save Button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave.value || saveStatus.value === 'saving'}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: canSave.value ? '#0D99FF' : '#B0D9F7',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: canSave.value ? 'pointer' : 'not-allowed',
          opacity: saveStatus.value === 'saving' ? 0.7 : 1,
        }}
      >
        {saveStatus.value === 'saved' ? 'Saved \u2713' : 'Save Settings'}
      </button>
    </div>
  );
}
