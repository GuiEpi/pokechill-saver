# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bun install              # Install dependencies
bun run dev              # Dev mode (Chrome, hot reload)
bun run dev:firefox      # Dev mode (Firefox)
bun run build            # Production build → .output/chrome-mv3/
bun run build:firefox    # Production build → .output/firefox-mv2/
bun run zip              # Build + zip for Chrome
bun run zip:firefox      # Build + zip for Firefox
bun run compile          # TypeScript type-check (no emit)
```

Environment variable `VITE_DROPBOX_APP_KEY` must be set in `.env` (local) or as a GitHub secret (CI). Accessed via `import.meta.env.VITE_DROPBOX_APP_KEY` — **not** `process.env` (code runs in browser, not Node).

## Architecture

WXT (Web eXtension Toolkit) + React 19 + TypeScript browser extension. Targets both Chrome (MV3) and Firefox (MV2).

### Message-passing flow

```
Popup (React UI)
  ↕ browser.runtime.sendMessage
Background Script (service worker)
  ↕ Dropbox HTTP API (OAuth PKCE + upload/download)

Popup → browser.tabs.sendMessage → Content Script (localStorage access)
Content Script → browser.runtime.sendMessage → Background (auto-save on visibilitychange)
```

### Key entrypoints

- **`entrypoints/background.ts`** — Message router handling: `DROPBOX_AUTH`, `DROPBOX_SAVE`, `DROPBOX_LOAD`, `DROPBOX_STATUS`, `DROPBOX_LOGOUT`, `AUTO_SAVE`. All Dropbox API calls go through here.
- **`entrypoints/content.ts`** — Injected on `play-pokechill.github.io`. Reads/writes `gameData` in localStorage. Triggers auto-save on `visibilitychange`.
- **`entrypoints/popup/App.tsx`** — React popup UI with connect/save/load/disconnect buttons and last sync display.
- **`utils/dropbox.ts`** — Dropbox OAuth2 PKCE flow, token management, file upload/download to `/pokechill-save.json`.

### Theming

CSS custom properties in `style.css` with `prefers-color-scheme` media query for automatic dark/light mode. Uses "Disposable Droid" pixel font loaded from `public/fonts/`.

### Manifest configuration

Defined in `wxt.config.ts`. Permissions: `storage`, `identity`, `activeTab`. Host permission: `play-pokechill.github.io`. Firefox has a fixed gecko ID (`pokechill-saver@extension`) for stable redirect URLs.

### CI/CD

GitHub Actions workflow (`.github/workflows/release.yml`) triggers on release creation: builds both browser zips, uploads to GitHub release, publishes to Chrome Web Store and Firefox Add-ons.

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

Format: `<type>(<optional scope>): <description>`

**Types:** `feat` (new feature), `fix` (bug fix), `refactor`, `perf`, `style`, `test`, `docs`, `build`, `ops`, `chore`

**Rules:**
- Use imperative present tense: "add" not "added"
- Do not capitalize first letter
- No period at the end
- Breaking changes: add `!` before `:` (e.g., `feat!: remove endpoint`) and `BREAKING CHANGE:` in footer

**Examples:**
- `feat: add email notifications on new direct messages`
- `fix(popup): prevent save when not connected`
- `build: update dependencies`
- `chore: init`
- `build(release): bump version to 0.2.2`
