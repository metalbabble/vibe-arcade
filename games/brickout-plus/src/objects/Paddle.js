import Phaser from 'phaser';
import GAME_CONFIG from '../config.js';

function ensurePaddleTexture(scene) {
  if (scene.textures.exists('paddle')) return;
  const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
  gfx.fillStyle(0xffffff);
  gfx.fillRoundedRect(0, 0, GAME_CONFIG.PADDLE_WIDTH, GAME_CONFIG.PADDLE_HEIGHT, 6);
  gfx.generateTexture('paddle', GAME_CONFIG.PADDLE_WIDTH, GAME_CONFIG.PADDLE_HEIGHT);
  gfx.destroy();
}

export default class Paddle extends Phaser.Physics.Arcade.Image {
  constructor(scene) {
    ensurePaddleTexture(scene);

    const x = GAME_CONFIG.CANVAS_WIDTH / 2;
    const y = GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.PADDLE_Y_OFFSET;

    super(scene, x, y, 'paddle');

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    this._cursors = scene.input.keyboard.createCursorKeys();
    this.currentWidth = GAME_CONFIG.PADDLE_WIDTH;
  }

  update(deltaMs, touchLeft = false, touchRight = false) {
    const dt = deltaMs / 1000;
    const speed = GAME_CONFIG.PADDLE_SPEED;
    const half = this.currentWidth / 2;
    const minX = half;
    const maxX = GAME_CONFIG.CANVAS_WIDTH - half;

    if (this._cursors.left.isDown || touchLeft) {
      this.x = Math.max(minX, this.x - speed * dt);
    } else if (this._cursors.right.isDown || touchRight) {
      this.x = Math.min(maxX, this.x + speed * dt);
    }

    this.body.reset(this.x, this.y);
  }

  setWidth(w) {
    this.currentWidth = w;
    this.setDisplaySize(w, GAME_CONFIG.PADDLE_HEIGHT);
    this.body.setSize(w, GAME_CONFIG.PADDLE_HEIGHT);
    this.body.reset(this.x, this.y);
  }

  resetWidth() {
    this.setWidth(GAME_CONFIG.PADDLE_WIDTH);
    this.clearTint();
  }

  activateLongPaddle() {
    this.setWidth(GAME_CONFIG.PADDLE_LONG_WIDTH);
    this.setTint(0x3498db);
  }
}
