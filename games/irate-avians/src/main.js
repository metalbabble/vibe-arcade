import './style.css'
import Phaser from 'phaser'

// ── Constants ────────────────────────────────────────────────────────────────
const W = 800
const H = 500
const GND_Y = H - 55          // y of ground surface
const SLING_X = 90            // pushed far left for breathing room
const SLING_Y = GND_Y - 68
const SLING_GRAB_R = 60       // pointer proximity to grab the bird
const MAX_PULL = 90           // max slingshot stretch in pixels
const BIRD_R = 14             // smaller bird
const CRATE_W = 44
const CRATE_H = 44
const BAG_W = 30
const BAG_H = 32
const BAG_R = 12              // physics circle radius for the money bag
const LAUNCH_POWER = 0.16     // slightly more power to reach the further stacks
const GRAVITY_Y = 0.5         // must match matter gravity config
const BAG_SCORE_SPEED = 1.0   // bag speed threshold that awards 100 pts

// Persistent state across scene restarts
const gs = { score: 0, level: 1 }

// ── Scene ────────────────────────────────────────────────────────────────────
class AvianScene extends Phaser.Scene {
  constructor() {
    super('AvianScene')
  }

  // ── Asset generation ──────────────────────────────────────────────────────
  preload() {
    const g = this.add.graphics()

    // Bird — angry red circle with face
    const BD = BIRD_R * 2
    g.fillStyle(0xcc2200)
    g.fillCircle(BIRD_R, BIRD_R, BIRD_R)
    // Head tuft
    g.fillStyle(0x991100)
    g.fillTriangle(BIRD_R - 4, 1, BIRD_R, 8, BIRD_R + 5, 1)
    // Eyes (whites)
    g.fillStyle(0xffffff)
    g.fillCircle(BIRD_R - 6, BIRD_R - 5, 6)
    g.fillCircle(BIRD_R + 2, BIRD_R - 5, 6)
    // Pupils
    g.fillStyle(0x000000)
    g.fillCircle(BIRD_R - 5, BIRD_R - 4, 3)
    g.fillCircle(BIRD_R + 3, BIRD_R - 4, 3)
    // Angry brows
    g.lineStyle(2, 0x330000)
    g.lineBetween(BIRD_R - 11, BIRD_R - 9, BIRD_R - 2, BIRD_R - 12)
    g.lineBetween(BIRD_R + 9, BIRD_R - 9, BIRD_R + 0, BIRD_R - 12)
    // Beak
    g.fillStyle(0xffaa00)
    g.fillTriangle(BIRD_R - 5, BIRD_R + 2, BIRD_R + 4, BIRD_R + 2, BIRD_R, BIRD_R + 10)
    g.generateTexture('bird', BD, BD)
    g.clear()

    // Crate — wooden box with cross braces
    g.fillStyle(0xd49550)
    g.fillRect(0, 0, CRATE_W, CRATE_H)
    g.lineStyle(3, 0x8b5a20)
    g.strokeRect(3, 3, CRATE_W - 6, CRATE_H - 6)
    g.lineStyle(2, 0x8b5a20)
    g.lineBetween(3, 3, CRATE_W - 3, CRATE_H - 3)
    g.lineBetween(CRATE_W - 3, 3, 3, CRATE_H - 3)
    g.generateTexture('crate', CRATE_W, CRATE_H)
    g.clear()

    // Money bag — green sack
    g.fillStyle(0x27ae60)
    g.fillEllipse(BAG_W / 2, BAG_H / 2 + 4, BAG_W - 4, BAG_H - 8)
    g.fillStyle(0x1e8449)
    g.fillRect(BAG_W / 2 - 6, 2, 12, 11)  // neck
    g.fillStyle(0xf1c40f)
    g.fillCircle(BAG_W / 2, BAG_H / 2 + 5, 9)
    g.fillStyle(0x27ae60)
    g.fillCircle(BAG_W / 2, BAG_H / 2 + 5, 7)
    g.generateTexture('moneybag', BAG_W, BAG_H)
    g.clear()

    // Ground strip
    g.fillStyle(0x4a8c3a)
    g.fillRect(0, 0, W, 55)
    g.fillStyle(0x3a7c2a)
    g.fillRect(0, 0, W, 7)
    g.generateTexture('ground', W, 55)
    g.clear()

    // Sky gradient
    g.fillGradientStyle(0x4a9fd4, 0x4a9fd4, 0xa8d8ea, 0xa8d8ea)
    g.fillRect(0, 0, W, H)
    g.generateTexture('sky', W, H)
    g.clear()

    // Hill silhouette
    g.fillStyle(0x3d8c28)
    g.fillEllipse(130, 60, 280, 130)
    g.generateTexture('hill', 280, 130)
    g.clear()

    g.destroy()
  }

