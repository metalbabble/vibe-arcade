import './style.css'
import Phaser from 'phaser'
import '../../../shared/touch-controller.js'

const PADDLE_SPEED = 560
const STARTING_BALL_SPEED = 380
const LEVEL_SPEED_INCREASE = 32
const STARTING_LIVES = 3

class BreakoutScene extends Phaser.Scene {
  constructor() {
    super('BreakoutScene')
    this.score = 0
    this.level = 1
    this.lives = STARTING_LIVES
    this.ballSpeed = STARTING_BALL_SPEED
    this.isGameOver = false
    this.isLevelTransition = false
  }

  preload() {
    const graphics = this.add.graphics()

    graphics.fillStyle(0xffffff, 1)
    graphics.fillRoundedRect(0, 0, 72, 24, 6)
    graphics.generateTexture('brick', 72, 24)
    graphics.clear()

    graphics.fillStyle(0xffffff, 1)
    graphics.fillRoundedRect(0, 0, 124, 18, 8)
    graphics.generateTexture('paddle', 124, 18)
    graphics.clear()

    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(10, 10, 10)
    graphics.generateTexture('ball', 20, 20)
    graphics.destroy()
  }

  create() {
    const { width, height } = this.scale

    this.cameras.main.setBackgroundColor(0x111827)

    this.score = 0
    this.level = 1
    this.lives = STARTING_LIVES
    this.ballSpeed = STARTING_BALL_SPEED
    this.isGameOver = false
    this.isLevelTransition = false

    this.scoreText = this.add.text(18, 14, 'Score: 0', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#f9fafb',
    })

