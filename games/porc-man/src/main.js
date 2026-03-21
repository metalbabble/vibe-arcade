import Phaser from 'phaser'
import '../../../shared/touch-controller.js'

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 800, H = 600
const CELL = 26
const COLS = 21, ROWS = 21
const MX = Math.floor((W - COLS * CELL) / 2)   // 127
const MY = 53                                    // HUD height

const WALL = 0, PATH = 1

const BASE_PLAYER_SPEED = 4.5   // cells per second
const BASE_GHOST_SPEED  = 3.2   // cells per second
const SPEED_INC         = 0.35  // added per level
const POWERUP_MS        = 8000
const POWERUP_WARN_MS   = 2500
const GHOST_RESPAWN_MS  = 3000
const POWERUP_COUNT     = 4
const NUM_GHOSTS        = 4
const INITIAL_LIVES     = 3
const DOT_PTS           = 1
const POWERUP_PTS       = 5
const GHOST_PTS         = 50

const GHOST_COLORS = [0xFF4444, 0xFFAACC, 0x44FFFF, 0xFFAA44]

// ─── Maze generation (recursive backtracking + loop injection) ────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function makeMaze() {
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(WALL))

  function carve(r, c) {
    g[r][c] = PATH
    for (const [dr, dc] of shuffle([[-2,0],[2,0],[0,-2],[0,2]])) {
      const nr = r + dr, nc = c + dc
      if (nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1 && g[nr][nc] === WALL) {
        g[r + dr / 2][c + dc / 2] = PATH
        carve(nr, nc)
      }
    }
  }
  carve(1, 1)

  // Add ~20% extra connections to create loops / multiple routes
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (g[r][c] === WALL) {
        const pathNeighbours = [[-1,0],[1,0],[0,-1],[0,1]].filter(
          ([dr, dc]) => g[r + dr]?.[c + dc] === PATH
        )
        if (pathNeighbours.length >= 2 && Math.random() < 0.20) {
          g[r][c] = PATH
        }
      }
    }
  }
  return g
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────
/** Cell (col, row) centre in world pixels */
function cc(col, row) {
  return { x: MX + col * CELL + CELL / 2, y: MY + row * CELL + CELL / 2 }
}

/** World pixels → nearest cell {col, row} */
function wc(x, y) {
  return {
    col: Math.round((x - MX - CELL / 2) / CELL),
    row: Math.round((y - MY - CELL / 2) / CELL),
  }
}

// ─── BFS pathfinding (returns first direction step) ───────────────────────────
function bfsDir(grid, fc, fr, tc, tr) {
  if (fc === tc && fr === tr) return { dx: 0, dy: 0 }
  const queue = [[fc, fr, null]]
  const seen  = new Set([`${fc},${fr}`])
  while (queue.length) {
    const [c, r, first] = queue.shift()
    for (const [dc, dr] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nc = c + dc, nr = r + dr
      const k  = `${nc},${nr}`
      if (!seen.has(k) && grid[nr]?.[nc] === PATH) {
        const d = first ?? { dx: dc, dy: dr }
        if (nc === tc && nr === tr) return d
        seen.add(k)
        queue.push([nc, nr, d])
      }
    }
  }
  return { dx: 0, dy: 0 }
}

// ─── Web Audio helpers ────────────────────────────────────────────────────────
let audioCtx = null
function audio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}
function tone(freq, dur, type = 'square', vol = 0.12) {
  try {
    const ctx = audio()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = type; osc.frequency.value = freq
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start(); osc.stop(ctx.currentTime + dur)
  } catch (_) {}
}
const sfxWaka     = () => { tone(440, 0.05); setTimeout(() => tone(330, 0.05), 60) }
const sfxPowerup  = () => { [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'sine', 0.18), i * 90)) }
const sfxGhost    = () => { tone(880, 0.08, 'sine', 0.2); setTimeout(() => tone(1100, 0.1, 'sine', 0.2), 90) }
const sfxDeath    = () => { [440,415,392,370,349,330,311,294,278,262].forEach((f,i) => setTimeout(() => tone(f, 0.13, 'sawtooth', 0.18), i * 95)) }
const sfxLevel    = () => { [523,659,784,1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.2), i * 140)) }

