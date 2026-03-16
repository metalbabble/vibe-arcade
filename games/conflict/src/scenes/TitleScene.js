import Phaser from 'phaser'

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  init(data) {
    this.settings = (data && data.returnSettings)
      ? data.returnSettings
      : { walls: false, bouncy: false, difficulty: 'medium' };
    this.focusRow = 0;  // 0=walls, 1=bouncy, 2=difficulty
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Background ────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, 0x080810);

    const scanGfx = this.add.graphics();
    scanGfx.fillStyle(0x000000, 0.18);
    for (let y = 0; y < H; y += 3) scanGfx.fillRect(0, y, W, 1);

    // ── Title ─────────────────────────────────────────────────────
    this.add.text(W / 2, 75, 'CONFLICT', {
      fontSize: '68px', fontFamily: 'monospace',
      color: '#00ff44', stroke: '#004422', strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(W / 2, 138, 'TANK COMBAT', {
      fontSize: '18px', fontFamily: 'monospace',
      color: '#00aa33', letterSpacing: 8
    }).setOrigin(0.5);

    // ── Settings panel ────────────────────────────────────────────
    this._buildSettings(W, H);

    // ── Decorative tanks ─────────────────────────────────────────
    this._drawDecorTank(90, 520, 0x00aa33, false);
    this._drawDecorTank(W - 90, 520, 0xcc2222, true);

    // ── Start prompt ─────────────────────────────────────────────
    const startText = this.add.text(W / 2, H - 68, '[ PRESS ENTER TO START ]', {
      fontSize: '20px', fontFamily: 'monospace', color: '#00ff44'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.tweens.add({ targets: startText, alpha: 0.1, duration: 550, yoyo: true, repeat: -1 });
    startText.on('pointerdown', () => this._startGame());
    this.input.keyboard.on('keydown-ENTER', () => this._startGame());

    // ── Hint ──────────────────────────────────────────────────────
    this.add.text(W / 2, H - 38, '↑ ↓  SELECT ROW   ←  →  CHANGE VALUE   ENTER  PLAY', {
      fontSize: '11px', fontFamily: 'monospace', color: '#224422'
    }).setOrigin(0.5);

    this.add.text(W / 2, H - 18, 'INSPIRED BY ATARI COMBAT  (1977)', {
      fontSize: '11px', fontFamily: 'monospace', color: '#1a2a1a'
    }).setOrigin(0.5);

    // ── Keyboard navigation ───────────────────────────────────────
    this._setupKeyboard();
  }

  // ─────────────────────────────────────────────────────────────────
  //  SETTINGS PANEL
  // ─────────────────────────────────────────────────────────────────
  _buildSettings(W, H) {
    const startY = 200;
    const rowH   = 62;

    // Store row Y centres for cursor positioning
    this.rowY = [
      startY + 10,
      startY + rowH + 10,
      startY + rowH * 2 + 10
    ];

    // Panel border
    const border = this.add.graphics();
    border.lineStyle(1, 0x1a331a);
    border.strokeRect(50, startY - 18, W - 100, rowH * 3 + 10);

    // Row highlight rectangle (moves with focus)
    this.rowHighlight = this.add.rectangle(
      W / 2, this.rowY[this.focusRow], W - 52, rowH - 8, 0x001a00, 0.6
    ).setDepth(0);

    // Cursor arrow
    this.cursor = this.add.text(
      58, this.rowY[this.focusRow], '▶', {
        fontSize: '14px', fontFamily: 'monospace', color: '#00ff44'
      }
    ).setOrigin(0, 0.5).setDepth(1);

    // Row labels
    const labelStyle = { fontSize: '15px', fontFamily: 'monospace', color: '#557755' };
    this.add.text(W / 2 - 200, this.rowY[0], 'WALLS',           labelStyle).setOrigin(0, 0.5);
    this.add.text(W / 2 - 200, this.rowY[1], 'BOUNCY MISSILES', labelStyle).setOrigin(0, 0.5);
    this.add.text(W / 2 - 200, this.rowY[2], 'AI DIFFICULTY',   labelStyle).setOrigin(0, 0.5);

    // Walls toggle
    this.wallToggle   = this._buildToggle(W / 2 + 60, this.rowY[0], 'walls');
    // Bouncy toggle
    this.bouncyToggle = this._buildToggle(W / 2 + 60, this.rowY[1], 'bouncy');
    // Difficulty selector
    this.diffButtons  = this._buildDiffSelector(W / 2 + 60, this.rowY[2]);
  }

  _buildToggle(x, y, key) {
    const activeStyle   = { fontSize: '18px', fontFamily: 'monospace', color: '#00ff44' };
    const inactiveStyle = { fontSize: '18px', fontFamily: 'monospace', color: '#1a3a1a' };

    const offBtn = this.add.text(x,      y, 'OFF', this.settings[key] ? inactiveStyle : activeStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.add.text(x + 48, y, '/', { fontSize: '18px', fontFamily: 'monospace', color: '#224422' })
      .setOrigin(0.5);
    const onBtn = this.add.text(x + 90, y, 'ON', this.settings[key] ? activeStyle : inactiveStyle)
      .setOrigin(0.5).setInteractive({ useHandCursor: true });

    const refresh = () => {
      const on = this.settings[key];
      offBtn.setStyle(on ? inactiveStyle : activeStyle);
      onBtn.setStyle(on ? activeStyle : inactiveStyle);
    };

    offBtn.on('pointerdown', () => { this.settings[key] = false; refresh(); });
    onBtn.on('pointerdown',  () => { this.settings[key] = true;  refresh(); });

    return { offBtn, onBtn, refresh };
  }

  _buildDiffSelector(x, y) {
    const diffs   = ['easy', 'medium', 'hard'];
    const labels  = ['EASY', 'MEDIUM', 'HARD'];
    const offsets = [-90, 0, 100];
    const buttons = {};

    const activeStyle   = { fontSize: '17px', fontFamily: 'monospace', color: '#00ff44' };
    const inactiveStyle = { fontSize: '17px', fontFamily: 'monospace', color: '#1a3a1a' };

    diffs.forEach((diff, i) => {
      const btn = this.add.text(x + offsets[i], y, labels[i],
        this.settings.difficulty === diff ? activeStyle : inactiveStyle
      ).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.settings.difficulty = diff;
        diffs.forEach(d => buttons[d].setStyle(d === diff ? activeStyle : inactiveStyle));
      });

      buttons[diff] = btn;
    });

    return buttons;
  }

  // ─────────────────────────────────────────────────────────────────
  //  KEYBOARD NAVIGATION
  // ─────────────────────────────────────────────────────────────────
  _setupKeyboard() {
    // UP / DOWN — move focus between rows
    this.input.keyboard.on('keydown-UP', () => {
      this.focusRow = (this.focusRow + 2) % 3;  // wrap upward
      this._updateCursor();
    });
    this.input.keyboard.on('keydown-DOWN', () => {
      this.focusRow = (this.focusRow + 1) % 3;
      this._updateCursor();
    });

    // LEFT / RIGHT — change value for focused row
    this.input.keyboard.on('keydown-LEFT',  () => this._changeValue(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this._changeValue(1));
  }

  _updateCursor() {
    const y = this.rowY[this.focusRow];
    this.cursor.setY(y);
    this.rowHighlight.setY(y);

    // Brief flash on the cursor
    this.tweens.add({
      targets: this.cursor, alpha: 0.1, duration: 80, yoyo: true
    });
  }

  _changeValue(dir) {
    // dir: -1 = left, +1 = right
    if (this.focusRow === 0) {
      // Walls: OFF(-1) → ON(+1), or toggle on any press
      this.settings.walls = dir > 0 ? true : (dir < 0 ? false : !this.settings.walls);
      this.wallToggle.refresh();

    } else if (this.focusRow === 1) {
      // Bouncy: same pattern
      this.settings.bouncy = dir > 0 ? true : (dir < 0 ? false : !this.settings.bouncy);
      this.bouncyToggle.refresh();

    } else {
      // Difficulty: cycle through easy → medium → hard
      const order = ['easy', 'medium', 'hard'];
      const idx   = order.indexOf(this.settings.difficulty);
      const next  = Math.max(0, Math.min(2, idx + dir));
      this.settings.difficulty = order[next];

      const activeStyle   = { fontSize: '17px', fontFamily: 'monospace', color: '#00ff44' };
      const inactiveStyle = { fontSize: '17px', fontFamily: 'monospace', color: '#1a3a1a' };
      order.forEach(d => {
        this.diffButtons[d].setStyle(d === this.settings.difficulty ? activeStyle : inactiveStyle);
      });
    }

    // Visual "tick" feedback on the cursor arrow
    this.tweens.add({
      targets: this.cursor, scaleX: 1.6, scaleY: 1.6,
      duration: 60, yoyo: true
    });
  }

  // ─────────────────────────────────────────────────────────────────
  //  DECORATIVE TANKS
  // ─────────────────────────────────────────────────────────────────
  _drawDecorTank(cx, cy, color, flipped) {
    const g    = this.add.graphics();
    const alpha = 0.45;
    const dark  = color === 0x00aa33 ? 0x005519 : 0x771111;
    g.fillStyle(dark, alpha);
    g.fillRect(cx - 22, cy - 11, 44, 7);
    g.fillRect(cx - 22, cy + 4,  44, 7);
    g.fillStyle(color, alpha);
    g.fillRect(cx - 18, cy - 7, 36, 14);
    g.fillStyle(color, alpha + 0.15);
    g.fillRect(cx - 8, cy - 5, 16, 10);
    g.fillStyle(dark, alpha + 0.1);
    if (flipped) g.fillRect(cx - 22, cy - 2, 14, 4);
    else         g.fillRect(cx + 8,  cy - 2, 14, 4);
  }

  // ─────────────────────────────────────────────────────────────────
  _startGame() {
    this.scene.start('GameScene', { ...this.settings });
  }
}