    this.levelText = this.add.text(width / 2, 14, `Level: ${this.level}`, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#f9fafb',
    })
    this.levelText.setOrigin(0.5, 0)

    this.livesText = this.add.text(width - 18, 14, `Lives: ${this.lives}`, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#f9fafb',
    })
    this.livesText.setOrigin(1, 0)

    this.bricks = this.physics.add.staticGroup()
    this.createBricks()

    this.paddle = this.physics.add.image(width / 2, height - 36, 'paddle')
    this.paddle.setImmovable(true)
    this.paddle.body.allowGravity = false
    this.paddle.setCollideWorldBounds(true)

    this.ball = this.physics.add.image(width / 2, height / 2, 'ball')
    this.ball.setCollideWorldBounds(true)
    this.ball.setBounce(1, 1)
    this.ball.body.allowGravity = false
    this.ball.body.onWorldBounds = true

    this.initAudio()

    this.physics.world.setBoundsCollision(true, true, true, false)
    this.physics.world.on('worldbounds', this.handleWorldBounds, this)

    this.physics.add.collider(this.ball, this.paddle, this.handlePaddleCollision, null, this)
    this.physics.add.collider(this.ball, this.bricks, this.handleBrickCollision, null, this)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    this.debugLevelKeyHandler = (event) => {
      if (event.key === '!' || (event.shiftKey && event.code === 'Digit1')) {
        this.debugClearBricks()
      }
    }
    this.input.keyboard.on('keydown', this.debugLevelKeyHandler)

    this.resetBall({ launch: false })
    this.showLevelOverlay(() => {
      this.launchBall()
    })
  }

  initAudio() {
    this.audioCtx = this.sound.context

    // Browser autoplay rules may suspend audio until first user interaction.
    const resumeAudio = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume()
      }
    }

    this.input.keyboard?.once('keydown', resumeAudio)
    this.input.once('pointerdown', resumeAudio)
  }

  playTone({
    frequency,
    duration = 0.08,
    volume = 0.05,
    type = 'sine',
    targetFrequency = null,
  }) {
    if (!this.audioCtx || this.audioCtx.state !== 'running') {
      return
    }

    const now = this.audioCtx.currentTime
    const osc = this.audioCtx.createOscillator()
    const gain = this.audioCtx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(frequency, now)
    if (targetFrequency !== null) {
      osc.frequency.exponentialRampToValueAtTime(targetFrequency, now + duration)
    }

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    osc.connect(gain)
    gain.connect(this.audioCtx.destination)
    osc.start(now)
    osc.stop(now + duration)
  }

  playCollisionBeep() {
    this.playTone({ frequency: 620, duration: 0.06, volume: 0.03, type: 'square' })
  }

  playBrickPop() {
    this.playTone({
      frequency: 980,
      targetFrequency: 680,
      duration: 0.075,
      volume: 0.045,
      type: 'triangle',
    })
  }

  playMissSad() {
    this.playTone({ frequency: 260, targetFrequency: 190, duration: 0.14, volume: 0.05, type: 'sawtooth' })
    this.time.delayedCall(120, () => {
      this.playTone({ frequency: 180, targetFrequency: 130, duration: 0.17, volume: 0.05, type: 'sawtooth' })
    })
  }

  createBricks() {
    const { width, height } = this.scale
    const topPadding = 56
    const sidePadding = 28
    const gapX = 8
    const gapY = 8
    const brickWidth = 72
    const brickHeight = 24
    const playableHeight = Math.max(height / 3 - topPadding, brickHeight * 3)

    const columns = Math.max(5, Math.floor((width - sidePadding * 2 + gapX) / (brickWidth + gapX)))
    const rows = Math.max(3, Math.floor((playableHeight + gapY) / (brickHeight + gapY)))
    const usedWidth = columns * brickWidth + (columns - 1) * gapX
    const startX = (width - usedWidth) / 2 + brickWidth / 2

    this.bricks.clear(true, true)
    this.remainingBricks = rows * columns

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const x = startX + col * (brickWidth + gapX)
        const y = topPadding + row * (brickHeight + gapY) + brickHeight / 2
        const brick = this.bricks.create(x, y, 'brick')
        brick.setTint(Phaser.Display.Color.RandomRGB().color)
      }
    }
  }

  resetBall({ launch = true } = {}) {
    const { width, height } = this.scale
    this.ball.setPosition(width / 2, height / 2)

    if (!launch) {
      this.ball.setVelocity(0, 0)
      return
    }

    this.launchBall()
  }

  launchBall() {
    if (this.isGameOver) {
      return
    }

    const angle = Phaser.Math.FloatBetween(30, 150)
    const vec = this.physics.velocityFromAngle(angle, this.ballSpeed)
    this.ball.setVelocity(vec.x, vec.y)
  }

  handlePaddleCollision(ball, paddle) {
    const diff = ball.x - paddle.x
    const normalized = Phaser.Math.Clamp(diff / (paddle.displayWidth / 2), -1, 1)
    const bounceAngle = Phaser.Math.Linear(-150, -30, (normalized + 1) / 2)
    const vec = this.physics.velocityFromAngle(bounceAngle, this.ballSpeed)
    ball.setVelocity(vec.x, vec.y)
    this.playCollisionBeep()
  }

  handleWorldBounds(body, up, down, left, right) {
    if (body.gameObject !== this.ball || this.isGameOver) {
      return
    }

    if (up || left || right) {
      this.playCollisionBeep()
    }
  }

  handleBrickCollision(ball, brick) {
    brick.disableBody(true, true)
    this.playBrickPop()
    this.remainingBricks -= 1
    this.score += 1
    this.scoreText.setText(`Score: ${this.score}`)

    if (this.remainingBricks <= 0) {
      this.startNextLevel()
    }
  }

  debugClearBricks() {
    if (this.isGameOver || this.remainingBricks <= 0) {
      return
    }

    this.bricks.children.each((brick) => {
      if (brick.active) {
        brick.disableBody(true, true)
      }
    })
    this.remainingBricks = 0
    this.startNextLevel()
  }

  showLevelOverlay(onComplete = null) {
    this.isLevelTransition = true
    const { width, height } = this.scale
    const overlay = this.add.text(width / 2, height / 2 - 12, `LEVEL ${this.level}`, {
      fontFamily: 'monospace',
      fontSize: '52px',
      color: '#dbeafe',
      stroke: '#0f172a',
      strokeThickness: 8,
    })
    overlay.setOrigin(0.5)
    overlay.setAlpha(0)
    overlay.setScale(0.9)

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      scale: 1,
      y: height / 2,
      duration: 220,
      ease: 'Cubic.Out',
      yoyo: true,
      hold: 340,
      onComplete: () => {
        overlay.destroy()
        this.isLevelTransition = false
        if (onComplete) {
          onComplete()
        }
      },
    })
  }

  startNextLevel() {
    this.level += 1
    this.ballSpeed += LEVEL_SPEED_INCREASE
    this.levelText.setText(`Level: ${this.level}`)

    // Start each level from a predictable state while preserving score/lives.
    this.paddle.setPosition(this.scale.width / 2, this.scale.height - 36)
    this.paddle.setVelocityX(0)
    this.createBricks()
    this.resetBall({ launch: false })
    this.showLevelOverlay(() => {
      this.launchBall()
    })
  }

  handleLifeLost() {
    this.playMissSad()
    this.lives -= 1
    this.livesText.setText(`Lives: ${this.lives}`)

    if (this.lives <= 0) {
      this.endGame()
      return
    }

    this.resetBall()
  }

  endGame() {
    this.isGameOver = true
    this.ball.setVelocity(0, 0)
    this.ball.setActive(false)
    this.ball.setVisible(false)

    const { width, height } = this.scale
    this.add.text(width / 2, height / 2, `GAME OVER\nFinal Score: ${this.score}`, {
      fontFamily: 'monospace',
      fontSize: '44px',
      color: '#fef2f2',
      align: 'center',
    }).setOrigin(0.5)

    this.add.text(width / 2, height / 2 + 88, 'Press ENTER to play again!', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#bfdbfe',
    }).setOrigin(0.5)
  }

  shutdown() {
    this.physics.world.off('worldbounds', this.handleWorldBounds, this)
    this.input.keyboard.off('keydown', this.debugLevelKeyHandler)
  }

  update() {
    if (this.isGameOver) {
      this.paddle.setVelocityX(0)

      if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
        this.scene.restart()
      }

      return
    }

    this.paddle.setVelocityX(0)

    if (this.cursors.left.isDown) {
      this.paddle.setVelocityX(-PADDLE_SPEED)
    } else if (this.cursors.right.isDown) {
      this.paddle.setVelocityX(PADDLE_SPEED)
    }

    if (!this.isLevelTransition && this.ball.y > this.scale.height + this.ball.displayHeight) {
      this.handleLifeLost()
    }
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 900,
  height: 600,
  backgroundColor: '#111827',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BreakoutScene],
}

new Phaser.Game(config)
