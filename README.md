<div align="center">

# Nitpick

**One-click UI bug reporting for DevRev**

Point at anything on the page. Describe what's wrong. Get an AI-powered, perfectly structured DevRev issue — with screenshots, element metadata, and a technical diagnosis — in under 30 seconds.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com) [![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Preact](https://img.shields.io/badge/Preact-10.29-673AB8?style=flat-square&logo=preact&logoColor=white)](https://preactjs.com/) [![License](https://img.shields.io/badge/License-Private-red?style=flat-square)]()

</div>

---

## The Problem

Reporting UI bugs at DevRev looks like this:

1. Notice something wrong on the page
2. Take a screenshot
3. Open DevRev, create an issue
4. Write a title, paste the screenshot
5. Try to describe the problem — *"the button looks weird"*
6. Forget to include the URL, browser, viewport size
7. Assign it to the wrong team because you don't know which part owns that component

**That's 5-10 minutes per bug, and the report is still vague.**

## The Solution

With Nitpick:

1. Click the extension icon
2. Click the broken element
3. Type *"button looks weird"*
4. Hit send

Nitpick captures the element's computed CSS, DOM structure, React component hierarchy, and a pixel-perfect screenshot. GPT-5.5 analyzes everything and generates a structured issue with a JIRA-style title, technical root cause diagnosis, and relevant CSS values. You review, tweak if needed, and hit **Create Issue**.

**30 seconds. Done.**

---

## Features

### Element Inspector
- Hover to highlight any element with a precision bounding box
- Click to select, or drag to select a region
- Captures 47 computed CSS properties, DOM path, class names, data attributes, ARIA attributes, and React component names
- Inspects ancestor, sibling, and child elements for full layout context

### AI-Powered Analysis
- Streams a technical diagnosis powered by GPT-5.5
- Identifies the specific CSS properties causing the issue
- Detects root cause on child/sibling elements, not just the selected one
- Recognizes design system components and suggests checking theme configs
- Generates a JIRA-style title: *"[Tabs] Selected tab indicator height mismatches parent padding"*

### One-Click Issue Creation
- Pre-populated form with AI-generated title, description, and suggestions
- Live search for Parts, Owners, and Tags from your DevRev org
- Priority selector (P0–P3)
- Viewport + cropped screenshots auto-attached as DevRev artifacts
- Auto-tags issues as `nitpicked` for easy filtering
- Direct link to the created issue on success

### Zero Friction Setup
- Only requires a DevRev PAT — no other accounts or API keys needed
- AI analysis handled by a secure server-side proxy (no keys in the browser)
- Works on any Chromium browser: Chrome, Arc, Brave, Edge, Comet

---

## How to Use Nitpick — Step by Step

### Step 1: Set Up (One Time)

After installing the extension, click the **Nitpick icon** in your browser toolbar. You'll see the setup screen:

1. **Paste your DevRev PAT** — Find it in DevRev > Settings > Account > Developer. Paste it into the token field and click **Save**. Nitpick validates it against DevRev's API before saving.
2. **Review active domains** — Nitpick comes pre-configured for `app.devrev.ai`, `support.devrev.ai`, and other DevRev domains. You can add any domain (e.g., `staging.yourapp.com`) or remove ones you don't need.
3. **Click "Start Commenting"** — This activates bug reporting mode on the current page.

From now on, clicking the Nitpick icon toggles bug reporting mode on/off. You won't see the setup screen again unless you clear your token.

### Step 2: Select the Problem

Once bug reporting mode is active, your cursor changes to a crosshair. You have two ways to select what's wrong:

**Click an element:**
- Hover over any element — you'll see a blue highlight box showing its exact bounds
- Click to select it
- Nitpick captures the element's CSS properties, DOM structure, React component name, and a screenshot — all instantly

**Drag to select an area:**
- Click and drag to draw a rectangle around a region
- Useful for layout issues involving multiple elements (e.g., "these two cards are misaligned")
- Nitpick captures all elements within the selection

### Step 3: Describe the Bug

A comment bubble appears near your selection:

- Type what's wrong in plain language: *"button text should be white"*, *"too much space between these cards"*, *"font looks different from the design"*
- Press **Enter** (or click the send arrow) to submit
- Press **Shift+Enter** for a new line

**Tip:** Be specific about what you expect vs. what you see. The AI uses your description to filter through dozens of CSS properties and surface only the relevant ones.

### Step 4: Review the AI Analysis

After you send, Nitpick's AI streams a structured bug report in real-time:

