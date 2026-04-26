import { useSignal, useComputed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { Button, Input, IconButton, Badge, Accordion } from '@xorkavi/arcade-gen';
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

function helperColor(status: FieldStatus): string {
  if (status === 'saved') return 'var(--feedback-fg-success-prominent)';
  if (status === 'error') return 'var(--feedback-fg-alert-prominent)';
  return 'var(--fg-neutral-subtle)';
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style={{ display: 'block' }}>
      <path d="M21.925 7.001v-1.86c.11-1.66-1.33-3.17-3-3.14h-5.28c-.1-.01-.63 0-.72 0-1.61-.03-3.02 1.39-3 3 .01.32 0 1.24 0 2h-5.85v2h1.97l1.49 12.17c.11.89.44 3.65.55 4.5.29 2.43 2.53 4.37 4.97 4.33.26.01.97-.02 1.23 0h4.52c2.26.03 4.37-1.62 4.87-3.83.49-3.24 1.6-12.88 2.14-17.17h2.11v-2zm-9.88-1.86c-.04-.5.3-1.01.82-1.08.13-.02.64-.02.78-.03 1.14-.03 3.43-.03 4.57.01.14.01.65.01.78.03.52.07.86.57.82 1.07.07.68.09 1.27.36 1.86h-8.49c.27-.59.29-1.18.36-1.86m10.2 15.78-.39 3.26-.09.82c-.02 1.58-1.35 2.99-2.96 2.97-.74.01-2.12.01-2.88.03-.75-.01-2.13-.01-2.87-.03-1.62.02-2.94-1.39-2.96-2.97l-.09-.82-.39-3.26c-.61-4.01-.71-8.06-2.05-11.92h16.72c-1.34 3.86-1.43 7.91-2.04 11.92"/>
      <path d="m12.554 22.998-.25-11h2.25l-.25 11zM17.554 22.998l-.25-11h2.25l-.25 11z"/>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style={{ display: 'block' }}>
      <path d="M28.33 11.305c-2.96-4.87-7.65-7.29-12.33-7.27-4.68-.02-9.37 2.4-12.33 7.27-.94 1.46-1.71 2.99-2.28 4.69.57 1.71 1.34 3.24 2.28 4.7 2.96 4.86 7.65 7.28 12.33 7.27 4.68.01 9.37-2.41 12.33-7.27.94-1.46 1.71-2.99 2.28-4.7-.57-1.7-1.34-3.23-2.28-4.69m-1.74 8.27c-2.56 4.18-6.58 6.26-10.59 6.25-4.01.01-8.03-2.07-10.59-6.25-.74-1.12-1.41-2.36-1.88-3.58.47-1.21 1.14-2.45 1.88-3.57 2.56-4.18 6.58-6.26 10.59-6.25 4.01-.01 8.03 2.07 10.59 6.25.74 1.12 1.41 2.36 1.88 3.57-.47 1.22-1.14 2.46-1.88 3.58"/>
      <path d="M23.077 15.998c.057 6.182-7.792 9.301-12.12 4.993-2.807-2.569-2.808-7.419.001-9.987 4.328-4.307 12.177-1.19 12.119 4.994m-2.25 0c-.182-6.603-9.57-6.6-9.75 0 .182 6.602 9.568 6.6 9.75 0"/>
    </svg>
  );
}

function EyeCrossedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" style={{ display: 'block' }}>
      <path d="M28.33 11.31C25.37 6.44 20.68 4.02 16 4.04c-.96 0-1.93.1-2.88.31L12.34 2h-2.11l.97 2.91c-2.92 1.08-5.6 3.22-7.53 6.4-.94 1.46-1.71 2.99-2.28 4.69.57 1.71 1.34 3.24 2.28 4.7 2.96 4.86 7.65 7.28 12.33 7.27.93 0 1.87-.09 2.79-.29l.77 2.32h2.11l-.96-2.87c2.96-1.08 5.67-3.22 7.62-6.43.94-1.46 1.71-2.99 2.28-4.7-.57-1.7-1.34-3.23-2.28-4.69m-14.87.39 3.07 9.21c-2.57.3-5.36-1.34-5.46-4.91.06-2.1 1.06-3.54 2.39-4.3m1.91-.61c2.57-.3 5.36 1.34 5.46 4.91-.06 2.1-1.06 3.54-2.39 4.3zM16 25.83c-4.01.01-8.03-2.07-10.59-6.25C4.67 18.46 4 17.22 3.53 16c.47-1.21 1.14-2.45 1.88-3.57 1.67-2.73 3.96-4.56 6.46-5.5l.93 2.77c-.66.32-1.28.75-1.84 1.31-2.81 2.56-2.81 7.41 0 9.98 1.75 1.74 4.08 2.27 6.22 1.87l.93 2.78c-.7.13-1.4.19-2.11.19m10.59-6.25c-1.69 2.76-4.01 4.6-6.55 5.53l-.96-2.87c2.29-1.09 4.02-3.32 4-6.24.04-4.62-4.35-7.53-8.37-6.9l-.91-2.71c.73-.14 1.46-.21 2.2-.21 4.01-.01 8.03 2.07 10.59 6.25.74 1.12 1.41 2.36 1.88 3.57-.47 1.22-1.14 2.46-1.88 3.58"/>
    </svg>
  );
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
    domains.value = [value, ...domains.value];
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

  const handleStartCommenting = () => {
    chrome.runtime.sendMessage({ action: 'TOGGLE_COMMENT_MODE' });
    window.close();
  };

  const patHelperText = !patEmpty.value ? (patMessage.value || 'Find this in DevRev > Settings > Account > Developer') : undefined;
  const openaiHelperText = !openaiKeyEmpty.value ? (openaiKeyMessage.value || 'Used for AI-powered issue descriptions') : undefined;

  return (
    <div
      style={{
        width: '360px',
        padding: '16px',
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
          margin: '0 0 16px 0',
          lineHeight: '1.3',
        }}
      >
        {isSetup.value ? 'Setup Required' : 'Nitpick Settings'}
      </h1>

      {/* DevRev PAT */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Input
              label="DevRev Personal Access Token"
              type={showPat.value ? 'text' : 'password'}
              size="md"
              placeholder="Paste your token here"
              value={pat.value}
              iconRight={
                <span style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => { showPat.value = !showPat.value; }}>
                  {showPat.value ? <EyeCrossedIcon /> : <EyeIcon />}
                </span>
              }
              onInput={(e: any) => {
                pat.value = (e.target as HTMLInputElement).value;
                if (pat.value !== patSavedValue.value) {
                  patStatus.value = 'idle';
                  patMessage.value = '';
                }
              }}
              onBlur={() => { patTouched.value = true; }}
              error={patEmpty.value ? 'A valid token is required to create issues' : undefined}
              helperText={!patEmpty.value ? patHelperText : undefined}
            />
          </div>
          <Button
            variant={patStatus.value === 'error' ? 'destructive' : 'primary'}
            size="md"
            onClick={handleSavePAT}
            disabled={!pat.value.trim() || patStatus.value === 'saving' || patStatus.value === 'saved'}
            loading={patStatus.value === 'saving'}
            style={{ marginTop: '20px', minWidth: '80px' }}
          >
            {patStatus.value === 'saving' ? '' : patStatus.value === 'saved' ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {/* OpenAI API Key */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Input
              label="OpenAI API Key"
              type={showOpenaiKey.value ? 'text' : 'password'}
              size="md"
              placeholder="sk-..."
              value={openaiKey.value}
              iconRight={
                <span style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => { showOpenaiKey.value = !showOpenaiKey.value; }}>
                  {showOpenaiKey.value ? <EyeCrossedIcon /> : <EyeIcon />}
                </span>
              }
              onInput={(e: any) => {
                openaiKey.value = (e.target as HTMLInputElement).value;
                if (openaiKey.value !== openaiKeySavedValue.value) {
                  openaiKeyStatus.value = 'idle';
                  openaiKeyMessage.value = '';
                }
              }}
              onBlur={() => { openaiKeyTouched.value = true; }}
              error={openaiKeyEmpty.value ? 'A valid API key is required' : undefined}
              helperText={!openaiKeyEmpty.value ? openaiHelperText : undefined}
            />
          </div>
          <Button
            variant={openaiKeyStatus.value === 'error' ? 'destructive' : 'primary'}
            size="md"
            onClick={handleSaveOpenAIKey}
            disabled={!openaiKey.value.trim() || openaiKeyStatus.value === 'saving' || openaiKeyStatus.value === 'saved'}
            loading={openaiKeyStatus.value === 'saving'}
            style={{ marginTop: '20px', minWidth: '80px' }}
          >
            {openaiKeyStatus.value === 'saving' ? '' : openaiKeyStatus.value === 'saved' ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Active Domains */}
      <Accordion.Root type="multiple" style={{ marginBottom: '8px' }}>
        <Accordion.Item value="domains" style={{ borderBottom: 'none' }}>
          <Accordion.Trigger style={{ padding: '8px 0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Active Domains
              <Badge variant="neutral">{domains.value.length}</Badge>
            </span>
          </Accordion.Trigger>
          <Accordion.Content style={{ animation: 'none', overflow: 'visible', height: 'auto' }}>
            <p style={{ fontSize: 'var(--typography-system-small-font-size)', color: 'var(--fg-neutral-subtle)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
              Nitpick activates on these domains
            </p>
            <div style={{ maxHeight: '160px', overflow: 'hidden', marginBottom: '8px' }}><div style={{ maxHeight: '160px', overflowY: 'auto', marginRight: '-20px', paddingRight: '20px' }}>
              {domains.value.length === 0 && (
                <p style={{ fontSize: 'var(--typography-system-small-font-size)', color: 'var(--fg-neutral-subtle)', margin: '0', padding: '8px', textAlign: 'center', lineHeight: '1.4' }}>
                  No domains configured. Add a domain to get started.
                </p>
              )}
              {domains.value.map((domain) => (
                <div
                  key={domain}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 2px 2px 8px', backgroundColor: 'var(--input-bg-idle)', borderRadius: 'var(--corner-square)', marginBottom: '4px' }}
                >
                  <span style={{ fontSize: 'var(--typography-system-font-size)', color: 'var(--fg-neutral-prominent)' }}>{domain}</span>
                  <IconButton
                    variant="tertiary"
                    size="sm"
                    aria-label={`Remove ${domain}`}
                    onClick={() => handleRemoveDomain(domain)}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              ))}
            </div></div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Input
                  size="md"
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
                size="md"
                onClick={handleAddDomain}
              >
                Add
              </Button>
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>

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
