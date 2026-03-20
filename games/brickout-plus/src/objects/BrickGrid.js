import Phaser from 'phaser';
import GAME_CONFIG from '../config.js';

const BRICK_TEXTURE_KEY = 'brick';

function createBrickTexture(scene) {
  if (scene.textures.exists(BRICK_TEXTURE_KEY)) return;
  const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
  gfx.fillStyle(0xffffff);
  gfx.fillRoundedRect(0, 0, GAME_CONFIG.BRICK_WIDTH, GAME_CONFIG.BRICK_HEIGHT, 4);
  gfx.generateTexture(BRICK_TEXTURE_KEY, GAME_CONFIG.BRICK_WIDTH, GAME_CONFIG.BRICK_HEIGHT);
  gfx.destroy();
}

function randomColor() {
  return Phaser.Utils.Array.GetRandom(GAME_CONFIG.BRICK_COLORS);
}

export default class BrickGrid {
  constructor(scene) {
    createBrickTexture(scene);
    this._scene = scene;
    this._group = scene.physics.add.staticGroup();
    this._build();
  }

  _build() {
    const { BRICK_COLS, BRICK_ROWS, BRICK_WIDTH, BRICK_HEIGHT, BRICK_PADDING, BRICK_TOP_OFFSET, CANVAS_WIDTH } = GAME_CONFIG;
    const totalWidth = BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING;
    const startX = (CANVAS_WIDTH - totalWidth) / 2 + BRICK_WIDTH / 2;

    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        const x = startX + col * (BRICK_WIDTH + BRICK_PADDING);
        const y = BRICK_TOP_OFFSET + row * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_HEIGHT / 2;
        const brick = this._group.create(x, y, BRICK_TEXTURE_KEY);
        brick.setTint(randomColor());
        brick.refreshBody();
      }
    }
  }

  getGroup() {
    return this._group;
  }

  destroyBrick(brick) {
    brick.disableBody(true, true);
  }

  isEmpty() {
    return this._group.countActive() === 0;
  }

  reset() {
    this._group.children.iterate((brick) => {
      brick.enableBody(false, brick.x, brick.y, true, true);
      brick.setTint(randomColor());
      brick.refreshBody();
    });
  }
}
