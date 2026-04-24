import { render } from 'preact';
import { SettingsPage } from './SettingsPage';

const app = document.getElementById('app');
if (app) {
  render(<SettingsPage />, app);
}
