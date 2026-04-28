# devrev-web codebase reference

Read this file when the target repo is devrev-web. Contains everything needed to locate and fix UI bugs faster.

## Monorepo structure

Build system: **Nx** with **pnpm**. 19 apps, 143 libs.

### Apps

| App | Path | What it is | Theme |
|-----|------|-----------|-------|
| **product** | `apps/product/` | Main web app (app.devrev.ai) — React Router SPA | devrev (default) or arcade (feature flag) |
| **search** | `apps/search/` | Computer app (desktop, Electron-hosted) | arcade (always) |
| **product-native** | `apps/product-native/` | Desktop Electron wrapper for the web app | arcade (always, via Electron env) |
| **portal-shell** | `apps/portal-shell/` | Customer support portal (support.devrev.ai) | devrev (always) |
| **marketplace** | `apps/marketplace/` | Marketplace for snap-ins | marketplace-app-theme |

### Key lib directories

```
libs/
├── design-system/shared/           # DS components, themes, form, molecules
│   ├── raw-design-system/          # Core components + theming engine (useTheme, CVA)
│   └── themes/                     # Theme implementations
│       ├── devrev-app-theme/       # Default theme (200+ component configs)
│       ├── arcade-theme/           # Modern theme (extends devrev, overrides ~85 components)
│       ├── marketplace-app-theme/  # Minimal (4 components)
│       ├── articles-theme/         # RTE-only
│       └── theme-config/           # ThemeManager singleton + registry
├── micro-apps/                     # Feature modules routed from main app
│   ├── main/                       # Root wrapper + route definitions
│   ├── work-v2/                    # Works/issues (new)
│   ├── tasks-v2/                   # Tasks
│   ├── part/                       # Parts
│   ├── identity/                   # Settings, auth
│   └── dashboard/                  # Dashboard
├── shared/                         # Cross-cutting utilities
│   ├── drid/                       # data-drid utilities (joinDrids, proxyDrids)
│   ├── ui-utils/                   # Router paths enum
│   ├── ui-components/              # Layout templates (PageLayout)
│   ├── ui-icons/                   # Icon system (SVG sprite + lazy components)
│   ├── product-feature-flags/      # 150+ feature flag enum
│   ├── logger/                     # Datadog + MELTS logging
│   └── error-boundary/             # Error boundary with module types
├── conversations/                  # Inbox / messages
├── works/                          # Issues / tickets (legacy)
├── left-panel/                     # Navigation sidebar
├── side-panel/                     # Right detail panel
├── settings/                       # Settings pages
├── computer/                       # Computer/agent features
├── articles/                       # Knowledge base
└── commerce/                       # Billing, invoices
```

## URL → feature area mapping

React Router. Map URL path to narrow search scope:

```
/inbox          → libs/conversations/
/works          → libs/works/ or libs/micro-apps/work-v2/
/tasks          → libs/micro-apps/tasks-v2/
/settings       → libs/settings/ or libs/micro-apps/identity/settings/
/computer       → libs/computer/
/dashboard      → libs/dashboard-router/ or libs/micro-apps/dashboard/
/knowledge-base → libs/articles/
/parts          → libs/micro-apps/part/
/vistas         → (search for vista/vistas)
```

Full route list: `libs/shared/ui-utils/src/router-paths.ts` (RouterPaths enum, 100+ routes).

Feature code: `libs/{feature}/feature/{page}/src/{page}.tsx`
Tracker files: `libs/{feature}/shared/trackers/src/*-trackers.ts`
Main wrapper with all routes: `libs/micro-apps/main/src/components/wrapper/wrapper.tsx`

## DRID system (data-drid)

DRIDs are the primary element identifiers. Built via `joinDrids()` from `libs/shared/drid/src/drid-helper.ts`.

**Format:** `{base}--{component}--{subcomponent}` — segments joined with `--`.

**How to trace:**
1. Split on `--` → segments. E.g. `commands-table--banner` → `commands-table`, `banner`
2. Grep base segment in tracker files: `grep -r "commands-table" libs/*/shared/trackers/ --include="*.ts" -l`
3. Tracker file has: `COMMANDS_TABLE_BANNER: joinDrids(base, 'banner')`
4. Find JSX usage: `grep -r "COMMANDS_TABLE_BANNER" libs/ --include="*.tsx" -l`

Testing infra uses `data-drid` as `testIdAttribute` (not `data-testid`).

## Design system theme architecture

### How components get styled

1. Component calls `useTheme('componentName', defaultConfig)` → returns CVA factories per slot
2. Theme config at `devrev-app-theme/src/components/<name>.ts` defines Tailwind classes
3. Each slot has: `className` (base), `variants` (prop→class), `compoundVariants` (conditional combos), `defaultVariants`
4. CVA (class-variance-authority) merges base + variant + compound + consumer className

**To trace a class to its source:**
1. Find `useTheme('key', ...)` in the component → first arg is the theme key
2. Look in `libs/design-system/shared/themes/devrev-app-theme/src/components/<key>.ts`
3. Export pattern: `export const <name>ThemeConfig: ThemeProviderProps['<key>'] = { ... }`
4. Match DOM classes to the right slot

### Two themes: devrev vs arcade

| Theme | Config location | CSS variables | Components |
|-------|----------------|---------------|------------|
| `devrev` (default) | `.../devrev-app-theme/src/components/` | `apps/product/styles/dark-styles.css` | 200+ |
| `arcade` | `.../arcade-theme/src/themes/components/` | `.../arcade-theme/src/styles/arcade.css` | ~85 overrides |

**Arcade extends DevRev** — spreads the devrev theme then overrides selectively. Un-overridden components fall back to devrev-app-theme.