// ─── Drawing helpers ──────────────────────────────────────────────────────────
function drawPig(gfx, x, y, dir) {
  const r = CELL / 2 - 2

  // Rotation angle: pig faces RIGHT in local space (snout at +lx)
  let angle = 0
  if (dir) {
    if      (dir.dx ===  1) angle = 0
    else if (dir.dy ===  1) angle = Math.PI / 2
    else if (dir.dx === -1) angle = Math.PI
    else if (dir.dy === -1) angle = -Math.PI / 2
  }
  const cos = Math.cos(angle), sin = Math.sin(angle)
  // Rotate local offset (lx,ly) around (x,y)
  const R = (lx, ly) => ({ x: x + lx * cos - ly * sin, y: y + lx * sin + ly * cos })

  // Body
  gfx.fillStyle(0xFF69B4, 1)
  gfx.fillCircle(x, y, r)

  // Ears (rear, flanking sides)
  const e1 = R(-r * 0.45, -r * 0.72)
  const e2 = R(-r * 0.45,  r * 0.72)
  gfx.fillStyle(0xFF99CC, 1)
  gfx.fillCircle(e1.x, e1.y, r * 0.34)
  gfx.fillCircle(e2.x, e2.y, r * 0.34)
  gfx.fillStyle(0xFF69B4, 1)
  gfx.fillCircle(e1.x, e1.y, r * 0.18)
  gfx.fillCircle(e2.x, e2.y, r * 0.18)

  // Snout (front)
  const sn = R(r * 0.38, 0)
  gfx.fillStyle(0xFFAACC, 1)
  gfx.fillCircle(sn.x, sn.y, r * 0.36)

  // Nostrils
  const n1 = R(r * 0.52, -r * 0.14)
  const n2 = R(r * 0.52,  r * 0.14)
  gfx.fillStyle(0xBB3366, 1)
  gfx.fillCircle(n1.x, n1.y, r * 0.1)
  gfx.fillCircle(n2.x, n2.y, r * 0.1)

  // Eyes (front-sides)
  const ey1 = R(r * 0.18, -r * 0.42)
  const ey2 = R(r * 0.18,  r * 0.42)
  gfx.fillStyle(0x220011, 1)
  gfx.fillCircle(ey1.x, ey1.y, r * 0.18)
  gfx.fillCircle(ey2.x, ey2.y, r * 0.18)

  // Eye shine
  const sh = R(r * 0.06, 0)
  gfx.fillStyle(0xFFFFFF, 1)
  gfx.fillCircle(ey1.x + (sh.x - x) * 0.5, ey1.y + (sh.y - y) * 0.5, r * 0.07)
  gfx.fillCircle(ey2.x + (sh.x - x) * 0.5, ey2.y + (sh.y - y) * 0.5, r * 0.07)
}

function drawGhost(gfx, x, y, color, frightened, flash) {
  const r       = CELL / 2 - 1
  const c       = frightened ? (flash ? 0xEEEEEE : 0x2222CC) : color
  const domeCy  = y - r * 0.15
  const bodyBot = domeCy + r * 1.1   // bottom of the rectangular body

  gfx.fillStyle(c, 1)

  // Dome + body rectangle
  gfx.fillCircle(x, domeCy, r)
  gfx.fillRect(x - r, domeCy, r * 2, r * 1.1)

  // Zig-zag skirt — 3 downward-pointing triangles
  const teeth   = 3
  const toothW  = (r * 2) / teeth
  const toothDp = r * 0.52
  for (let i = 0; i < teeth; i++) {
    const lx = x - r + i * toothW
    const rx = lx + toothW
    const mx = lx + toothW / 2
    gfx.fillTriangle(lx, bodyBot, rx, bodyBot, mx, bodyBot + toothDp)
  }

  // Eyes
  gfx.fillStyle(frightened ? 0xFF5555 : 0xFFFFFF, 1)
  gfx.fillCircle(x - r * 0.35, y - r * 0.32, r * 0.28)
  gfx.fillCircle(x + r * 0.35, y - r * 0.32, r * 0.28)
  if (!frightened) {
    gfx.fillStyle(0x0033BB, 1)
    gfx.fillCircle(x - r * 0.25, y - r * 0.3,  r * 0.14)
    gfx.fillCircle(x + r * 0.45, y - r * 0.3,  r * 0.14)
  }
}

