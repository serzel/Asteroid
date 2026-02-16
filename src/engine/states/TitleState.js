export function updateTitleState(game, startWithDifficulty) {
  if (game.input.wasPressed("Digit1")) startWithDifficulty("EASY");
  if (game.input.wasPressed("Digit2")) startWithDifficulty("NORMAL");
  if (game.input.wasPressed("Digit3")) startWithDifficulty("HARD");
}
