# Vibe Arcade

A collection of small arcade-style games with a central launcher page. Games often originate outside this project and get brought in.

## Project Structure

```
vibe-arcade/
  index.html          # Launcher / game-selector page (hand-authored, not built)
  icon.png            # Arcade icon, copied to dist/ on build
  package.json        # Root — npm workspaces: ["games/*"]
  shared/
    touch-controller.js  # Virtual joystick/button overlay (synthesises keyboard events)
  games/
    <game-name>/
      package.json    # name: "@arcade/<game-name>", scripts: { build: "vite build" }
      vite.config.js  # base + outDir pointing to ../../dist/<game-name>
      index.html
      src/main.js
  dist/               # Build output (not committed)
```

## Tech Stack

- **Vite** — each game is its own Vite project
- **Phaser 3** — primary game framework (available as a shared root dependency)
- **npm workspaces** — root workspace pulls in all `games/*`
- **GitHub Pages** — deployed automatically on push to `main` via `.github/workflows/deploy.yml`

## Build

```bash
npm run build   # builds all workspace games, then copies index.html + icon.png to dist/
npm run serve   # serves dist/ locally on port 8080
```

The `REPO_BASE` env var is set to `/vibe-arcade` in CI (GitHub Pages sub-path). Each game's `vite.config.js` reads it:

```js
const repoBase = process.env.REPO_BASE ?? ''
export default defineConfig({
  base: repoBase + '/<game-name>/',
  build: { outDir: '../../dist/<game-name>', emptyOutDir: true },
})
```

## Adding a New Game

Both steps are required — skipping either means the game won't appear or won't build.

### 1. Create the game directory

```
games/<game-name>/
  package.json
  vite.config.js
  index.html
  src/main.js
```

**package.json** — minimum required:
```json
{
  "name": "@arcade/<game-name>",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": { "build": "vite build" }
}
```

**vite.config.js** — required pattern:
```js
import { defineConfig } from 'vite'

const repoBase = process.env.REPO_BASE ?? ''

export default defineConfig({
  base: repoBase + '/<game-name>/',
  build: {
    outDir: '../../dist/<game-name>',
    emptyOutDir: true,
  },
})
```

### 2. Add an entry to the GAMES array in index.html

Open `index.html` and add a new object to the `GAMES` array (around line 167):

```js
{
  title: 'My Game',
  description: 'One or two sentences describing the game and goal.',
  controls: 'Keyboard: Arrow Keys + Space / Supports Touch',
  path: './<game-name>/',
},
```

Set `path: null` to show a "Coming Soon" card instead of a Play button.

## Touch Support

`shared/touch-controller.js` provides a virtual joystick + action buttons overlay that synthesises keyboard events. Games require zero changes to support touch — just include the script. Check existing games for the include pattern.

## Deployment

Pushes to `main` trigger the GitHub Actions workflow which runs `npm ci && npm run build` (with `REPO_BASE=/vibe-arcade`) and deploys `dist/` to GitHub Pages.
