class WallGenerator {
  /**
   * Generates a symmetric (left-right mirrored) wall layout.
   * @param {number} cols  - grid columns
   * @param {number} rows  - grid rows
   * @param {Array}  clear - [{col, row, w, h}] rectangles always kept clear
   * @returns {boolean[][]} 2D grid where true = wall
   */
  static generate(cols, rows, clear) {
    const grid = Array.from({ length: rows }, () => new Array(cols).fill(false));

    const isClear = (c, r) => {
      for (const z of clear) {
        if (c >= z.col && c < z.col + z.w && r >= z.row && r < z.row + z.h) return true;
      }
      return false;
    };

    const half = Math.floor(cols / 2);

    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < half; c++) {
        const mirror = cols - 1 - c;
        if (isClear(c, r) || isClear(mirror, r)) continue;
        if (Math.random() < 0.2) {
          grid[r][c] = true;
          grid[r][mirror] = true;
        }
      }
    }

    // Clump pass: remove lonely single-cell walls for better aesthetics
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < half; c++) {
        if (!grid[r][c]) continue;
        const neighbors =
          (grid[r - 1] && grid[r - 1][c] ? 1 : 0) +
          (grid[r + 1] && grid[r + 1][c] ? 1 : 0) +
          (grid[r][c - 1] ? 1 : 0) +
          (grid[r][c + 1] ? 1 : 0);
        if (neighbors === 0 && Math.random() < 0.6) {
          const mirror = cols - 1 - c;
          grid[r][c] = false;
          grid[r][mirror] = false;
        }
      }
    }

    return grid;
  }

  /**
   * Creates Phaser static group of wall sprites from a grid.
   */
  static createWallSprites(scene, grid, gridX, gridY, cellSize) {
    if (!scene.textures.exists('wall')) {
      WallGenerator._createWallTexture(scene, cellSize);
    }

    const group = scene.physics.add.staticGroup();
    const rows = grid.length;
    const cols = grid[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c]) {
          const x = gridX + c * cellSize + cellSize / 2;
          const y = gridY + r * cellSize + cellSize / 2;
          group.create(x, y, 'wall');
        }
      }
    }

    return group;
  }

  static _createWallTexture(scene, cs) {
    const g = scene.add.graphics();

    // Base fill
    g.fillStyle(0x3d3d52);
    g.fillRect(0, 0, cs, cs);

    // Top half bricks
    g.fillStyle(0x4a4a62);
    g.fillRect(1, 1, cs / 3 - 1, cs / 2 - 2);
    g.fillRect(cs / 3 + 1, 1, cs / 3 - 1, cs / 2 - 2);
    g.fillRect(2 * cs / 3 + 1, 1, cs / 3 - 2, cs / 2 - 2);

    // Bottom half bricks (offset pattern)
    g.fillRect(1, cs / 2 + 1, cs / 2 - 2, cs / 2 - 2);
    g.fillRect(cs / 2 + 1, cs / 2 + 1, cs / 2 - 2, cs / 2 - 2);

    // Mortar lines (dark)
    g.fillStyle(0x1e1e2a);
    // Outer border
    g.fillRect(0, 0, cs, 1);
    g.fillRect(0, cs - 1, cs, 1);
    g.fillRect(0, 0, 1, cs);
    g.fillRect(cs - 1, 0, 1, cs);
    // Horizontal center
    g.fillRect(0, cs / 2, cs, 1);
    // Vertical top thirds
    g.fillRect(cs / 3, 0, 1, cs / 2);
    g.fillRect(2 * cs / 3, 0, 1, cs / 2);
    // Vertical bottom half
    g.fillRect(cs / 2, cs / 2, 1, cs / 2);

    // Highlight edge
    g.fillStyle(0x6a6a80);
    g.fillRect(1, 1, cs - 2, 1);
    g.fillRect(1, 1, 1, cs - 2);

    g.generateTexture('wall', cs, cs);
    g.destroy();
  }
}
