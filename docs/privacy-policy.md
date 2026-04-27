# Nitpick Privacy Policy

**Last updated:** April 27, 2026

Nitpick is a Chrome extension that enables UI bug reporting for DevRev. This policy explains what data Nitpick accesses, how it is handled, and where it is sent.

## Data Collected

Nitpick stores the following data locally on your device using Chrome's built-in storage (`chrome.storage.local`):

- **DevRev Personal Access Token (PAT):** Used to authenticate API requests to DevRev on your behalf.
- **OpenAI API Key:** Used to generate AI-powered issue descriptions.
- **Active Domains list:** The list of domains where Nitpick is enabled (defaults to DevRev application domains).

This data never leaves your device except as described below under "Data Sent to External Services."

## Data Processed Temporarily

When you select an element or area on a page to report a bug, Nitpick temporarily captures:

- A screenshot of the visible browser tab (cropped to the selected region)
- CSS computed styles, DOM structure, and layout metadata of the selected element
- Page URL, viewport dimensions, browser version, and operating system

This data is held in the extension's service worker memory only for the duration of the bug report. It is not persisted to disk, is not sent anywhere until you explicitly click "Create Issue," and is cleared after submission or when you exit comment mode.

## Data Sent to External Services

Nitpick sends data to two external services, **only when you explicitly initiate an action:**

### DevRev API (`api.devrev.ai`)
When you create an issue, Nitpick sends:
- Issue title and description (including any AI-generated content you approved)
- Screenshots (uploaded as DevRev artifacts)
- Selected part, owner, priority, and tags

All requests are authenticated with your personal DevRev PAT. Nitpick uses the same API and permissions as your DevRev account.

### OpenAI API (`api.openai.com`)
When you click "Analyze," Nitpick sends:
- Your comment describing the bug
- Element metadata (CSS styles, DOM path, dimensions)
- The cropped screenshot of the selected element
- Page URL and browser metadata

This data is sent to generate an AI-powered issue description. OpenAI's data usage is governed by [OpenAI's API data usage policy](https://openai.com/policies/api-data-usage-policies).

## Data Not Collected

Nitpick does **not**:
- Collect analytics or telemetry
- Track browsing history or behavior
- Send data to any server operated by the Nitpick developers
- Store data outside your local device (other than issues you explicitly create in DevRev)
- Use cookies or any tracking mechanism
- Access page content on domains where it is not activated

## Data Storage and Security

- API credentials are stored in `chrome.storage.local`, which is encrypted at rest by the Chrome browser.
- Credentials are never included in content scripts or exposed to web pages.
- No data is stored on external servers controlled by Nitpick.

## Your Control

- You can view, change, or delete your stored credentials at any time through the extension's settings popup.
- Uninstalling the extension removes all locally stored data.
- You control which domains Nitpick is active on through the settings.

## Changes to This Policy

Updates to this policy will be reflected in this document with an updated date. Continued use of the extension after changes constitutes acceptance.

## Contact

For questions about this privacy policy, contact the Nitpick maintainers through the project's GitHub repository.
