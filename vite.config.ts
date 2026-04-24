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
  background: {
    service_worker: 'src/service-worker/index.ts',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content-script/index.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['activeTab', 'storage', 'scripting', 'alarms'] as const,
  host_permissions: [
    '<all_urls>',
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
      },
    },
  },
});
