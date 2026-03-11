# Mini Games Launcher

A web-based launcher for small self-contained arcade games. Each game lives in its own folder and is built independently with Vite. The launcher is a static page served alongside the built games.

## Running Locally

```sh
# From the mini-games root
npm run build   # builds all games + copies launcher to dist/
npm run serve   # serves dist/ at http://localhost:8080
```

## Project Structure

```
mini-games/
├── index.html          # launcher page (edit to add game cards)
├── package.json        # root build scripts
├── dist/               # build output (git-ignored)
│   ├── index.html
│   ├── brickout/
│   └── pong-game/
├── brickout/           # game folder
├── pong-game/          # game folder
└── roids/              # game folder
```

Most game folders are Vite + Phaser 3 projects. Plain static games (like `roids/`) can skip the Vite setup — see the plain HTML path below.

## Adding a New Game

There are two paths depending on whether the game uses a build tool.

---

### Path A — Vite project (brickout, pong-game style)

#### 1. Create the game folder

Build it as a standard Vite project. The game should have an `index.html` entry point and a `package.json` with a `build` script.

#### 2. Add `vite.config.js` to the game folder

```js
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/my-new-game/',
  build: {
    outDir: '../dist/my-new-game',
    emptyOutDir: true,
  },
})
```

Replace `my-new-game` with the actual folder name.

#### 3. Add a build command to root `package.json`

```json
"build:my-new-game": "cd my-new-game && npm install && npm run build"
```

Then append it to the main `build` script:

```json
"build": "... && npm run build:my-new-game && cp index.html dist/"
```

---

### Path B — Plain static HTML (roids style)

If the game is just HTML/CSS/JS with no build step, put all game files in a `public/` subfolder and add a single copy command to root `package.json`:

```json
"build:my-new-game": "cp -r my-new-game/public dist/my-new-game"
```

No `vite.config.js` needed.

---

### Final step — Add a card to `index.html`

In the `GAMES` array near the top of `index.html`, add an entry:

```js
{
  title: 'My New Game',
  description: 'Short description of the game.',
  controls: 'Arrow Keys',
  path: '/my-new-game/',
},
```

Set `path: null` while the game is still in development — it will render as "Coming Soon" automatically.

## Deploying

After `npm run build`, the `dist/` folder is a fully static site. Drop it on any static host (Netlify, Vercel, GitHub Pages, S3, etc.) — no server-side logic required.
