import Phaser from 'phaser';
import GAME_CONFIG from '../config.js';

const TOKEN_W = 52;
const TOKEN_H = 20;

function buildTextures(scene) {
  Object.entries(GAME_CONFIG.POWERUP_META).forEach(([type, meta]) => {
    const key = `pu_${type}`;
    if (scene.textures.exists(key)) return;
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(meta.color);
    gfx.fillRoundedRect(0, 0, TOKEN_W, TOKEN_H, 5);
    gfx.generateTexture(key, TOKEN_W, TOKEN_H);
    gfx.destroy();
  });
}

export default class PowerUpManager {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    this._scene = scene;
    buildTextures(scene);

    // Each token: { sprite, label, type }
    this._tokens = [];

    this._physicsGroup = scene.physics.add.group();
  }

  /** Called when a brick is destroyed. Randomly spawns a token at (x, y). */
  trySpawn(x, y) {
    if (Math.random() > GAME_CONFIG.POWERUP_SPAWN_CHANCE) return;

    const type = Phaser.Utils.Array.GetRandom(GAME_CONFIG.POWERUP_TYPES);
    const meta = GAME_CONFIG.POWERUP_META[type];

    const sprite = this._scene.physics.add.image(x, y, `pu_${type}`);
    sprite.setDepth(8);
    sprite.powerUpType = type;

    const label = this._scene.add.text(x, y, meta.label, {
      fontFamily: 'monospace',
      fontSize: '11px',
      fill: '#ffffff',
    }).setOrigin(0.5).setDepth(9);

    this._physicsGroup.add(sprite);
    sprite.body.setAllowGravity(false);
    sprite.setVelocityY(GAME_CONFIG.POWERUP_FALL_SPEED);
    this._tokens.push({ sprite, label, type });
  }

  /** Returns the Phaser group for setting up overlap with paddle. */
  getGroup() {
    return this._physicsGroup;
  }

  update() {
    for (let i = this._tokens.length - 1; i >= 0; i--) {
      const { sprite, label } = this._tokens[i];
      if (!sprite.active) {
        label.destroy();
        this._tokens.splice(i, 1);
        continue;
      }
      if (sprite.y > GAME_CONFIG.CANVAS_HEIGHT + TOKEN_H) {
        this._destroyToken(i);
        continue;
      }
      label.setPosition(sprite.x, sprite.y);
    }
  }

  /** Called by GameScene when paddle catches a token. Returns the type string. */
  collect(sprite) {
    const type = sprite.powerUpType;
    const idx = this._tokens.findIndex(t => t.sprite === sprite);
    if (idx !== -1) this._destroyToken(idx);
    return type;
  }

  clearAll() {
    for (let i = this._tokens.length - 1; i >= 0; i--) {
      this._destroyToken(i);
    }
  }

  _destroyToken(idx) {
    const { sprite, label } = this._tokens[idx];
    label.destroy();
    sprite.destroy();
    this._tokens.splice(idx, 1);
  }
}