- **Title** — A JIRA-style title like *"[Button] Primary CTA text color does not match design system token"*
- **Description** — A technical diagnosis with the specific CSS values causing the issue, which element is the root cause, and environment details (browser, OS, viewport)
- **Suggestions** — The AI suggests a Part (team/component) and Owner based on the page URL and component area

You'll see the issue card form populate as the AI writes. Everything is editable.

### Step 5: Fine-Tune and Submit

The issue card gives you full control before creating the issue:

| Field | What to do |
|-------|-----------|
| **Title** | Edit the AI-generated title if needed |
| **Description** | Modify the diagnosis or add your own notes |
| **Part** | Search and select the DevRev part (product area) this belongs to. The AI suggests one, but you can change it |
| **Owner** | Search and assign to a specific person |
| **Priority** | Pick P0 (critical) through P3 (low). Defaults to P2 |
| **Tags** | Add tags from your DevRev org. The `nitpicked` tag is auto-added |
| **Screenshots** | Preview the cropped and full-page screenshots that will be attached |

When everything looks right, click **Create Issue**.

### Step 6: Done

A success toast appears with a direct link to the created DevRev issue. Click it to open the issue in DevRev. The issue includes:

- Your title and description
- Cropped + viewport screenshots embedded as inline images
- All metadata (part, owner, priority, tags)
- A "Code identifiers" section with React component names, data-testid values, and Tailwind classes — so the developer fixing it can grep straight to the source

### Tips

- **Multiple bugs in one session** — After creating an issue, click another element to report the next bug. No need to toggle the mode off and on.
- **Cancel a report** — Press **Escape** at any time to exit bug reporting mode. Click the **X** on the issue card to dismiss it and select a different element.
- **Non-DevRev pages** — Nitpick auto-loads on DevRev domains. For other pages, just click the extension icon — it dynamically injects on the current tab.
- **Shaking popover** — If you click elsewhere while the comment bubble is open with text in it, it shakes to remind you there's an unsent comment. Clear it or send it first.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser Tab (DevRev or any configured domain)          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Content Script (Shadow DOM)                      │  │
│  │  - Element hover/select/drag                      │  │
│  │  - Comment bubble                                 │  │
│  │  - Issue card form                                │  │
│  │  - Toast notifications                            │  │
│  └──────────────────────┬────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────┘
                          │ chrome.runtime messages
