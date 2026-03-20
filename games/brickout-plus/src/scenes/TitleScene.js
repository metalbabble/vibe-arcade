import Phaser from 'phaser';

const HIGH_SCORE_KEY = 'brickout-plus-highscore';
const MODES = ['Classic Layout', 'Random Levels'];

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.text(cx, cy - 155, 'Brickout Plus', {
      fontFamily: 'monospace',
      fontSize: '64px',
      fill: '#f1c40f',
      stroke: '#000',
      strokeThickness: 8,
    }).setOrigin(0.5);

    const highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    this.add.text(cx, cy - 65, `High Score: ${highScore}`, {
      fontFamily: 'monospace',
      fontSize: '26px',
      fill: '#aaaaaa',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 5, 'GAME MODE', {
      fontFamily: 'monospace',
      fontSize: '16px',
      fill: '#888888',
    }).setOrigin(0.5);

    this._selectedMode = 0;

    this._optionTexts = MODES.map((label, i) => {
      const x = cx + (i === 0 ? -115 : 115);
      const t = this.add.text(x, cy + 45, label, {
        fontFamily: 'monospace',
        fontSize: '20px',
        fill: '#666666',
        padding: { x: 12, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      t.on('pointerdown', () => {
        if (this._selectedMode === i) {
          this._startGame();
        } else {
          this._selectedMode = i;
          this._updateSelection();
        }
      });

      return t;
    });

    this._updateSelection();

    this.add.text(cx, cy + 105, '← → to change mode', {
      fontFamily: 'monospace',
      fontSize: '15px',
      fill: '#555555',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 145, 'ENTER or tap selected mode to start', {
      fontFamily: 'monospace',
      fontSize: '15px',
      fill: '#555555',
    }).setOrigin(0.5);

    const cycle = (dir) => {
      this._selectedMode = (this._selectedMode + dir + MODES.length) % MODES.length;
      this._updateSelection();
    };

    this.input.keyboard.on('keydown-LEFT', () => cycle(-1));
    this.input.keyboard.on('keydown-RIGHT', () => cycle(1));
    this.input.keyboard.on('keydown-UP', () => cycle(-1));
    this.input.keyboard.on('keydown-DOWN', () => cycle(1));
    this.input.keyboard.on('keydown-ENTER', () => this._startGame());
    this.input.keyboard.on('keydown-SPACE', () => this._startGame());
  }

  _updateSelection() {
    this._optionTexts.forEach((t, i) => {
      const sel = i === this._selectedMode;
      t.setStyle({
        fill: sel ? '#f1c40f' : '#666666',
        stroke: sel ? '#000000' : undefined,
        strokeThickness: sel ? 3 : 0,
        backgroundColor: sel ? '#1a1a40' : '#111111',
      });
      t.setText(sel ? `> ${MODES[i]} <` : `  ${MODES[i]}  `);
    });
  }

  _startGame() {
    const mode = this._selectedMode === 0 ? 'classic' : 'random';
    this.scene.start('GameScene', { mode });
  }
}