// ─── Title Scene ─────────────────────────────────────────────────────────────
class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene') }

  create() {
    const bg = this.add.graphics()
    bg.fillStyle(0x0a0a0f, 1)
    bg.fillRect(0, 0, W, H)

    // Maze-grid strip behind the character row
    bg.fillStyle(0x1a0a2e, 1)
    bg.fillRect(0, 300, W, 150)
    bg.lineStyle(1, 0x5c1a9e, 0.4)
    for (let x = 0; x < W; x += 26) bg.lineBetween(x, 300, x, 450)
    for (let y = 300; y < 450; y += 26) bg.lineBetween(0, y, W, y)

    // Title
    this.add.text(W / 2, 78, 'PORC-MAN', {
      fontSize: '76px',
      fontFamily: 'Courier New, monospace',
      color: '#FF69B4',
      stroke: '#AA0055',
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 0, color: '#FF69B4', blur: 30, fill: true },
    }).setOrigin(0.5)

    this.add.text(W / 2, 150, 'THE MAZE-RUNNING PIG', {
      fontSize: '20px',
      fontFamily: 'Courier New, monospace',
      color: '#CC88BB',
    }).setOrigin(0.5)

    // Instructions
    const lines = [
      ['ARROW KEYS / WASD', 'Move Porc-Man'],
      ['EAT UP THE DOTS',   'Clear all dots to complete the level'],
      ['PINK POWER-UPS',    'Become invincible and eat the ghosts!'],
    ]
    lines.forEach(([key, val], i) => {
      this.add.text(W / 2 - 240, 190 + i * 34, key, {
        fontSize: '14px', fontFamily: 'Courier New, monospace', color: '#FF69B4',
      })
      this.add.text(W / 2 - 20, 190 + i * 34, val, {
        fontSize: '14px', fontFamily: 'Courier New, monospace', color: '#e0e0e0',
      })
    })

    // Characters: Porc-Man chasing 3 ghosts, evenly spaced across the strip
    const charY   = 375
    const charScale = 2.5
    const xs = [160, 320, 480, 640]  // pig then 3 ghosts

    const pigGfx = this.add.graphics()
    drawPig(pigGfx, 0, 0, { dx: 1, dy: 0 })
    pigGfx.setPosition(xs[0], charY).setScale(charScale)

    const ghostGfxs = []
    for (let i = 0; i < 3; i++) {
      const g = this.add.graphics()
      drawGhost(g, 0, 0, GHOST_COLORS[i], false, false)
      g.setPosition(xs[i + 1], charY).setScale(charScale)
      ghostGfxs.push(g)
    }

    // Gentle bob animation — ghosts staggered
    const bobTween = (target, delay) => this.tweens.add({
      targets: target, y: charY + 10,
      duration: 550, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut', delay,
    })
    bobTween(pigGfx, 0)
    ghostGfxs.forEach((g, i) => bobTween(g, 140 * (i + 1)))

    // Press enter
    const prompt = this.add.text(W / 2, 500, 'PRESS ENTER OR TAP TO START', {
      fontSize: '24px', fontFamily: 'Courier New, monospace', color: '#FFD700',
    }).setOrigin(0.5)
    this.tweens.add({ targets: prompt, alpha: 0, duration: 550, yoyo: true, repeat: -1 })

    // Back link
    this.add.text(14, H - 12, '← BACK', {
      fontSize: '13px', fontFamily: 'Courier New, monospace', color: '#555',
    }).setOrigin(0, 1).setInteractive().on('pointerdown', () => { window.location.href = '/' })

    const start = () => {
      try { audio().resume() } catch (_) {}
      this.scene.start('GameScene', { level: 1, score: 0, lives: INITIAL_LIVES })
    }
    this.input.keyboard.on('keydown-ENTER', start)
    this.input.keyboard.on('keydown-SPACE', start)
    this.input.on('pointerdown', start)
  }
}

