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

window.conflictGame = new Phaser.Game(GameConfig);
