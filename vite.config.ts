import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx, defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Nitpick',
  version: '0.1.0',
  description: 'UI bug reporting for DevRev',
  icons: {
    '16': 'src/assets/icons/icon-16.png',
    '32': 'src/assets/icons/icon-32.png',
    '48': 'src/assets/icons/icon-48.png',
    '128': 'src/assets/icons/icon-128.png',
  },
  action: {},
  commands: {
    _execute_action: {
      suggested_key: {
        default: 'Ctrl+Semicolon',
        mac: 'Command+Semicolon',
      },
      description: 'Activate comment mode',
    },
  },
  background: {
    service_worker: 'src/service-worker/index.ts',
  },
  content_scripts: [
    {
      matches: [
        '*://*.devrev.ai/*',
        '*://*.devrev-eng.ai/*',
      ],
      js: ['src/content-script/index.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['activeTab', 'storage', 'scripting', 'alarms', 'offscreen'] as const,
  host_permissions: [
    'https://api.devrev.ai/*',
    'https://api.dev.devrev-eng.ai/*',
    'https://nitpick-fix.vercel.app/*',
  ],
});

export default defineConfig({
  plugins: [
    preact(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      // Include popup HTML as an additional entry so it is available
      // for dynamic setPopup() even though manifest has no default_popup
      input: {
        popup: 'src/popup/index.html',
        offscreen: 'src/offscreen/offscreen.html',
      },
    },
  },
});
