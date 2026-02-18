import { Game } from "./engine/Game.js";
import AudioManager from "./audio/AudioManager.js";

const canvas = document.getElementById("game");
const audio = new AudioManager();
const game = new Game(canvas, { audio });
window.__game = game;
game.start().catch((error) => {
  console.error("Game start failed", error);
});