┌─────────────────────────┼───────────────────────────────┐
│  Service Worker         │                               │
│  - Screenshot capture ──┼── chrome.tabs.captureVisibleTab│
│  - Offscreen crop ──────┼── Canvas API (offscreen doc)  │
│  - AI streaming ────────┼──► nitpick-fix.vercel.app     │
│  - DevRev API calls ────┼──► api.devrev.ai              │
│  - State management     │                               │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────┐
│  Proxy (Vercel)         │                               │
│  - Validates DevRev PAT │                               │
│  - Forwards to OpenAI ──┼──► api.openai.com             │
│  - Streams response     │   (server-side API key)       │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **UI Framework** | Preact + Signals | 3KB gzipped — critical for content script injection |
| **Language** | TypeScript 5.9 | Type-safe message passing across extension contexts |
| **Build** | Vite + CRXJS | Sub-3s builds, HMR in all extension contexts |
| **Styling** | CSS Modules (content script), Tailwind (popup) | Shadow DOM isolation for content script; Tailwind for extension-owned pages |
| **AI** | GPT-5.5 via Vercel proxy | Streaming responses, server-side API key |
| **Manifest** | V3 | Service worker, scoped permissions, offscreen documents |
| **Design System** | Arcade (DevRev internal) | Consistent with DevRev product UI |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`corepack enable && corepack prepare pnpm@latest --activate`)
- A DevRev account with a [Personal Access Token](https://docs.devrev.ai/product/authentication)
- A Chromium browser (Chrome, Arc, Brave, Edge)

### Install & Build

```bash
git clone https://github.com/xorkavi/nitpick.git
cd nitpick
pnpm install
pnpm run build
```

### Load in Browser

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Configure

1. Click the Nitpick icon in the toolbar
2. Paste your DevRev PAT and click **Save**
3. (Optional) Add or remove active domains
4. Click **Start Commenting**

### Development

```bash
pnpm run dev
```

CRXJS provides hot module reload across all extension contexts. Changes to content scripts, popup, and service worker are reflected instantly.

---

## Proxy

The AI proxy lives in `proxy/` and runs on Vercel. It keeps the OpenAI API key server-side so it never touches the browser.

### How It Works

1. Extension sends bug report data + DevRev PAT to the proxy
2. Proxy validates the PAT against DevRev's API
3. If valid, forwards the request to OpenAI with the server-side API key
4. Streams the response back to the extension

### Deploy

```bash
cd proxy
vercel deploy --prod
vercel env add OPENAI_API_KEY production
```

### Security

- CORS restricted to browser extensions only (no website can call it)
- 200KB payload size limit
- Every request validated against DevRev's auth
- No request data logged or stored
- OpenAI errors sanitized before returning to client

---

## Project Structure

```
nitpick/
├── src/
│   ├── content-script/        # Injected into web pages
│   │   ├── inspector/         # Element metadata extraction
│   │   │   ├── element-data.ts    # CSS, DOM, React component inspection
│   │   │   ├── area-elements.ts   # Drag-selection element finder
│   │   │   ├── contrast.ts        # WCAG contrast ratio calculation
│   │   │   └── css-variables.ts   # CSS custom property extraction
│   │   ├── overlay/           # Shadow DOM UI components
│   │   │   ├── ShadowHost.ts      # Shadow DOM mount/unmount
│   │   │   ├── OverlayApp.tsx     # Root overlay component
│   │   │   ├── HoverHighlight.tsx # Blue bounding box on hover
│   │   │   ├── CommentBubble.tsx  # Bug description input
│   │   │   ├── IssueCard.tsx      # Full issue form
│   │   │   ├── ChipDropdown.tsx   # Part/Owner/Priority selector
│   │   │   ├── TagChipMultiSelect.tsx  # Multi-select tag chips
│   │   │   └── Toast.tsx          # Success/error notifications
│   │   ├── index.ts           # Event handlers, mode toggling
│   │   └── signals.ts         # Preact signals (reactive state)
│   ├── service-worker/        # Background orchestration
│   │   ├── index.ts           # Extension lifecycle, event listeners
│   │   ├── messages.ts        # Message router (all actions)
│   │   ├── ai-analysis.ts     # Prompt builder, SSE stream consumer
│   │   ├── capture.ts         # Screenshot via captureVisibleTab
│   │   ├── devrev-api.ts      # DevRev REST client (typed)
│   │   ├── screenshot-store.ts # In-memory screenshot cache
│   │   ├── state.ts           # Session state (mode, active tab)
│   │   └── storage.ts         # chrome.storage.local wrapper
│   ├── popup/                 # Extension popup (settings)
│   │   ├── SettingsPage.tsx   # PAT input, domain management
│   │   └── index.tsx          # Preact mount
│   ├── offscreen/             # Offscreen document (Canvas API)
│   │   └── offscreen.ts       # Screenshot cropping
│   ├── shared/                # Cross-context types & constants
│   │   ├── types.ts           # ElementMetadata, DevRevPart, etc.
│   │   ├── messages.ts        # Typed message union
│   │   └── constants.ts       # API URLs, storage keys, colors
│   └── assets/icons/          # Extension icons (16–128px)
├── proxy/                     # Vercel serverless proxy
│   └── api/analyze.ts         # PAT validation + OpenAI forwarding
├── docs/                      # GitHub Pages
│   └── privacy-policy.md      # CWS-compliant privacy policy
└── vite.config.ts             # Build config + manifest definition
```

---

## Auto-Fix with AI Coding Agents

Nitpick doesn't just file bugs. It can fix them too.

The repo includes a `nitpick-fix` skill that works with AI coding agents like [Claude Code](https://claude.ai/claude-code) and [Cursor](https://cursor.com). Give it an issue ID, and it reads the Nitpick-captured metadata, traces the bug to the exact component, and applies the fix.

### How It Works

```
> /nitpick-fix ISS-1234
```

That's it. The skill:

1. Fetches the issue from DevRev (title, AI description, screenshots, metadata)
2. Downloads and views the screenshots for visual context
3. Uses the captured React component names, data-testid values, and Tailwind classes to grep straight to the source
4. Traces through the design system theme if the styles come from a DS config
5. Applies the minimal fix and presents it for your review

### What It Knows

Every Nitpick issue comes packed with machine-readable context that the skill uses:

- **React component names** from the element and its ancestors
- **data-drid / data-testid** values for one-grep-to-source lookup
- **Constraining Tailwind classes** (e.g. `max-w-32`, `truncate`, `px-core-base`)
- **Computed CSS values** with expected vs. actual comparisons
- **DOM path and ancestor layout context** for tracing spacing/overflow bugs
- **Cropped + viewport screenshots** so the agent can see what you saw

### Setup

1. Make sure your DevRev PAT is in `.env` at the repo root:
   ```
   DEVREV_PAT=your-pat-here
   ```
2. The skill file lives at `.claude/skills/nitpick-fix/SKILL.md` — Claude Code and Cursor pick it up automatically.

### Example

```
You: /nitpick-fix ISS-69076

Agent: Fetching ISS-69076 from DevRev...

  Title: [Tabs] Selected tab indicator height mismatches parent padding
  Priority: P2
  Description: The tab indicator <span> has h-6 (24px) but the parent
  TabList has p-1 (4px padding), leaving only 20px of available height.
  The indicator overflows by 4px.

  Downloading screenshots... ✓
  Searching for TabItem theme config...
  Found: libs/design-system/shared/themes/devrev-app-theme/src/components/tab-item.ts

  Fix: Changed itemBackground slot from h-6 to h-5 (20px fits within
  the 28px parent minus 8px total padding).

  Files changed:
  - libs/design-system/.../tab-item.ts (line 34: "h-6" → "h-5")

  Ready for review. Want me to commit?
```

The whole loop — from bug report to code fix — without leaving your terminal.

---

## Auto-Fix with AI Coding Agents

Nitpick doesn't just file bugs. It can fix them too.

The repo includes a `nitpick-fix` skill that works with AI coding agents like [Claude Code](https://claude.ai/claude-code) and [Cursor](https://cursor.com). Give it an issue ID, and it reads the Nitpick-captured metadata, traces the bug to the exact component, and applies the fix.

### How It Works

```
> /nitpick-fix ISS-1234
```

That's it. The skill:

1. Fetches the issue from DevRev (title, AI description, screenshots, metadata)
2. Downloads and views the screenshots for visual context
3. Uses the captured React component names, data-testid values, and Tailwind classes to grep straight to the source
4. Traces through the design system theme if the styles come from a DS config
5. Applies the minimal fix and presents it for your review

### What It Knows

Every Nitpick issue comes packed with machine-readable context that the skill uses:

- **React component names** from the element and its ancestors
- **data-drid / data-testid** values for one-grep-to-source lookup
- **Constraining Tailwind classes** (e.g. `max-w-32`, `truncate`, `px-core-base`)
- **Computed CSS values** with expected vs. actual comparisons
- **DOM path and ancestor layout context** for tracing spacing/overflow bugs
- **Cropped + viewport screenshots** so the agent can see what you saw

### Setup

1. Make sure your DevRev PAT is in `.env` at the repo root:
   ```
   DEVREV_PAT=your-pat-here
   ```
2. The skill file lives at `.claude/skills/nitpick-fix/SKILL.md` — Claude Code and Cursor pick it up automatically.

### Example

```
You: /nitpick-fix ISS-69076

Agent: Fetching ISS-69076 from DevRev...

  Title: [Tabs] Selected tab indicator height mismatches parent padding
  Priority: P2
  Description: The tab indicator <span> has h-6 (24px) but the parent
  TabList has p-1 (4px padding), leaving only 20px of available height.
  The indicator overflows by 4px.

  Downloading screenshots... ✓
  Searching for TabItem theme config...
  Found: libs/design-system/shared/themes/devrev-app-theme/src/components/tab-item.ts

  Fix: Changed itemBackground slot from h-6 to h-5 (20px fits within
  the 28px parent minus 8px total padding).

  Files changed:
  - libs/design-system/.../tab-item.ts (line 34: "h-6" → "h-5")

  Ready for review. Want me to commit?
```

The whole loop — from bug report to code fix — without leaving your terminal.

---

## Permissions

Nitpick requests only what it needs:

| Permission | What For |
|------------|----------|
| `activeTab` | Access the current tab for screenshots and content script injection |
| `storage` | Store your PAT and domain list locally |
| `scripting` | Inject the overlay on pages outside the default domain list |
| `offscreen` | Crop screenshots via Canvas API (service workers can't use Canvas) |
| `alarms` | Keep the service worker alive during active bug reporting |

**Host permissions** are scoped to three endpoints: DevRev API (prod + dev) and the AI proxy. No `<all_urls>`.

---

## Privacy

Nitpick collects element metadata and screenshots **only when you actively report a bug**. Nothing runs in the background. No analytics, no tracking, no data sold.

Full privacy policy: [xorkavi.github.io/nitpick/privacy-policy](https://xorkavi.github.io/nitpick/privacy-policy)

---

## Distribution

Nitpick is distributed as an **unlisted** Chrome Web Store extension. Install via the direct link shared within DevRev. Works on all Chromium browsers.

---

## License

Private — DevRev internal use only.