// ─── Game Scene ───────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene') }

  init(data) {
    this.level  = data?.level  ?? 1
    this.score  = data?.score  ?? 0
    this.lives  = data?.lives  ?? INITIAL_LIVES
  }

  create() {
    // Generate maze
    this.maze = makeMaze()
    this.pathCells = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.maze[r][c] === PATH) this.pathCells.push({ col: c, row: r })
      }
    }

    // Player state — cell-to-cell interpolation
    this.pFromCol = 1; this.pFromRow = 1
    this.pToCol   = 1; this.pToRow   = 1
    this.pProgress = 1.0   // 1.0 = "arrived", triggers direction pick
    this.pDir     = { dx: 0, dy: 0 }
    this.pNext    = { dx: 0, dy: 0 }
    this.pFaceDir = { dx: 1, dy: 0 }  // last direction moved — used for pig orientation
    // Derived pixel position (set each frame by movePlayer)
    const startPt = cc(1, 1)
    this.px = startPt.x
    this.py = startPt.y

    // Timing / state flags
    this.animT         = 0
    this.powerupActive = false
    this.powerupTimer  = 0
    this.dead          = false
    this.deadTimer     = 0
    this.levelDone     = false
    this.levelTimer    = 0
    this.wakaToggle    = 0

    // Speed multiplier (increases per level)
    this.speedMult = 1 + (this.level - 1) * SPEED_INC

    // ── Place power-ups ───────────────────────────────────────────────────────
    const farCells = this.pathCells.filter(({ col, row }) => col + row > 8)
    shuffle(farCells)
    this.powerupSet = new Set()
    const puCount = Math.min(POWERUP_COUNT, farCells.length)
    for (let i = 0; i < puCount; i++) {
      this.powerupSet.add(`${farCells[i].col},${farCells[i].row}`)
    }

    // ── Maze drawn first so dots appear on top of it ──────────────────────────
    this.mazeGfx = this.add.graphics()
    this.drawMaze()

    // ── Dots (all path cells except player start) ─────────────────────────────
    this.dots = new Map()  // key -> { obj: Phaser.GameObjects, isPowerup }
    for (const { col, row } of this.pathCells) {
      if (col === 1 && row === 1) continue
      const { x, y } = cc(col, row)
      const k        = `${col},${row}`
      const isPU     = this.powerupSet.has(k)
      const radius   = isPU ? 6 : 3
      const colour   = isPU ? 0xFF69B4 : 0xFFFF88
      const dot      = this.add.circle(x, y, radius, colour)
      if (isPU) {
        this.tweens.add({ targets: dot, scaleX: 1.5, scaleY: 1.5, duration: 480, yoyo: true, repeat: -1 })
      }
      this.dots.set(k, { obj: dot, isPowerup: isPU })
    }

    // ── Ghosts ────────────────────────────────────────────────────────────────
    this.ghosts = []
    const ghostSpawn = this.pathCells.filter(({ col, row }) => col + row > 14)
    shuffle(ghostSpawn)
    this.ghostSpawnCells = []
    for (let i = 0; i < NUM_GHOSTS; i++) {
      const cell = ghostSpawn[i % ghostSpawn.length]
      this.ghostSpawnCells.push(cell)
      const { x, y } = cc(cell.col, cell.row)
      this.ghosts.push({
        x, y,
        fromCol: cell.col, fromRow: cell.row,
        toCol:   cell.col, toRow:   cell.row,
        progress: 1.0,          // 1.0 = arrived, triggers first direction pick
        dir:      { dx: 0, dy: 0 },
        color:    GHOST_COLORS[i],
        frightened: false,
        eaten:      false,
        respawnT:   0,
      })
    }

    // ── Entity graphics layer — rendered above dots ───────────────────────────
    this.entityGfx = this.add.graphics()

    // ── HUD ───────────────────────────────────────────────────────────────────
    this.scoreText = this.add.text(10, 8, '', {
      fontSize: '18px', fontFamily: 'Courier New, monospace', color: '#FFD700',
    })
    this.levelText = this.add.text(W / 2, 8, '', {
      fontSize: '18px', fontFamily: 'Courier New, monospace', color: '#e0e0e0',
    }).setOrigin(0.5, 0)
    this.livesText = this.add.text(W - 10, 8, '', {
      fontSize: '18px', fontFamily: 'Courier New, monospace', color: '#FF69B4',
    }).setOrigin(1, 0)
    this.powerText = this.add.text(W / 2, H - 8, '', {
      fontSize: '15px', fontFamily: 'Courier New, monospace', color: '#FF69B4',
    }).setOrigin(0.5, 1)
    this.refreshHUD()

    // Overlay texts
    this.overlayText = this.add.text(W / 2, H / 2 - 20, '', {
      fontSize: '52px', fontFamily: 'Courier New, monospace', color: '#FFD700',
      stroke: '#AA7700', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10)
    this.subText = this.add.text(W / 2, H / 2 + 46, '', {
      fontSize: '22px', fontFamily: 'Courier New, monospace', color: '#e0e0e0',
    }).setOrigin(0.5).setDepth(10)

    // Back link
    this.add.text(14, H - 12, '← BACK', {
      fontSize: '13px', fontFamily: 'Courier New, monospace', color: '#444',
    }).setOrigin(0, 1).setInteractive().on('pointerdown', () => { window.location.href = '/' })

    // ── Input ─────────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    })
  }

  refreshHUD() {
    this.scoreText.setText(`SCORE: ${this.score}`)
    this.levelText.setText(`LEVEL ${this.level}`)
    this.livesText.setText('♥'.repeat(this.lives))
  }

  drawMaze() {
    const g = this.mazeGfx
    g.clear()
    // Floor
    g.fillStyle(0x120820, 1)
    g.fillRect(MX, MY, COLS * CELL, ROWS * CELL)
    // Walls
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.maze[r][c] === WALL) {
          g.fillStyle(0x4a1080, 1)
          g.fillRect(MX + c * CELL, MY + r * CELL, CELL, CELL)
          g.lineStyle(1, 0x7c3aed, 0.45)
          g.strokeRect(MX + c * CELL, MY + r * CELL, CELL, CELL)
        }
      }
    }
    // Border
    g.lineStyle(2, 0x9c4aff, 1)
    g.strokeRect(MX, MY, COLS * CELL, ROWS * CELL)
  }

  update(_, delta) {
    this.animT += delta

    // ── Dead state: flash pig, wait, then respawn or game over ────────────────
    if (this.dead) {
      this.deadTimer -= delta
      if (this.deadTimer <= 0) {
        if (this.lives <= 0) {
          this.scene.start('GameOverScene', { score: this.score, level: this.level })
          return
        }
        // Respawn
        this.pFromCol = 1; this.pFromRow = 1
        this.pToCol   = 1; this.pToRow   = 1
        this.pProgress = 1.0
        this.pDir     = { dx: 0, dy: 0 }
        this.pNext    = { dx: 0, dy: 0 }
        this.pFaceDir = { dx: 1, dy: 0 }
        const { x, y } = cc(1, 1)
        this.px = x; this.py = y
        this.dead          = false
        this.powerupActive = false
        this.powerupTimer  = 0
        this.overlayText.setText('')
        this.subText.setText('')
        this.refreshHUD()
      }
      this.render()
      return
    }

    // ── Level complete: pause then advance ────────────────────────────────────
    if (this.levelDone) {
      this.levelTimer -= delta
      if (this.levelTimer <= 0) {
        this.scene.start('GameScene', { level: this.level + 1, score: this.score, lives: this.lives })
      }
      this.render()
      return
    }

    // ── Input → queue direction ───────────────────────────────────────────────
    const k = this.cursors, w = this.wasd
    if (k.left.isDown  || w.left.isDown)  this.pNext = { dx: -1, dy:  0 }
    if (k.right.isDown || w.right.isDown) this.pNext = { dx:  1, dy:  0 }
    if (k.up.isDown    || w.up.isDown)    this.pNext = { dx:  0, dy: -1 }
    if (k.down.isDown  || w.down.isDown)  this.pNext = { dx:  0, dy:  1 }

    // ── Move player ───────────────────────────────────────────────────────────
    this.movePlayer(delta)

    // ── Move ghosts ───────────────────────────────────────────────────────────
    for (const ghost of this.ghosts) this.moveGhost(ghost, delta)

    // ── Powerup countdown ─────────────────────────────────────────────────────
    if (this.powerupActive) {
      this.powerupTimer -= delta
      if (this.powerupTimer <= 0) {
        this.powerupActive = false
        this.ghosts.forEach(g => { g.frightened = false })
        this.powerText.setText('')
      } else {
        const secs = Math.ceil(this.powerupTimer / 1000)
        const warn = this.powerupTimer < POWERUP_WARN_MS
        const blink = warn && Math.floor(this.animT / 220) % 2 === 0
        this.powerText.setText(`★ INVINCIBLE: ${secs}s`)
        this.powerText.setColor(blink ? '#FFFFFF' : '#FF69B4')
      }
    }

    // ── Ghost respawn countdown ───────────────────────────────────────────────
    for (const ghost of this.ghosts) {
      if (!ghost.eaten) continue
      ghost.respawnT -= delta
      if (ghost.respawnT <= 0) {
        ghost.eaten = false
        // Spawn far from player
        const { col: pc, row: pr } = wc(this.px, this.py)
        const candidates = this.pathCells.filter(
          ({ col, row }) => Math.abs(col - pc) + Math.abs(row - pr) > 7
        )
        const cell = candidates.length
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : this.pathCells[Math.floor(Math.random() * this.pathCells.length)]
        const { x, y } = cc(cell.col, cell.row)
        ghost.x = x; ghost.y = y
        ghost.fromCol = cell.col; ghost.fromRow = cell.row
        ghost.toCol   = cell.col; ghost.toRow   = cell.row
        ghost.progress = 1.0
        ghost.dir = { dx: 0, dy: 0 }; ghost.frightened = false
      }
    }

    // ── Ghost collision ───────────────────────────────────────────────────────
    for (const ghost of this.ghosts) {
      if (ghost.eaten) continue
      if (Math.hypot(this.px - ghost.x, this.py - ghost.y) < CELL * 0.72) {
        if (ghost.frightened) {
          this.score += GHOST_PTS
          sfxGhost()
          ghost.frightened = false
          ghost.eaten      = true
          ghost.respawnT   = GHOST_RESPAWN_MS
          this.refreshHUD()
        } else {
          this.killPlayer()
        }
      }
    }

    // ── Level complete? ───────────────────────────────────────────────────────
    if (this.dots.size === 0 && !this.levelDone) {
      this.levelDone  = true
      this.levelTimer = 2200
      sfxLevel()
      this.overlayText.setText('LEVEL CLEAR!')
      this.subText.setText(`Onto level ${this.level + 1}…`)
    }

    this.render()
  }

  // ── Player movement — cell-to-cell interpolation ───────────────────────────
  movePlayer(delta) {
    const speed = BASE_PLAYER_SPEED * this.speedMult  // cells per second

    // Arrived at destination cell (or just starting)
    if (this.pProgress >= 1.0) {
      this.pFromCol = this.pToCol
      this.pFromRow = this.pToRow
      this.pProgress -= 1.0

      // Eat dot / power-up at arrived cell
      const k = `${this.pFromCol},${this.pFromRow}`
      if (this.dots.has(k)) {
        const { obj, isPowerup } = this.dots.get(k)
        obj.destroy()
        this.dots.delete(k)
        if (isPowerup) {
          this.score        += POWERUP_PTS
          this.powerupActive = true
          this.powerupTimer  = POWERUP_MS
          this.ghosts.forEach(g => { if (!g.eaten) g.frightened = true })
          sfxPowerup()
        } else {
          this.score += DOT_PTS
          this.wakaToggle++
          if (this.wakaToggle % 2 === 0) sfxWaka()
        }
        this.refreshHUD()
      }

      // Try queued direction first, then current direction
      const col = this.pFromCol, row = this.pFromRow
      const nd = this.pNext
      const canNext = (nd.dx || nd.dy) && this.maze[row + nd.dy]?.[col + nd.dx] === PATH
      const canCur  = (this.pDir.dx || this.pDir.dy) &&
                      this.maze[row + this.pDir.dy]?.[col + this.pDir.dx] === PATH

      if (canNext) {
        this.pDir = nd
      } else if (!canCur) {
        this.pDir = { dx: 0, dy: 0 }
      }

      if (this.pDir.dx || this.pDir.dy) {
        this.pFaceDir = this.pDir
        this.pToCol = col + this.pDir.dx
        this.pToRow = row + this.pDir.dy
      } else {
        // Stopped — keep pProgress at 1.0 so this block re-runs every frame
        // waiting for valid input, rather than falling through permanently.
        this.pToCol = col; this.pToRow = row
        this.pProgress = 1.0
      }
    }

    // Advance progress
    if (this.pDir.dx || this.pDir.dy) {
      this.pProgress += speed * delta / 1000
    }

    // Interpolate pixel position
    const from = cc(this.pFromCol, this.pFromRow)
    const to   = cc(this.pToCol,   this.pToRow)
    const t    = Math.min(this.pProgress, 1.0)
    this.px = from.x + (to.x - from.x) * t
    this.py = from.y + (to.y - from.y) * t
  }

  // ── Ghost movement — cell-to-cell interpolation ─────────────────────────────
  moveGhost(ghost, delta) {
    if (ghost.eaten) return
    const speed = BASE_GHOST_SPEED * this.speedMult * (ghost.frightened ? 0.5 : 1)

    // Arrived at destination cell (or just initialised with progress=1)
    if (ghost.progress >= 1.0) {
      ghost.fromCol = ghost.toCol
      ghost.fromRow = ghost.toRow
      ghost.progress -= 1.0

      const col = ghost.fromCol, row = ghost.fromRow

      // Pick next direction
      if (ghost.frightened) {
        const opts = [{ dx:-1,dy:0 },{ dx:1,dy:0 },{ dx:0,dy:-1 },{ dx:0,dy:1 }].filter(d =>
          this.maze[row + d.dy]?.[col + d.dx] === PATH &&
          !(d.dx === -ghost.dir.dx && d.dy === -ghost.dir.dy)
        )
        // Allow reversing if no other option
        const pool = opts.length ? opts
          : [{ dx:-1,dy:0 },{ dx:1,dy:0 },{ dx:0,dy:-1 },{ dx:0,dy:1 }].filter(d =>
              this.maze[row + d.dy]?.[col + d.dx] === PATH)
        if (pool.length) ghost.dir = pool[Math.floor(Math.random() * pool.length)]
      } else {
        const d = bfsDir(this.maze, col, row, this.pFromCol, this.pFromRow)
        if (d.dx || d.dy) {
          ghost.dir = d
        } else {
          const opts = [{ dx:-1,dy:0 },{ dx:1,dy:0 },{ dx:0,dy:-1 },{ dx:0,dy:1 }].filter(d2 =>
            this.maze[row + d2.dy]?.[col + d2.dx] === PATH)
          if (opts.length) ghost.dir = opts[Math.floor(Math.random() * opts.length)]
        }
      }

      const nc = col + ghost.dir.dx, nr = row + ghost.dir.dy
      if (this.maze[nr]?.[nc] === PATH) {
        ghost.toCol = nc; ghost.toRow = nr
      } else {
        ghost.toCol = col; ghost.toRow = row   // stay put this tick
        ghost.dir   = { dx: 0, dy: 0 }
      }
    }

    // Advance progress
    ghost.progress += speed * delta / 1000

    // Interpolate pixel position
    const from = cc(ghost.fromCol, ghost.fromRow)
    const to   = cc(ghost.toCol,   ghost.toRow)
    const t    = Math.min(ghost.progress, 1.0)
    ghost.x = from.x + (to.x - from.x) * t
    ghost.y = from.y + (to.y - from.y) * t
  }

  resetGhosts() {
    this.ghosts.forEach((g, i) => {
      const cell = this.ghostSpawnCells[i]
      const { x, y } = cc(cell.col, cell.row)
      g.x = x; g.y = y
      g.fromCol = cell.col; g.fromRow = cell.row
      g.toCol   = cell.col; g.toRow   = cell.row
      g.progress  = 1.0
      g.dir       = { dx: 0, dy: 0 }
      g.frightened = false
      g.eaten     = false
      g.respawnT  = 0
    })
  }

  killPlayer() {
    this.lives--
    this.dead      = true
    this.deadTimer = 2000
    this.powerupActive = false
    this.resetGhosts()
    sfxDeath()
    this.refreshHUD()
    const msg = this.lives > 0 ? `${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT` : 'GAME OVER'
    this.overlayText.setText('OINK!')
    this.subText.setText(msg)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  render() {
    const gfx = this.entityGfx
    gfx.clear()

    // Dim overlay when dead or level done
    if (this.dead || this.levelDone) {
      gfx.fillStyle(0x000000, 0.45)
      gfx.fillRect(0, 0, W, H)
    }

    // Ghosts
    for (const g of this.ghosts) {
      if (g.eaten) continue
      const flash = g.frightened && this.powerupTimer < POWERUP_WARN_MS && Math.floor(this.animT / 220) % 2 === 0
      drawGhost(gfx, g.x, g.y, g.color, g.frightened, flash)
    }

    // Invincibility aura
    if (this.powerupActive) {
      const alpha = 0.22 + 0.12 * Math.sin(this.animT / 90)
      gfx.fillStyle(0xFF69B4, alpha)
      gfx.fillCircle(this.px, this.py, CELL * 0.85)
    }

    // Player — blink while dead
    if (!this.dead || Math.floor(this.animT / 180) % 2 === 0) {
      drawPig(gfx, this.px, this.py, this.pFaceDir)
    }
  }
}