  // ── Scene creation ────────────────────────────────────────────────────────
  create() {
    // Background layers
    this.add.image(W / 2, H / 2, 'sky').setDisplaySize(W, H)
    this.add.image(200, GND_Y + 10, 'hill').setAlpha(0.55)
    this.add.image(W - 80, GND_Y + 10, 'hill').setAlpha(0.4).setFlipX(true)

    // Static ground body
    this.matter.add.image(W / 2, GND_Y + 27, 'ground', null, {
      isStatic: true,
      label: 'ground',
      friction: 0.9,
      frictionStatic: 1,
    }).setDisplaySize(W, 55)

    // Right wall — keeps crates from flying offscreen right
    this.matter.add.rectangle(W + 30, H / 2, 60, H, { isStatic: true, label: 'wall' })

    // Graphics layers
    this.gfxSling = this.add.graphics().setDepth(2)
    this.gfxTraj  = this.add.graphics().setDepth(1)

    // UI text
    this.txtScore = this.add.text(W - 12, 10, `Score: ${gs.score}`, {
      fontSize: '20px', color: '#ffffff', fontFamily: 'Arial Black',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(1, 0).setDepth(30)

    this.txtLevel = this.add.text(W / 2, 10, `Level ${gs.level}`, {
      fontSize: '22px', color: '#ffe066', fontFamily: 'Arial Black',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(30)

    this.txtBirds = this.add.text(12, 10, 'Birds: 0', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'Arial Black',
      stroke: '#000', strokeThickness: 4,
    }).setDepth(30)

    this.txtHint = this.add.text(W / 2, H - 16, 'Drag the bird to aim, release to fire!', {
      fontSize: '13px', color: '#ffffffaa', fontFamily: 'Arial',
    }).setOrigin(0.5, 1).setDepth(30)

    // Game state
    this.moneyBags    = []   // MatterImage[] — each has .bagId (index)
    this.bagDollars   = []   // Text[] — $ labels that follow the bags
    this.crates       = []
    this.bagScored    = new Set()
    this.levelCleared = false
    this.birdLaunched = false
    this.isDragging   = false
    this.pullPt       = null
    this.currentBird  = null
    this.birdsLeft    = 0
    this.bagTracking  = false
    this.nextBirdPending = false
    this.fallbackTimer   = null

    // Pointer events work for both mouse and touch
    this.input.on('pointerdown', this.onDown, this)
    this.input.on('pointermove', this.onMove, this)
    this.input.on('pointerup',   this.onUp,   this)

    this.buildLevel()
    this.spawnBird()
  }

  // ── Level generation ──────────────────────────────────────────────────────
  buildLevel() {
    const numStacks = Math.min(2 + gs.level, 7)
    const xMin = 400
    const xMax = W - 90
    const span = xMax - xMin

    for (let s = 0; s < numStacks; s++) {
      const t  = numStacks > 1 ? s / (numStacks - 1) : 0.5
      const cx = xMin + t * span + Phaser.Math.Between(-18, 18)
      const numCrates = Phaser.Math.Between(1, Math.min(3, Math.ceil(gs.level / 2) + 1))

      // Stack crates from the ground up
      for (let c = 0; c < numCrates; c++) {
        const cy = GND_Y - CRATE_H / 2 - c * CRATE_H
        const crate = this.matter.add.image(cx, cy, 'crate', null, {
          label: 'crate',
          density: 0.0015,   // lighter → topples on lighter hits
          friction: 0.4,
          frictionStatic: 0.3,  // low static friction → tips and slides easily
          restitution: 0.15,
        })
        this.crates.push(crate)
      }

      // Money bag balanced on top of the stack
      const bagY = GND_Y - numCrates * CRATE_H - BAG_H / 2 - 1
      const bag  = this.matter.add.image(cx, bagY, 'moneybag', null, {
        label: 'moneybag',
        density: 0.0008,   // very light → bounces off easily
        friction: 0.2,
        restitution: 0.45,
        shape: { type: 'circle', radius: BAG_R },
      })
      bag.bagId = s
      bag.setDepth(5)
      this.moneyBags.push(bag)

      // Dollar sign that rides along with the bag
      const lbl = this.add.text(cx, bagY, '$', {
        fontSize: '16px', color: '#ffff33', fontFamily: 'Arial Black',
        stroke: '#004400', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(6)
      this.bagDollars.push(lbl)
    }

    this.birdsLeft = 4 + gs.level   // level 1 = 5 birds, grows with level
    this.updateUI()

    // Let physics settle before we start watching bag velocities
    this.time.delayedCall(1000, () => { this.bagTracking = true })
  }

  // ── Bird management ───────────────────────────────────────────────────────
  spawnBird() {
    if (this.currentBird) {
      try { this.currentBird.destroy() } catch (_) {}
    }
    this.currentBird     = null
    this.birdLaunched    = false
    this.isDragging      = false
    this.pullPt          = null
    this.nextBirdPending = false

    // Brief pause on bag tracking so settling doesn't score bags
    this.bagTracking = false
    this.time.delayedCall(600, () => { this.bagTracking = true })

    if (this.birdsLeft <= 0) {
      this.time.delayedCall(2200, () => {
        if (!this.levelCleared) this.showOutOfBirds()
      })
      this.gfxSling.clear()
      return
    }

    const bird = this.matter.add.image(SLING_X, SLING_Y, 'bird', null, {
      isStatic: true,
      label: 'bird',
      friction: 0.05,
      restitution: 0.5,
    })
    bird.setDepth(10)
    // Circular body; frictionAir:0 so the trajectory simulation matches exactly
    bird.setCircle(BIRD_R, { label: 'bird', friction: 0.05, restitution: 0.5, frictionAir: 0 })
    this.matter.body.setStatic(bird.body, true)

    this.currentBird = bird
    this.birdsLeft--
    this.updateUI()
    this.drawSling()
  }

  // ── Pointer handlers (mouse + touch) ──────────────────────────────────────
  onDown(p) {
    if (this.levelCleared || this.birdLaunched || !this.currentBird || this.nextBirdPending) return
    const dx = p.x - SLING_X
    const dy = p.y - SLING_Y
    if (Math.sqrt(dx * dx + dy * dy) < SLING_GRAB_R) {
      this.isDragging = true
      this.txtHint.setVisible(false)
    }
  }

  onMove(p) {
    if (!this.isDragging || !this.currentBird) return
    let dx = p.x - SLING_X
    let dy = p.y - SLING_Y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d > MAX_PULL) { dx = (dx / d) * MAX_PULL; dy = (dy / d) * MAX_PULL }
    this.pullPt = { x: SLING_X + dx, y: SLING_Y + dy }
    this.matter.body.setPosition(this.currentBird.body, this.pullPt)
    this.drawSling()
    this.drawTrajectory()
  }

  onUp() {
    if (!this.isDragging) return
    this.isDragging = false

    if (!this.pullPt || !this.currentBird) return

    const dx = SLING_X - this.pullPt.x
    const dy = SLING_Y - this.pullPt.y
    const d  = Math.sqrt(dx * dx + dy * dy)

    // Snap back if barely pulled
    if (d < 12) {
      this.matter.body.setPosition(this.currentBird.body, { x: SLING_X, y: SLING_Y })
      this.pullPt = null
      this.drawSling()
      this.gfxTraj.clear()
      return
    }

    // Launch the bird
    this.matter.body.setStatic(this.currentBird.body, false)
    this.matter.body.setVelocity(this.currentBird.body, {
      x: dx * LAUNCH_POWER,
      y: dy * LAUNCH_POWER,
    })
    this.birdLaunched    = true
    this.nextBirdPending = false
    this.pullPt          = null
    this.gfxTraj.clear()
    this.drawSling()

    // Fallback: advance even if the bird never leaves the screen
    this.fallbackTimer = this.time.delayedCall(5000, () => {
      if (!this.levelCleared && !this.nextBirdPending) {
        this.nextBirdPending = true
        this.time.delayedCall(500, () => { if (!this.levelCleared) this.spawnBird() })
      }
    })
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  drawSling() {
    const g  = this.gfxSling
    g.clear()

    const bx  = SLING_X
    const by  = GND_Y
    const jy  = SLING_Y + 12                       // fork junction y
    const tL  = { x: bx - 16, y: SLING_Y - 22 }   // left tine tip
    const tR  = { x: bx + 16, y: SLING_Y - 22 }   // right tine tip

    // Main stick
    g.lineStyle(10, 0x7a4520)
    g.lineBetween(bx, by, bx, jy)
    // Tines
    g.lineBetween(bx, jy, tL.x, tL.y)
    g.lineBetween(bx, jy, tR.x, tR.y)
    // Knobs at tine tips
    g.fillStyle(0x4a2510)
    g.fillCircle(tL.x, tL.y, 5)
    g.fillCircle(tR.x, tR.y, 5)

    // Elastic band
    const bp = this.pullPt ?? { x: bx, y: SLING_Y }
    g.lineStyle(3, 0xc87830)
    g.lineBetween(tL.x, tL.y, bp.x, bp.y)
    g.lineBetween(tR.x, tR.y, bp.x, bp.y)
  }

  drawTrajectory() {
    // Trajectory preview hidden until the simulation can be made reliable
    this.gfxTraj.clear()
  }

  // ── Scoring ───────────────────────────────────────────────────────────────
  awardBag(bag) {
    if (this.bagScored.has(bag.bagId)) return
    this.bagScored.add(bag.bagId)
    gs.score += 100

    // Floating +100 popup
    const pop = this.add.text(bag.x, bag.y - 10, '+100', {
      fontSize: '28px', color: '#ffe066', fontFamily: 'Arial Black',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(40)

    this.tweens.add({
      targets: pop, y: pop.y - 72, alpha: 0, duration: 1100,
      onComplete: () => pop.destroy(),
    })

    // Flash the bag and label out
    const lbl = this.bagDollars[bag.bagId]
    this.tweens.add({
      targets: [bag, lbl].filter(Boolean), alpha: 0, duration: 380,
      onComplete: () => {
        try { bag.destroy() } catch (_) {}
        if (lbl) lbl.destroy()
      },
    })

    this.updateUI()

    if (this.bagScored.size >= this.moneyBags.length) {
      this.levelCleared = true
      this.bagTracking  = false
      this.time.delayedCall(1400, () => this.showLevelClear())
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  updateUI() {
    this.txtScore.setText(`Score: ${gs.score}`)
    this.txtLevel.setText(`Level ${gs.level}`)
    this.txtBirds.setText(`Birds: ${this.birdsLeft}`)
  }

  showLevelClear() {
    this.openDialog(
      `Level ${gs.level} Cleared!`,
      `Score: ${gs.score}`,
      'Next Level',
      () => { gs.level++; this.scene.restart() },
    )
  }

  showOutOfBirds() {
    this.openDialog(
      'Out of Birds!',
      `Final Score: ${gs.score}`,
      'Play Again',
      () => { gs.score = 0; gs.level = 1; this.scene.restart() },
    )
  }

  openDialog(title, sub, btnLabel, cb) {
    const d  = 50
    const ov  = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(d)
    const box = this.add.rectangle(W / 2, H / 2, 420, 190, 0x111122)
      .setStrokeStyle(3, 0x7c3aed).setDepth(d + 1)
    const t1  = this.add.text(W / 2, H / 2 - 45, title, {
      fontSize: '30px', color: '#ffffff', fontFamily: 'Arial Black',
    }).setOrigin(0.5).setDepth(d + 2)
    const t2  = this.add.text(W / 2, H / 2 - 5, sub, {
      fontSize: '18px', color: '#aaaaaa', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(d + 2)
    const btn = this.add.text(W / 2, H / 2 + 48, btnLabel, {
      fontSize: '22px', color: '#7c3aed', fontFamily: 'Arial Black',
      backgroundColor: '#eeeeff', padding: { x: 22, y: 9 },
    }).setOrigin(0.5).setInteractive().setDepth(d + 2)

    btn.on('pointerover', () => btn.setBackgroundColor('#ccccff'))
    btn.on('pointerout',  () => btn.setBackgroundColor('#eeeeff'))
    btn.on('pointerdown', () => {
      [ov, box, t1, t2, btn].forEach(o => o.destroy())
      cb()
    })
  }

  // ── Per-frame logic ───────────────────────────────────────────────────────
  update() {
    // Keep $ labels glued to their rotating/falling bag sprites
    for (let i = 0; i < this.moneyBags.length; i++) {
      if (this.bagScored.has(i)) continue
      const bag = this.moneyBags[i]
      const lbl = this.bagDollars[i]
      if (bag?.active && lbl?.active) {
        lbl.setPosition(bag.x, bag.y)
        lbl.setRotation(bag.rotation)
      }
    }

    // Score any bag that is moving fast enough (hit by bird, crate, or falling)
    if (this.bagTracking) {
      for (const bag of this.moneyBags) {
        if (this.bagScored.has(bag.bagId) || !bag.active) continue
        const v = bag.body.velocity
        if (Math.sqrt(v.x * v.x + v.y * v.y) > BAG_SCORE_SPEED) {
          this.awardBag(bag)
        }
      }
    }

    // Advance to next bird when the launched bird leaves the screen or comes to rest
    if (this.birdLaunched && !this.nextBirdPending && this.currentBird?.active) {
      const b = this.currentBird
      const offScreen = b.x < -80 || b.x > W + 160 || b.y > H + 80

      // Also detect bird at rest on the ground
      const bv    = b.body.velocity
      const speed = Math.sqrt(bv.x * bv.x + bv.y * bv.y)
      const atRest = b.y > GND_Y - BIRD_R * 2 && speed < 0.3

      if (offScreen || atRest) {
        this.nextBirdPending = true
        if (this.fallbackTimer) { this.fallbackTimer.destroy(); this.fallbackTimer = null }
        this.time.delayedCall(offScreen ? 700 : 1200, () => {
          if (!this.levelCleared) this.spawnBird()
        })
      }
    }
  }
}

// ── Phaser bootstrap ──────────────────────────────────────────────────────────
new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: GRAVITY_Y },
      debug: false,
    },
  },
  scene: [AvianScene],
  parent: 'app',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})
