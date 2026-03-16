import Phaser from 'phaser'
import TitleScene from './scenes/TitleScene.js'
import GameScene from './scenes/GameScene.js'
import ResultsScene from './scenes/ResultsScene.js'
import '../../../shared/touch-controller.js'

const GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#0a0a0a',
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [TitleScene, GameScene, ResultsScene],
  pixelArt: true
};

new Phaser.Game(GameConfig);
