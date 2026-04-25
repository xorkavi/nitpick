import { render } from 'preact';
import { DevRevThemeProvider } from '@xorkavi/arcade-gen';
import '@xorkavi/arcade-gen/styles.css';
import { SettingsPage } from './SettingsPage';

const app = document.getElementById('app');
if (app) {
  render(
    <DevRevThemeProvider mode="light">
      <SettingsPage />
    </DevRevThemeProvider>,
    app
  );
}
