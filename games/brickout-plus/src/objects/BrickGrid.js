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
  constructor(scene, mode = 'classic') {
    createBrickTexture(scene);
    this._scene = scene;
    this._mode = mode;
    this._group = scene.physics.add.staticGroup();
    this._buildLevel();
  }

  _buildLevel() {
    if (this._mode === 'random') {
      this._buildRandom();
    } else {
      this._buildClassic();
    }
  }

  _buildClassic() {
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

  _buildRandom() {
    const { BRICK_COLS, BRICK_WIDTH, BRICK_HEIGHT, BRICK_PADDING, BRICK_TOP_OFFSET, CANVAS_WIDTH } = GAME_CONFIG;
    const RANDOM_ROWS = 7;
    const totalWidth = BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING;
    const startX = (CANVAS_WIDTH - totalWidth) / 2 + BRICK_WIDTH / 2;
    const halfCols = Math.floor(BRICK_COLS / 2);

    // Generate a symmetrical mask, retry until enough bricks
    let mask;
    do {
      mask = this._generateMask(RANDOM_ROWS, halfCols, BRICK_COLS);
    } while (this._countMaskBricks(mask, RANDOM_ROWS, BRICK_COLS, halfCols) < Math.floor(RANDOM_ROWS * BRICK_COLS * 0.3));

    for (let row = 0; row < RANDOM_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        // Mirror: right half reflects the left half
        const layoutCol = col < halfCols ? col : (BRICK_COLS - 1 - col);
        if (!mask[row][layoutCol]) continue;

        const x = startX + col * (BRICK_WIDTH + BRICK_PADDING);
        const y = BRICK_TOP_OFFSET + row * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_HEIGHT / 2;
        const brick = this._group.create(x, y, BRICK_TEXTURE_KEY);
        brick.setTint(randomColor());
        brick.refreshBody();
      }
    }
  }

  // Generates a left-half boolean mask using one of several symmetrical patterns
  _generateMask(rows, halfCols, totalCols) {
    const mask = [];
    const style = Math.floor(Math.random() * 4);

    for (let row = 0; row < rows; row++) {
      mask[row] = [];
      for (let col = 0; col < halfCols; col++) {
        let include;

        if (style === 0) {
          // Row-based density: each row gets a random fill level
          const rowDensity = 0.4 + Math.random() * 0.55;
          include = Math.random() < rowDensity;

        } else if (style === 1) {
          // Arch: columns closer to the center are more likely to be filled
          const centerBias = col / (halfCols - 1); // 0=outer edge, 1=center
          const rowFade = 1 - (row / rows) * 0.4;
          include = Math.random() < (0.25 + centerBias * 0.7) * rowFade;

        } else if (style === 2) {
          // Staircase: each row has a width cutoff that steps inward or outward
          const step = Math.floor(Math.random() * halfCols);
          const ascending = Math.random() < 0.5;
          const cutoff = ascending ? row * (halfCols / rows) : halfCols - row * (halfCols / rows);
          include = col < cutoff + step;

        } else {
          // Checkerboard weave: alternating density by row parity
          const evenRow = row % 2 === 0;
          const density = evenRow ? 0.75 + Math.random() * 0.25 : 0.2 + Math.random() * 0.35;
          include = Math.random() < density;
        }

        mask[row][col] = include;
      }
    }

    return mask;
  }

  _countMaskBricks(mask, rows, cols, halfCols) {
    let count = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const layoutCol = col < halfCols ? col : (cols - 1 - col);
        if (mask[row][layoutCol]) count++;
      }
    }
    return count;
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
    if (this._mode === 'random') {
      this._group.clear(true, true);
      this._buildRandom();
    } else {
      this._group.children.iterate((brick) => {
        brick.enableBody(false, brick.x, brick.y, true, true);
        brick.setTint(randomColor());
        brick.refreshBody();
      });
    }
  }
}
