<!-- GSD:project-start source:PROJECT.md -->
## Project

**Nitpick**

A Chrome extension that lets anyone at DevRev report UI bugs by pointing at elements directly on the page — like Figma's comment mode but for live web apps. Instead of screenshot → Slack → manual issue creation, users click an element (or drag-select an area), describe what's wrong in plain language, and an AI-enriched issue is created in DevRev automatically.

**Core Value:** One-click UI bug reporting that turns a vague "this looks wrong" into a precise, actionable DevRev issue — with element metadata, screenshots, and AI-generated technical descriptions — in under 30 seconds.

### Constraints

- **API**: DevRev works.create API for issue creation; user provides PAT for authentication
- **AI Provider**: OpenAI GPT for description generation and property analysis
- **Platform**: Chrome extension (Manifest V3)
- **Users**: Non-technical users must be able to use it — no DevTools knowledge required
- **Description length**: AI-generated descriptions must be concise and bounded, not exhaustive property dumps
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | ^5.7 (latest 6.0.3) | Language | Non-negotiable for a project with message passing, DOM APIs, and multiple execution contexts. Chrome extension message passing is stringly-typed by default -- TS prevents entire categories of bugs. Use 5.7 for stability; 6.x if team is comfortable with bleeding edge. |
| Manifest V3 | v3 | Extension manifest | Required. MV2 is fully deprecated in Chrome. MV3 uses service workers instead of background pages, declarativeNetRequest instead of webRequest, and has a different permission model. |
| Vite | ^6.0 (latest 8.0.10) | Build tool | Fast HMR, native ESM, excellent plugin ecosystem. Use 6.x for stability -- 8.x is very new. |
| CRXJS Vite Plugin | ^2.4.0 | Extension build integration | Bridges Vite and Chrome extension development. Auto-generates manifest, handles HMR in content scripts, manages multi-entry builds (background, content, popup). More lightweight than WXT or Plasmo -- gives full control without framework opinions. |
| Preact | ^10.29 (latest 10.29.1) | UI framework | 3KB gzipped vs React's ~40KB. For a Chrome extension injecting UI into host pages, bundle size directly impacts load time and memory. Preact's API is React-compatible (preact/compat), so no learning curve. Signals for state management are built-in. |
| @preact/signals | ^2.9.0 | State management | Fine-grained reactivity without re-rendering entire component trees. Perfect for extension state (selected element, hover state, settings) that changes frequently. No boilerplate like Redux. |
### Extension Architecture
| Component | Technology | Purpose | Notes |
|-----------|-----------|---------|-------|
| Service Worker | Vanilla TS | Background orchestration | Handles screenshot capture (chrome.tabs API), message routing between popup/content/sidepanel, API calls to DevRev and OpenAI. Keep thin -- service workers are ephemeral in MV3. |
| Content Script | Preact + TS | DOM inspection, overlay UI | Injected into host pages. Renders hover bounding boxes, selection UI, comment input popups. Must be isolated from host page styles via Shadow DOM. |
| Popup / Side Panel | Preact + TS | Settings, issue preview | Side Panel (chrome.sidePanel API) is preferred over popup for persistent UI. Settings panel, issue form editing, submission confirmation. |
| Shared Types | TS | Message contracts | Typed message passing between all contexts eliminates the biggest source of extension bugs. |
### Screenshot Capture
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| chrome.tabs.captureVisibleTab | Built-in | Full viewport screenshot | Native Chrome API. Returns PNG/JPEG data URL. No library needed, no cross-origin issues, no DOM rendering artifacts. Requires `activeTab` permission. This is the primary capture method. |
| OffscreenCanvas (via Offscreen Document) | Built-in | Image cropping | MV3 service workers cannot use Canvas. Use chrome.offscreen API to create an offscreen document that crops the full viewport screenshot to the selected element's bounding rect. No external library needed. |
### AI Integration
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| openai (official SDK) | ^6.34.0 | OpenAI GPT API client | Official TypeScript SDK. Zero dependencies (verified: `dependencies: {}`). Works in browser/service worker context via fetch. Use for CSS property analysis and issue description generation. |
### DevRev API Integration
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Native fetch | Built-in | DevRev works.create API | DevRev's REST API is simple enough that a hand-written typed client (50-100 lines) is better than pulling in a heavy SDK. The API surface Nitpick uses is exactly one endpoint: `POST /works.create`. Type the request/response with Zod for runtime validation. |
| Zod | ^4.3 (latest 4.3.6) | Request/response validation | Validates DevRev API payloads and OpenAI responses at runtime. Small, tree-shakeable, and the de facto standard for TS runtime validation. |
### Styling
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| CSS Modules or Vanilla CSS | N/A | Content script styles | Content script UI MUST be style-isolated from the host page. Use Shadow DOM for isolation + plain CSS or CSS Modules inside the shadow root. Tailwind's global nature makes it a poor fit for content scripts injected into arbitrary pages. |
| Tailwind CSS | ^4.2 (latest 4.2.4) | Popup / Side Panel styles | Fine for extension's own pages (popup, side panel, options) where there's no host page style conflict. Use only for these contexts, not for content script overlays. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @preact/signals | ^2.9.0 | Reactive state | All UI state: hover element, selection mode, form data, settings. Replaces useState/useContext for cross-component state. |
| Zod | ^4.3.6 | Schema validation | Validate API responses (DevRev, OpenAI), validate user settings, validate message passing payloads between extension contexts. |
| htm | ^3.1.1 | Tagged template JSX | Optional. If you want JSX-like syntax without a build step in content scripts. Pairs with Preact for lightweight inline templates. Generally not needed if using Vite build. |
| nanoid | ^5.x | ID generation | Generate unique IDs for comments, selections, and local state. Tiny (130 bytes), no crypto dependency. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| Vite ^6.0 | Build + dev server | Use with CRXJS plugin for Chrome extension HMR. Dev mode auto-reloads extension on file changes. |
| CRXJS Vite Plugin ^2.4.0 | Extension bundling | Handles manifest generation, content script injection, HMR for all extension contexts. |
| TypeScript ^5.7 | Type checking | Use strict mode. Define message types as discriminated unions for type-safe message passing. |
| ESLint ^9.x | Linting | Flat config format. Use @typescript-eslint for TS rules. |
| Prettier | Formatting | Standard formatting. Integrate with ESLint via eslint-config-prettier. |
| Chrome Extension DevTools | Debugging | Built into Chrome. Inspect service worker, content scripts separately. chrome://extensions for reload. |
| vitest | ^3.x | Unit testing | Vite-native test runner. Fast, supports TS out of the box. Test message handlers, API clients, CSS parsing logic. |
## Installation
# Initialize project
# Core extension build
# UI framework (already included from template, but for reference)
# AI and API integration
# Styling for popup/side panel
# Dev tools
## Alternatives Considered
### Extension Build Framework
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build tooling | CRXJS + Vite | **Plasmo** (v0.90.5) | Plasmo is a full framework with opinions on file structure, state management, and messaging. It's excellent for rapid prototyping but adds abstraction over Chrome APIs that Nitpick needs direct access to (DOM inspection, screenshot cropping, overlay injection). Plasmo's content script CSUI model is also opinionated about Shadow DOM in ways that may conflict with the custom overlay system needed here. |
| Build tooling | CRXJS + Vite | **WXT** (v0.20.25) | WXT is newer and actively developed. Good alternative. However, it's more opinionated than CRXJS and the API surface is still evolving (pre-1.0). For a project that needs precise control over content script injection and multi-context communication, CRXJS's thinner abstraction is safer. WXT would be the pick for a simpler extension. |
| Build tooling | CRXJS + Vite | **vite-plugin-web-extension** (v4.5.1) | Less maintained than CRXJS. Fewer features around HMR and manifest handling. |
| Build tooling | CRXJS + Vite | **Webpack** | Slower builds, more configuration, no HMR parity with Vite for extensions. Legacy choice. |
### UI Framework
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| UI framework | Preact | **React** | 40KB+ gzipped. Unacceptable for content scripts injected into every page. Extension popup/side panel could tolerate it, but splitting frameworks across contexts is worse than using one lightweight framework everywhere. |
| UI framework | Preact | **Svelte** | Svelte compiles away the runtime, so bundle size is competitive. But Preact's React-compatible API means access to the entire React ecosystem (components, hooks patterns, tutorials). Svelte would work fine but has a smaller ecosystem for extension-specific patterns. |
| UI framework | Preact | **Vanilla JS/TS** | Viable for the overlay system alone, but the settings panel, issue form, and comment input all need reactive UI. Hand-rolling reactivity is a maintenance burden. Preact at 3KB is essentially free. |
| UI framework | Preact | **Lit** (Web Components) | Lit is good for isolated components but the developer experience for forms and complex UI (issue editor) is weaker than Preact/React patterns. Shadow DOM isolation is useful but Nitpick already needs Shadow DOM regardless of framework choice. |
### Screenshot Capture
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Screenshot | chrome.tabs.captureVisibleTab | **html2canvas** (v1.4.1) | html2canvas re-renders the DOM to canvas. It's slow (500ms-2s), misses CSS features (backdrop-filter, complex gradients, custom fonts), and requires same-origin access. It's designed for server-side rendering, not extension screenshots. chrome.tabs.captureVisibleTab captures the actual rendered pixels in <50ms with perfect fidelity. |
| Screenshot | chrome.tabs.captureVisibleTab | **html-to-image** (v1.11.13) | Same category as html2canvas. SVG foreignObject approach has even more cross-origin restrictions. |
| Cropping | Offscreen Document + Canvas | **dom-to-image** | Deprecated. Use native APIs. |
### AI SDK
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| AI client | openai SDK | **Raw fetch** | The OpenAI SDK handles streaming, retries, error types, and type safety. At zero dependencies, there's no penalty for using it over raw fetch. |
| AI client | openai SDK | **@anthropic-ai/sdk** | Project requirement specifies OpenAI GPT. The Anthropic SDK has `json-schema-to-ts` as a dependency, slightly heavier. If the team ever wants to swap providers, the API call layer is isolated enough to swap. |
### State Management
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| State | @preact/signals | **Zustand** | Zustand is excellent for React apps but adds a dependency when Preact signals are built-in and more granular (component-level reactivity vs store subscriptions). |
| State | @preact/signals | **Jotai** | Same reasoning. Atomic state is nice but signals are Preact-native. |
| State | @preact/signals | **Redux** | Massive overkill for an extension with ~5 pieces of global state. |
## What NOT to Use
### html2canvas / html-to-image / dom-to-image
### axios / node-fetch / got
### React
### MUI / Chakra / Ant Design / Any Component Library
### Plasmo's CSUI (Content Script UI)
### chrome.storage.sync for API keys
### Background pages (Manifest V2 pattern)
### WebAssembly for image processing
## Stack Patterns by Variant
### Extension Context Map
### Message Passing Pattern
### Shadow DOM Isolation Pattern
### DOM Element Inspection Pattern
## Version Compatibility
| Component | Min Chrome Version | Notes |
|-----------|-------------------|-------|
| Manifest V3 | Chrome 88+ | Widely deployed. Current stable Chrome is 130+. |
| chrome.sidePanel | Chrome 114+ | Side Panel API. Available since mid-2023. Safe to require. |
| chrome.offscreen | Chrome 109+ | Offscreen Document API for Canvas operations in MV3. Required for image cropping since service workers lack DOM/Canvas. |
| chrome.tabs.captureVisibleTab | Chrome 5+ | Ancient API, universally available. |
| Shadow DOM v1 | Chrome 53+ | Universal. |
| getComputedStyle | All versions | Universal. |
### Required Manifest Permissions
- `activeTab`: Grants temporary access to the current tab when user clicks the extension icon. Enables captureVisibleTab and content script injection without blanket `<all_urls>` permission. Preferred for Chrome Web Store review.
- `sidePanel`: Required for Side Panel API.
- `storage`: Required for chrome.storage.local (API keys) and chrome.storage.sync (preferences).
- `offscreen`: Required for offscreen document (image cropping).
- `host_permissions`: Scoped to only the APIs Nitpick calls. NOT `<all_urls>`.
## Sources
- npm registry: verified versions for all packages (plasmo@0.90.5, wxt@0.20.25, @crxjs/vite-plugin@2.4.0, openai@6.34.0, preact@10.29.1, @preact/signals@2.9.0, vite@8.0.10, typescript@6.0.3, zod@4.3.6, html2canvas@1.4.1, html-to-image@1.11.13, tailwindcss@4.2.4) -- HIGH confidence on versions
- Chrome Extension API behavior (MV3 service worker lifecycle, captureVisibleTab, offscreen documents, sidePanel API) -- based on training data from Chrome developer documentation up to early 2025 -- MEDIUM-HIGH confidence (APIs are stable and well-documented, unlikely to have changed)
- OpenAI SDK zero-dependency claim: verified via `npm view openai dependencies` returning `{}` -- HIGH confidence
- Build tool comparison (CRXJS vs Plasmo vs WXT): based on training data and npm metadata. Framework choice rationale is opinionated and based on the specific requirements of this project -- MEDIUM confidence (any of the three would work; the recommendation reflects the need for low-level Chrome API control)
- Shadow DOM isolation pattern for content scripts: well-established pattern in Chrome extension development -- HIGH confidence
- Preact vs React bundle size: well-documented, ~3KB vs ~40KB gzipped -- HIGH confidence
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
