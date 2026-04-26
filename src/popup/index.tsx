import { render } from 'preact';
import { DevRevThemeProvider } from '@xorkavi/arcade-gen';
import '@xorkavi/arcade-gen/styles.css';
import { SettingsPage } from './SettingsPage';

const style = document.createElement('style');
style.textContent = `
  * { scrollbar-width: thin; scrollbar-color: var(--core-neutrals-400) transparent; }
  *::-webkit-scrollbar { width: 4px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { background: var(--core-neutrals-400); border-radius: 2px; }
`;
document.head.appendChild(style);

const app = document.getElementById('app');
if (app) {
  render(
    <DevRevThemeProvider mode="light">
      <SettingsPage />
    </DevRevThemeProvider>,
    app
  );
}
