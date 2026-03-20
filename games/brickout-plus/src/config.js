const GAME_CONFIG = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,

  PADDLE_WIDTH: 100,
  PADDLE_HEIGHT: 14,
  PADDLE_SPEED: 500,
  PADDLE_Y_OFFSET: 50, // distance from bottom

  BALL_RADIUS: 8,
  BALL_BASE_SPEED: 300,
  BALL_SPEED_INCREMENT: 40, // added per level

  BRICK_ROWS: 5,
  BRICK_COLS: 10,
  BRICK_WIDTH: 68,
  BRICK_HEIGHT: 22,
  BRICK_PADDING: 4,
  BRICK_TOP_OFFSET: 80, // gap from top for ball to pass through

  BRICK_COLORS: [0xe74c3c, 0xe67e22, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6, 0x1abc9c, 0xe91e63],

  SCORE_PER_BRICK: 10,
  STARTING_LIVES: 3,

  HUD_HEIGHT: 40,

  // Power-ups
  PADDLE_LONG_WIDTH: 170,
  POWERUP_SPAWN_CHANCE: 0.25,
  POWERUP_FALL_SPEED: 150,
  POWERUP_DURATION: 12000,    // ms for timed effects
  POWERUP_BONUS_POINTS: 100,
  LASER_COOLDOWN: 350,        // ms between shots
  LASER_SPEED: 700,

  POWERUP_TYPES: ['longPaddle', 'laser', 'multiBall', 'extraLife', 'extraPoints', 'stickyPaddle', 'powerball'],

  POWERUP_META: {
    longPaddle:   { label: '+PAD',   color: 0x3498db },
    laser:        { label: 'LASER',  color: 0xe74c3c },
    multiBall:    { label: '3BALL',  color: 0xf1c40f },
    extraLife:    { label: '+LIFE',  color: 0x2ecc71 },
    extraPoints:  { label: '+PTS',   color: 0x9b59b6 },
    stickyPaddle: { label: 'STICK',  color: 0x1abc9c },
    powerball:    { label: 'PBALL',  color: 0xe67e22 },
  },
};

export default GAME_CONFIG;
