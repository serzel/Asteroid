export function updateGameOverAnimState(game, dt, updateEffectsOnly) {
  updateEffectsOnly(dt);
  game.gameOverDelay -= dt;
  if (game.gameOverDelay <= 0) {
    game.state = game.GAME_STATE.GAME_OVER_READY;
    game.logDebug("state", "State transition -> GAME_OVER_READY");
  }
}

export function updateGameOverReadyState(game, updateEffectsOnly, restartGame) {
  updateEffectsOnly();

  if (game.input.wasPressed("KeyR") || game.input.wasPressed("Enter")) {
    restartGame();
    game.state = "PLAY";
  }
  if (game.input.wasPressed("KeyM")) {
    game.state = "TITLE";
  }
}
