import { useSignal, useComputed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { Button, Input } from '@xorkavi/arcade-gen';
import { STORAGE_KEYS, DEFAULT_DOMAINS } from '../shared/constants';

type FieldStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEVREV_API_BASES = [
  'https://api.devrev.ai',
  'https://api.dev.devrev-eng.ai',
];

async function validatePAT(pat: string): Promise<string | null> {
  for (const base of DEVREV_API_BASES) {
    try {
      const resp = await fetch(`${base}/dev-users.self`, {
        method: 'GET',
        headers: { Authorization: pat },
      });
      if (resp.ok) return null;
      if (resp.status === 401) continue;
    } catch {
      continue;
    }
  }
  try {
    const resp = await fetch(`${DEVREV_API_BASES[0]}/dev-users.self`, {
      method: 'GET',
      headers: { Authorization: pat },
    });
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
        if (result[STORAGE_KEYS.pat]) {
          pat.value = result[STORAGE_KEYS.pat] as string;
          patSavedValue.value = pat.value;
          patStatus.value = 'saved';
        }
        if (result[STORAGE_KEYS.openaiKey]) {
          openaiKey.value = result[STORAGE_KEYS.openaiKey] as string;
          openaiKeySavedValue.value = openaiKey.value;
          openaiKeyStatus.value = 'saved';
        }
        if (result[STORAGE_KEYS.domains]) domains.value = result[STORAGE_KEYS.domains] as string[];
      });
  }, []);

  const patSavedValue = useSignal('');
  const openaiKeySavedValue = useSignal('');

  const handleSavePAT = async () => {
    if (!pat.value.trim()) return;
    patStatus.value = 'saving';
    patMessage.value = '';
    const error = await validatePAT(pat.value.trim());
    await chrome.storage.local.set({ [STORAGE_KEYS.pat]: pat.value.trim() });
    patSavedValue.value = pat.value.trim();
    if (error) {
      patStatus.value = 'error';
      patMessage.value = error;
    } else {
      patStatus.value = 'saved';
      patMessage.value = 'Token verified and saved';
      chrome.runtime.sendMessage({ action: 'PREFETCH_DEVREV_DATA' });
    }
  };

  const handleSaveOpenAIKey = async () => {
    if (!openaiKey.value.trim()) return;
    openaiKeyStatus.value = 'saving';
    openaiKeyMessage.value = '';
    const error = await validateOpenAIKey(openaiKey.value.trim());
    await chrome.storage.local.set({ [STORAGE_KEYS.openaiKey]: openaiKey.value.trim() });
    openaiKeySavedValue.value = openaiKey.value.trim();
    if (error) {
      openaiKeyStatus.value = 'error';
      openaiKeyMessage.value = error;
    } else {
      openaiKeyStatus.value = 'saved';
      openaiKeyMessage.value = 'API key verified and saved';
    }
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

  const handleDomainKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDomain();
    }
  };

  const isSetup = useComputed(() => !pat.value && !openaiKey.value);
  const bothSaved = useComputed(() => patStatus.value === 'saved' && openaiKeyStatus.value === 'saved');

  const handleStartCommenting = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.runtime.sendMessage({ action: 'PREFETCH_DEVREV_DATA' });
      await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_COMMENT_MODE' });
      window.close();
    }
  };


  return (
    <div
      style={{
        width: '360px',
        padding: '32px',
        fontFamily: 'var(--core-font-text), sans-serif',
        backgroundColor: 'var(--surface-overlay)',
        color: 'var(--fg-neutral-prominent)',
      }}
    >
      <h1
        style={{
          fontSize: 'var(--typography-body-font-size)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--fg-neutral-prominent)',
          margin: '0 0 24px 0',
          lineHeight: '1.3',
        }}
      >
        {isSetup.value ? 'Setup Required' : 'Nitpick Settings'}
      </h1>

      {/* DevRev PAT */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Input
              label="DevRev Personal Access Token"
              type={showPat.value ? 'text' : 'password'}
              size="md"
              placeholder="Paste your token here"
              value={pat.value}
              onInput={(e: any) => {
                pat.value = (e.target as HTMLInputElement).value;
                if (pat.value !== patSavedValue.value) {
                  patStatus.value = 'idle';
                  patMessage.value = '';
                }
              }}
              onBlur={() => { patTouched.value = true; }}
              error={patEmpty.value ? 'A valid token is required to create issues' : undefined}
              helperText={!patEmpty.value ? (patMessage.value || 'Find this in DevRev > Settings > Account > Developer') : undefined}
            />
            <button
              type="button"
              onClick={() => { showPat.value = !showPat.value; }}
              style={{ position: 'absolute', right: '8px', top: '32px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--typography-callout-font-size)', color: 'var(--fg-neutral-subtle)', padding: '2px 4px' }}
            >
              {showPat.value ? 'Hide' : 'Show'}
            </button>
          </div>
          <Button
            variant={patStatus.value === 'error' ? 'destructive' : 'primary'}
            size="sm"
            onClick={handleSavePAT}
            disabled={!pat.value.trim() || patStatus.value === 'saving'}
            loading={patStatus.value === 'saving'}
            style={{ marginBottom: '22px' }}
          >
            {patStatus.value === 'saving' ? 'Verifying...' : patStatus.value === 'saved' ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {/* OpenAI API Key */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Input
              label="OpenAI API Key"
              type={showOpenaiKey.value ? 'text' : 'password'}
              size="md"
              placeholder="sk-..."
              value={openaiKey.value}
              onInput={(e: any) => {
                openaiKey.value = (e.target as HTMLInputElement).value;
                if (openaiKey.value !== openaiKeySavedValue.value) {
                  openaiKeyStatus.value = 'idle';
                  openaiKeyMessage.value = '';
                }
              }}
              onBlur={() => { openaiKeyTouched.value = true; }}
              error={openaiKeyEmpty.value ? 'A valid API key is required' : undefined}
              helperText={!openaiKeyEmpty.value ? (openaiKeyMessage.value || 'Used for AI-powered issue descriptions') : undefined}
            />
            <button
              type="button"
              onClick={() => { showOpenaiKey.value = !showOpenaiKey.value; }}
              style={{ position: 'absolute', right: '8px', top: '32px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--typography-callout-font-size)', color: 'var(--fg-neutral-subtle)', padding: '2px 4px' }}
            >
              {showOpenaiKey.value ? 'Hide' : 'Show'}
            </button>
          </div>
          <Button
            variant={openaiKeyStatus.value === 'error' ? 'destructive' : 'primary'}
            size="sm"
            onClick={handleSaveOpenAIKey}
            disabled={!openaiKey.value.trim() || openaiKeyStatus.value === 'saving'}
            loading={openaiKeyStatus.value === 'saving'}
            style={{ marginBottom: '22px' }}
          >
            {openaiKeyStatus.value === 'saving' ? 'Verifying...' : openaiKeyStatus.value === 'saved' ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Domain List */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: 'var(--typography-callout-font-size)', fontWeight: 'var(--font-weight-medium)', color: 'var(--fg-neutral-prominent)', margin: '0 0 4px 0', lineHeight: '1.4' }}>
          Active Domains
        </h2>
        <p style={{ fontSize: 'var(--typography-system-small-font-size)', color: 'var(--fg-neutral-subtle)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
          Nitpick activates on these domains
        </p>
        <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '8px' }}>
          {domains.value.length === 0 && (
            <p style={{ fontSize: 'var(--typography-system-small-font-size)', color: 'var(--fg-neutral-subtle)', margin: '0', padding: '8px', textAlign: 'center', lineHeight: '1.4' }}>
              No domains configured. Add a domain to get started.
            </p>
          )}
          {domains.value.map((domain) => (
            <div
              key={domain}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--input-bg-idle)', borderRadius: 'var(--corner-square)', marginBottom: '4px' }}
            >
              <span style={{ fontSize: 'var(--typography-system-font-size)', color: 'var(--fg-neutral-prominent)' }}>{domain}</span>
              <button
                type="button"
                onClick={() => handleRemoveDomain(domain)}
                aria-label={`Remove ${domain}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-neutral-subtle)', fontSize: 'var(--typography-callout-font-size)', padding: '0 4px', lineHeight: '1' }}
              >
                x
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Input
              size="sm"
              placeholder="example.com"
              value={newDomain.value}
              onInput={(e: any) => {
                newDomain.value = (e.target as HTMLInputElement).value;
                domainError.value = '';
              }}
              onKeyDown={handleDomainKeyDown}
              error={domainError.value || undefined}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddDomain}
          >
            Add
          </Button>
        </div>
      </div>

      {bothSaved.value && (
        <Button
          variant="expressive"
          size="md"
          onClick={handleStartCommenting}
          style={{ width: '100%' }}
        >
          Start Commenting
        </Button>
      )}
    </div>
  );
}
