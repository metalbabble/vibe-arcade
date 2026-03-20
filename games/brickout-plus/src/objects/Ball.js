import Phaser from 'phaser';
import GAME_CONFIG from '../config.js';

function ensureBallTexture(scene) {
  if (scene.textures.exists('ball')) return;
  const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
  gfx.fillStyle(0xffffff);
  gfx.fillCircle(GAME_CONFIG.BALL_RADIUS, GAME_CONFIG.BALL_RADIUS, GAME_CONFIG.BALL_RADIUS);
  gfx.generateTexture('ball', GAME_CONFIG.BALL_RADIUS * 2, GAME_CONFIG.BALL_RADIUS * 2);
  gfx.destroy();
}

export default class Ball extends Phaser.Physics.Arcade.Image {
  constructor(scene, startX = GAME_CONFIG.CANVAS_WIDTH / 2, startY = GAME_CONFIG.CANVAS_HEIGHT / 2) {
    ensureBallTexture(scene);

    super(scene, startX, startY, 'ball');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCircle(GAME_CONFIG.BALL_RADIUS);
    this.setBounce(1);
    this.body.setCollideWorldBounds(true);
    this.body.onWorldBounds = true;
    scene.physics.world.setBoundsCollision(true, true, true, false);

    this._startX = startX;
    this._startY = startY;
    this._launched = false;

    // Power-up state
    this.isPowerball = false;
    this.stickyAttached = false;
    this.stickyOffsetX = 0;
  }

  launch(speed, angleDeg = null) {
    // angleDeg: null = random upward angle, or explicit degrees (0 = up)
    const deg = angleDeg ?? Phaser.Math.Between(30, 150);
    const rad = Phaser.Math.DegToRad(deg);
    const vx = Math.cos(rad) * speed;
    const vy = -Math.abs(Math.sin(rad) * speed);
    this.setVelocity(vx, vy);
    this._launched = true;
    this.stickyAttached = false;
  }

  attachToPaddle(paddle) {
    this.setVelocity(0, 0);
    this.stickyAttached = true;
    this.stickyOffsetX = this.x - paddle.x;
  }

  releaseFromPaddle(speed) {
    this.stickyAttached = false;
    this.launch(speed);
  }

  trackPaddle(paddle) {
    if (!this.stickyAttached) return;
    const r = GAME_CONFIG.BALL_RADIUS;
    const ph = GAME_CONFIG.PADDLE_HEIGHT;
    this.setPosition(paddle.x + this.stickyOffsetX, paddle.y - ph / 2 - r);
    this.body.reset(this.x, this.y);
  }

  reset() {
    this.setPosition(this._startX, this._startY);
    this.setVelocity(0, 0);
    this._launched = false;
    this.stickyAttached = false;
    this.isPowerball = false;
    this.clearTint();
  }

  setPowerball(active) {
    this.isPowerball = active;
    if (active) {
      this.setTint(0xff6600);
    } else {
      this.clearTint();
    }
  }

  isLaunched() {
    return this._launched;
  }

  isOffBottom() {
    return this.y > GAME_CONFIG.CANVAS_HEIGHT + GAME_CONFIG.BALL_RADIUS;
  }

  reflectOffPaddle(paddle) {
    const hitPos = (this.x - paddle.x) / (paddle.currentWidth / 2);
    const angle = Phaser.Math.Clamp(hitPos, -1, 1) * 60;
    const speed = Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.y ** 2);
    const rad = Phaser.Math.DegToRad(angle);
    this.setVelocity(Math.sin(rad) * speed, -Math.abs(Math.cos(rad) * speed));
  }
}
