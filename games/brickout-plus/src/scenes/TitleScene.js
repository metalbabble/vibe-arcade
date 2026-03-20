import Phaser from 'phaser';

const HIGH_SCORE_KEY = 'brickout-plus-highscore';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.text(cx, cy - 130, 'Brickout Plus', {
      fontFamily: 'monospace',
      fontSize: '64px',
      fill: '#f1c40f',
      stroke: '#000',
      strokeThickness: 8,
    }).setOrigin(0.5);

    const highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    this.add.text(cx, cy - 30, `High Score: ${highScore}`, {
      fontFamily: 'monospace',
      fontSize: '26px',
      fill: '#aaaaaa',
    }).setOrigin(0.5);

    this.add.text(cx, cy + 70, 'Press ENTER or TAP to start', {
      fontFamily: 'monospace',
      fontSize: '22px',
      fill: '#ffffff',
    }).setOrigin(0.5);

    const start = () => this.scene.start('GameScene');
    this.input.keyboard.once('keydown-ENTER', start);
    this.input.once('pointerdown', start);
  }
}