// ─── Game-Over Scene ──────────────────────────────────────────────────────────
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene') }

  init(data) {
    this.finalScore = data?.score ?? 0
    this.finalLevel = data?.level ?? 1
  }

  create() {
    const bg = this.add.graphics()
    bg.fillStyle(0x0a0a0f, 1)
    bg.fillRect(0, 0, W, H)

    this.add.text(W / 2, 160, 'GAME OVER', {
      fontSize: '68px', fontFamily: 'Courier New, monospace',
      color: '#FF4444', stroke: '#880000', strokeThickness: 4,
    }).setOrigin(0.5)

    this.add.text(W / 2, 270, `SCORE: ${this.finalScore}`, {
      fontSize: '38px', fontFamily: 'Courier New, monospace', color: '#FFD700',
    }).setOrigin(0.5)

    this.add.text(W / 2, 325, `LEVEL REACHED: ${this.finalLevel}`, {
      fontSize: '24px', fontFamily: 'Courier New, monospace', color: '#e0e0e0',
    }).setOrigin(0.5)

    // Draw a sad pig
    const pigGfx = this.add.graphics()
    drawPig(pigGfx, W / 2, 410, { dx: 0, dy: 1 })

    const restart = this.add.text(W / 2, 480, 'PRESS ENTER TO PLAY AGAIN', {
      fontSize: '22px', fontFamily: 'Courier New, monospace', color: '#FF69B4',
    }).setOrigin(0.5)
    this.tweens.add({ targets: restart, alpha: 0, duration: 550, yoyo: true, repeat: -1 })

    this.add.text(W / 2, 522, 'ESC — TITLE', {
      fontSize: '16px', fontFamily: 'Courier New, monospace', color: '#555',
    }).setOrigin(0.5)

    // Back link
    this.add.text(14, H - 12, '← BACK', {
      fontSize: '13px', fontFamily: 'Courier New, monospace', color: '#555',
    }).setOrigin(0, 1).setInteractive().on('pointerdown', () => { window.location.href = '/' })

    const play = () => {
      try { audio().resume() } catch (_) {}
      this.scene.start('GameScene', { level: 1, score: 0, lives: INITIAL_LIVES })
    }
    this.input.keyboard.on('keydown-ENTER', play)
    this.input.keyboard.on('keydown-SPACE', play)
    this.input.keyboard.on('keydown-ESC',   () => this.scene.start('TitleScene'))
    this.input.on('pointerdown', play)
  }
}

// ─── Phaser config ────────────────────────────────────────────────────────────
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#0a0a0f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene, GameScene, GameOverScene],
})
