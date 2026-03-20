import GAME_CONFIG from '../config.js';

export default class ScoreManager {
  constructor(scoreText, livesText, levelText) {
    this._scoreText = scoreText;
    this._livesText = livesText;
    this._levelText = levelText;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = GAME_CONFIG.STARTING_LIVES;
    this.level = 1;
    this._refresh();
  }

  addScore(points) {
    this.score += points;
    this._refresh();
  }

  loseLife() {
    this.lives = Math.max(0, this.lives - 1);
    this._refresh();
  }

  addLife() {
    this.lives += 1;
    this._refresh();
  }

  nextLevel() {
    this.level += 1;
    this._refresh();
  }

  isGameOver() {
    return this.lives <= 0;
  }

  ballSpeed() {
    return GAME_CONFIG.BALL_BASE_SPEED + (this.level - 1) * GAME_CONFIG.BALL_SPEED_INCREMENT;
  }

  _refresh() {
    this._scoreText.setText(`Score: ${this.score}`);
    this._livesText.setText(`Lives: ${this.lives}`);
    this._levelText.setText(`Level: ${this.level}`);
  }
}