**Runtime selection:**
- DOM: `<html data-theme="arcade">` or `<html data-theme="devrev">`
- Product web app → feature flag `ARCADE_DESIGN_SYSTEM_THEME_ENABLED` (default: devrev)
- Search/Computer app → always arcade
- Portal → always devrev

**If bug is theme-specific:**
1. Check arcade override exists: `grep -r "ComponentName" libs/design-system/shared/themes/arcade-theme/src/ -l`
2. If yes → fix goes in arcade override. If no → fix in devrev-app-theme (arcade inherits it).
3. Color bugs: check `arcade.css` for `[data-theme='arcade']` selectors — arcade has its own palette (`--husk-*`, `--action-*`)

**Identifying theme from description:** Arcade uses `husk-*` palette vars; devrev uses `neutral-*`.

### CSS variable chain

```
Tailwind class (e.g. control-bg-prominent-idle)
  → tailwind.config.base.js → CSS variable (e.g. hsl(var(--bg-interactive-primary-resting)))
    → dark-styles.css → variable definition (e.g. --bg-interactive-primary-resting: var(--accent-500))
      → palette variable (e.g. --accent-500: 217 91% 60%)
```

**CSS variable prefix families:** `--bg-*`, `--fg-*`, `--color-*`, `--control-*`, `--input-*`, `--feedback-*`, `--object-*`, `--border-*`, `--shadow-*`, `--text-*`, `--tag-*`, `--navigation-*`, `--chart-*`, `--button-*`

Fix target by layer:
- Wrong semantic mapping → `tailwind.config.base.js`
- Wrong token value for dark/light → `apps/product/styles/dark-styles.css` (devrev) or `arcade-theme/src/styles/arcade.css` (arcade)
- Wrong class on component → theme config or component JSX

### Tailwind breakpoints

```
small: 480px, sm-max: max-width 639px, md-max: max-width 960px,
medium: 960px, hd: 1280px, large: 1440px, xl: 1680px, 2xl: 1920px
```

## DS bug vs local bug diagnosis

**Q1: Is the class from a theme config or from JSX?**
```bash
grep -n "useTheme\|createThemeConfig" <component-file>
```
- `useTheme(...)` → classes from theme config. Trace the theme.
- Hardcoded Tailwind → local/consumer problem. Fix the JSX.

**Q2: Signals**

| Signal | DS problem | Consumer problem |
|--------|-----------|-----------------|
| Wrong class in theme config slot | ✓ | |
| Wrong default variant | ✓ | |
| CSS variable resolves wrong | ✓ (token layer) | |
| Consumer passes wrong variant/size prop | | ✓ |
| Consumer wraps DS component with conflicting styles | | ✓ |
| Bug appears in Storybook with same props | ✓ | |
| Bug only on one page/context | | ✓ (usually) |
| Multiple unrelated pages show same bug | ✓ | |

**Q3: DS layers (check top→bottom)**

1. **Theme config** (`devrev-app-theme/src/components/<name>.ts`) — wrong class in slot/variant. Blast radius: ALL consumers.
2. **Component impl** (`raw-design-system/src/components/<name>/`) — wrong prop forwarding. Blast radius: all consumers.
3. **Tailwind config** (`tailwind.config.base.js`) — token maps to wrong var. Blast radius: huge.
4. **CSS variables** (`dark-styles.css` / `arcade.css`) — wrong HSL. Blast radius: very broad.

**Always check consumer count before DS fixes:**
```bash
grep -r "<ComponentName" libs/ apps/ --include="*.tsx" -l | wc -l
```
If >10 consumers, flag to user — needs broad visual verification.

## Common bug patterns

1. **Wrong variant by consumer** — renders `size="M"` but needs `size="S"`. Fix the consumer.
2. **Missing compound variant** — `{ variant: 'secondary', disabled: true }` has no entry, falls through to base. Fix theme config.
3. **Slot className conflict** — base classes conflict with variant classes (both set `rounded-*`). CVA: last wins. Fix theme config.
4. **Consumer className loses to CVA** — `className="bg-red-500"` overridden by theme. Need `!bg-red-500` or theme change.
5. **Portal loses theme context** — modal renders via Radix Portal outside ThemeProvider. Check `portalContainer` prop.
6. **Radix data-state not styled** — Radix sets `data-state="open"` but theme checks `active: true`. Fix compound variant conditions.
7. **Wrong theme edited** — fixed devrev-app-theme but user is on arcade (or vice versa). Check Environment table Theme row.
8. **SCSS module override** — `.module.scss` alongside component overrides Tailwind classes. Check for `*.module.scss`.

## Other styling systems

- **CVA** — DS uses class-variance-authority via `useTheme()`. Don't interact with `cva(...)` directly.
- **CSS Modules** — `.module.scss` exists for some components (ag-grid tables, portal templates). May use `@apply` or `@keyframes`.
- **Radix UI** — Checkbox, Select, Dialog, Drawer, Tabs wrap Radix. State via `data-state` (`checked`, `unchecked`, `open`, `closed`). Style bugs often need theme config compound variant fixes.
- **Framer Motion** — Tree menu animations. `AnimatePresence` + `motion.div`.
- **Portal-rendered elements** — modals, drawers, tooltips render to `document.body`. Ancestor chain shows `<body>`. Use React component chain instead.
- **Icons** — wrapped in `<i>` tags with size classes. Bug is usually on parent element or theme, not the SVG.

## State data attributes

Radix and DS components expose state via data attributes — essential for understanding component state:

- `data-state` — `checked`, `unchecked`, `indeterminate`, `open`, `closed`, `active`, `inactive`
- `data-feedback` — `error`, `success`, `warning` (form inputs)
- `data-readonly`, `data-disabled`, `data-inline`, `data-direction`
- `aria-checked`, `aria-selected`, `aria-invalid`, `aria-disabled`
