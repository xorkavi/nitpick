import { useSignal, useComputed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { STORAGE_KEYS, DEFAULT_DOMAINS } from '../shared/constants';

type FieldStatus = 'idle' | 'saving' | 'saved' | 'error';

async function validatePAT(pat: string): Promise<string | null> {
  try {
    const resp = await fetch('https://api.devrev.ai/dev-users.self', {
      method: 'GET',
      headers: { Authorization: pat },
    });
    if (resp.ok) return null;
    if (resp.status === 401) return 'Invalid token — authentication failed';
    return `Validation failed (HTTP ${resp.status})`;
  } catch {
    return 'Could not reach DevRev API — token saved without validation';
  }
}

async function validateOpenAIKey(key: string): Promise<string | null> {
  try {
    const resp = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
    });
    if (resp.ok) return null;
    if (resp.status === 401) return 'Invalid API key — authentication failed';
    return `Validation failed (HTTP ${resp.status})`;
  } catch {
    return 'Could not reach OpenAI API — key saved without validation';
  }
}

export function SettingsPage() {
  const pat = useSignal('');
  const openaiKey = useSignal('');
  const domains = useSignal<string[]>([...DEFAULT_DOMAINS]);
  const newDomain = useSignal('');

  const patStatus = useSignal<FieldStatus>('idle');
  const openaiKeyStatus = useSignal<FieldStatus>('idle');
  const patMessage = useSignal('');
  const openaiKeyMessage = useSignal('');

  const domainError = useSignal('');

  const showPat = useSignal(false);
  const showOpenaiKey = useSignal(false);

  const patTouched = useSignal(false);
  const openaiKeyTouched = useSignal(false);

  const patEmpty = useComputed(() => patTouched.value && !pat.value);
  const openaiKeyEmpty = useComputed(() => openaiKeyTouched.value && !openaiKey.value);

  useEffect(() => {
    chrome.storage.local
      .get([STORAGE_KEYS.pat, STORAGE_KEYS.openaiKey, STORAGE_KEYS.domains])
      .then((result) => {
        if (result[STORAGE_KEYS.pat]) pat.value = result[STORAGE_KEYS.pat] as string;
        if (result[STORAGE_KEYS.openaiKey]) openaiKey.value = result[STORAGE_KEYS.openaiKey] as string;
        if (result[STORAGE_KEYS.domains]) domains.value = result[STORAGE_KEYS.domains] as string[];
      });
  }, []);

  const handleSavePAT = async () => {
    if (!pat.value.trim()) return;
    patStatus.value = 'saving';
    patMessage.value = '';
    const error = await validatePAT(pat.value.trim());
    await chrome.storage.local.set({ [STORAGE_KEYS.pat]: pat.value.trim() });
    if (error) {
      patStatus.value = 'error';
      patMessage.value = error;
    } else {
      patStatus.value = 'saved';
      patMessage.value = 'Token verified and saved';
    }
    setTimeout(() => { patStatus.value = 'idle'; }, 3000);
  };

  const handleSaveOpenAIKey = async () => {
    if (!openaiKey.value.trim()) return;
    openaiKeyStatus.value = 'saving';
    openaiKeyMessage.value = '';
    const error = await validateOpenAIKey(openaiKey.value.trim());
    await chrome.storage.local.set({ [STORAGE_KEYS.openaiKey]: openaiKey.value.trim() });
    if (error) {
      openaiKeyStatus.value = 'error';
      openaiKeyMessage.value = error;
    } else {
      openaiKeyStatus.value = 'saved';
      openaiKeyMessage.value = 'API key verified and saved';
    }
    setTimeout(() => { openaiKeyStatus.value = 'idle'; }, 3000);
  };

  const handleSaveDomains = async () => {
    await chrome.storage.local.set({ [STORAGE_KEYS.domains]: domains.value });
  };

  const handleAddDomain = () => {
    const value = newDomain.value.trim().toLowerCase();
    if (!value) return;
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
    handleSaveDomains();
  };

  const handleRemoveDomain = (domain: string) => {
    domains.value = domains.value.filter((d) => d !== domain);
    handleSaveDomains();
  };

  const handleDomainKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDomain();
    }
  };

  const isSetup = useComputed(() => !pat.value && !openaiKey.value);

  const fieldBtnStyle = (status: FieldStatus, hasValue: boolean) => ({
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: hasValue && status !== 'saving' ? 'pointer' : 'not-allowed',
    backgroundColor: status === 'saved' ? '#16a34a' : status === 'error' ? '#DC2626' : hasValue ? '#0D99FF' : '#B0D9F7',
    color: '#FFFFFF',
    opacity: status === 'saving' ? 0.7 : 1,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  });

  const fieldMessageStyle = (status: FieldStatus) => ({
    fontSize: '11px',
    color: status === 'error' ? '#DC2626' : status === 'saved' ? '#16a34a' : '#666666',
    margin: '4px 0 0 0',
    lineHeight: '1.4',
  });

  return (
    <div
      style={{
        width: '360px',
        padding: '32px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#FFFFFF',
      }}
    >
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

      {/* DevRev PAT */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#1A1A1A', marginBottom: '6px', lineHeight: '1.4' }}>
          DevRev Personal Access Token
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type={showPat.value ? 'text' : 'password'}
              value={pat.value}
              placeholder="Paste your token here"
              onInput={(e) => { pat.value = (e.target as HTMLInputElement).value; }}
              onBlur={() => { patTouched.value = true; }}
              style={{
                width: '100%',
                padding: '8px 36px 8px 12px',
                backgroundColor: '#F5F5F5',
                border: `1px solid ${patEmpty.value ? '#DC2626' : '#E5E5E5'}`,
                borderRadius: '6px',
                fontSize: '14px',
                color: '#1A1A1A',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => { showPat.value = !showPat.value; }}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#666666', padding: '2px 4px' }}
            >
              {showPat.value ? 'Hide' : 'Show'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSavePAT}
            disabled={!pat.value.trim() || patStatus.value === 'saving'}
            style={fieldBtnStyle(patStatus.value, !!pat.value.trim())}
          >
            {patStatus.value === 'saving' ? 'Verifying...' : patStatus.value === 'saved' ? 'Saved' : patStatus.value === 'error' ? 'Saved' : 'Save'}
          </button>
        </div>
        <p style={fieldMessageStyle(patStatus.value)}>
          {patEmpty.value
            ? 'A valid token is required to create issues'
            : patMessage.value || 'Find this in DevRev > Settings > Account > Developer'}
        </p>
      </div>

      {/* OpenAI API Key */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#1A1A1A', marginBottom: '6px', lineHeight: '1.4' }}>
          OpenAI API Key
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type={showOpenaiKey.value ? 'text' : 'password'}
              value={openaiKey.value}
              placeholder="sk-..."
              onInput={(e) => { openaiKey.value = (e.target as HTMLInputElement).value; }}
              onBlur={() => { openaiKeyTouched.value = true; }}
              style={{
                width: '100%',
                padding: '8px 36px 8px 12px',
                backgroundColor: '#F5F5F5',
                border: `1px solid ${openaiKeyEmpty.value ? '#DC2626' : '#E5E5E5'}`,
                borderRadius: '6px',
                fontSize: '14px',
                color: '#1A1A1A',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => { showOpenaiKey.value = !showOpenaiKey.value; }}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#666666', padding: '2px 4px' }}
            >
              {showOpenaiKey.value ? 'Hide' : 'Show'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSaveOpenAIKey}
            disabled={!openaiKey.value.trim() || openaiKeyStatus.value === 'saving'}
            style={fieldBtnStyle(openaiKeyStatus.value, !!openaiKey.value.trim())}
          >
            {openaiKeyStatus.value === 'saving' ? 'Verifying...' : openaiKeyStatus.value === 'saved' ? 'Saved' : openaiKeyStatus.value === 'error' ? 'Saved' : 'Save'}
          </button>
        </div>
        <p style={fieldMessageStyle(openaiKeyStatus.value)}>
          {openaiKeyEmpty.value
            ? 'A valid API key is required'
            : openaiKeyMessage.value || 'Used for AI-powered issue descriptions'}
        </p>
      </div>

      {/* Domain List */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 500, color: '#1A1A1A', margin: '0 0 4px 0', lineHeight: '1.4' }}>
          Active Domains
        </h2>
        <p style={{ fontSize: '11px', color: '#666666', margin: '0 0 8px 0', lineHeight: '1.4' }}>
          Nitpick activates on these domains
        </p>
        <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '8px' }}>
          {domains.value.length === 0 && (
            <p style={{ fontSize: '11px', color: '#666666', margin: '0', padding: '8px', textAlign: 'center', lineHeight: '1.4' }}>
              No domains configured. Add a domain to get started.
            </p>
          )}
          {domains.value.map((domain) => (
            <div
              key={domain}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: '#F5F5F5', borderRadius: '4px', marginBottom: '4px' }}
            >
              <span style={{ fontSize: '13px', color: '#1A1A1A' }}>{domain}</span>
              <button
                type="button"
                onClick={() => handleRemoveDomain(domain)}
                aria-label={`Remove ${domain}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999999', fontSize: '14px', padding: '0 4px', lineHeight: '1' }}
              >
                x
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={newDomain.value}
            placeholder="example.com"
            onInput={(e) => { newDomain.value = (e.target as HTMLInputElement).value; domainError.value = ''; }}
            onKeyDown={handleDomainKeyDown}
            style={{ flex: 1, padding: '6px 10px', backgroundColor: '#F5F5F5', border: `1px solid ${domainError.value ? '#DC2626' : '#E5E5E5'}`, borderRadius: '6px', fontSize: '13px', color: '#1A1A1A', outline: 'none', boxSizing: 'border-box' }}
          />
          <button
            type="button"
            onClick={handleAddDomain}
            style={{ padding: '6px 12px', backgroundColor: '#F5F5F5', border: '1px solid #E5E5E5', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: '#1A1A1A', cursor: 'pointer' }}
          >
            Add
          </button>
        </div>
        {domainError.value && (
          <p style={{ fontSize: '11px', color: '#DC2626', margin: '4px 0 0 0', lineHeight: '1.4' }}>
            {domainError.value}
          </p>
        )}
      </div>
    </div>
  );
}
