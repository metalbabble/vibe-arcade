import Phaser from 'phaser';
import GAME_CONFIG from '../config.js';

const HIGH_SCORE_KEY = 'brickout-plus-highscore';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(data) {
    const cx = GAME_CONFIG.CANVAS_WIDTH / 2;
    const cy = GAME_CONFIG.CANVAS_HEIGHT / 2;
    const score = data?.score ?? 0;

    const prev = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    const isNewHigh = score > prev;
    if (isNewHigh) localStorage.setItem(HIGH_SCORE_KEY, String(score));
    const highScore = isNewHigh ? score : prev;

    this.add.text(cx, cy - 110, 'GAME OVER', {
      fontFamily: 'monospace',
      fontSize: '52px',
      fill: '#e74c3c',
      stroke: '#000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 30, `Final Score: ${score}`, {
      fontFamily: 'monospace',
      fontSize: '28px',
      fill: '#f1c40f',
    }).setOrigin(0.5);

    if (isNewHigh) {
      this.add.text(cx, cy + 20, 'NEW HIGH SCORE!', {
        fontFamily: 'monospace',
        fontSize: '24px',
        fill: '#2ecc71',
        stroke: '#000',
        strokeThickness: 3,
      }).setOrigin(0.5);
    } else {
      this.add.text(cx, cy + 20, `High Score: ${highScore}`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        fill: '#aaaaaa',
      }).setOrigin(0.5);
    }

    this.add.text(cx, cy + 90, 'Press ENTER or TAP to continue', {
      fontFamily: 'monospace',
      fontSize: '20px',
      fill: '#aaaaaa',
    }).setOrigin(0.5);

    const goToTitle = () => this.scene.start('TitleScene');
    this.input.keyboard.once('keydown-ENTER', goToTitle);
    this.input.once('pointerdown', goToTitle);
  }
}
