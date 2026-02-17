import { drawText } from "../engine/utils.js";

export class UIRenderer {
  handlePointerMove(game, x, y) {
    if (game.state === game.GAME_STATE.TITLE) {
      for (const button of game.titleButtons) {
        if (this.#pointInRect(x, y, button)) return button.id;
      }
    } else if (game.state === game.GAME_STATE.GAME_OVER_READY) {
      if (this.#pointInRect(x, y, game.menuButton)) return game.menuButton.id;
    }

    return null;
  }

  handlePointerDown(game, x, y) {
    if (game.state === game.GAME_STATE.TITLE) {
      for (const button of game.titleButtons) {
        if (this.#pointInRect(x, y, button)) {
          return { type: "START_GAME", difficulty: button.id };
        }
      }
    }

    if (game.state === game.GAME_STATE.GAME_OVER_READY && this.#pointInRect(x, y, game.menuButton)) {
      return { type: "OPEN_MENU" };
    }

    return null;
  }

  drawTitleScreen(game) {
    const ctx = game.ctx;
    game.background.setAmbienceFactor(0);
    game.background.render(ctx);
    const panelW = 440;
    const panelH = 330;
    const panelX = game.world.w * 0.5 - panelW * 0.5;
    const panelY = game.world.h * 0.5 - panelH * 0.5 + 40;
    this.#drawPanelGlow(ctx, panelX, panelY, panelW, panelH);

    this.#drawNeonTitle(ctx, "ASTEROID", game.world.w * 0.5, game.world.h * 0.22);
    ctx.save();
    ctx.font = "600 19px system-ui, sans-serif";
    ctx.fillStyle = "rgba(212,236,255,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Choisissez une difficulté", game.world.w * 0.5, game.world.h * 0.34);
    ctx.restore();

    for (const button of game.titleButtons) {
      const drawState = game.titleButtonDrawState;
      drawState.hovered = game.hoveredButtonId === button.id;
      drawState.pressed = false;
      this.#drawNeonButton(ctx, button, button.label, drawState);
    }

    ctx.save();
    ctx.font = "600 16px 'Audiowide', system-ui, sans-serif";
    ctx.fillStyle = "rgba(178,242,255,0.95)";
    ctx.shadowColor = "rgba(112,233,255,0.55)";
    ctx.shadowBlur = 4;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("[1] EASY   [2] NORMAL   [3] HARD", game.world.w * 0.5, game.world.h * 0.79);
    ctx.restore();
  }

  drawGameOverOverlay(game) {
    const ctx = game.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, game.world.w, game.world.h);
    ctx.restore();

    drawText(ctx, "GAME OVER", game.world.w * 0.5 - 120, game.world.h * 0.38, 52);
    drawText(ctx, `Score: ${Math.floor(game.score)}`, game.world.w * 0.5 - 80, game.world.h * 0.50, 24);
    drawText(ctx, "[R] Rejouer", game.world.w * 0.5 - 65, game.world.h * 0.58, 20);
    drawText(ctx, "[M] Menu", game.world.w * 0.5 - 52, game.world.h * 0.64, 20);
  }

  drawProfilerOverlay(game) {
    if (!game.debugProfiler) return;

    const ctx = game.ctx;
    const x = 10;
    const y = 10;
    const lineHeight = 20;
    const lines = [
      `FPS: ${game.profView.shownFps.toFixed(0)}`,
      `update: ${game.profView.shownUpdateMs.toFixed(1)} ms | PEAK (last 1s): ${game.profView.peakUpdateMs.toFixed(1)} ms`,
      `render: ${game.profView.shownDrawMs.toFixed(1)} ms | PEAK (last 1s): ${game.profView.peakDrawMs.toFixed(1)} ms`,
      `asteroid collisions: ${game.profView.shownCollisions}`,
      `asteroid max speed: ${game.profView.shownMaxSpeed.toFixed(2)}`,
      `asteroid kinetic E: ${game.profView.shownKE.toFixed(1)}`,
      `freeze(F3): ${game.profView.freezeT > 0 ? `${game.profView.freezeT.toFixed(1)}s` : "ready"}`,
    ];

    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = "#05070d";
    ctx.fillRect(x - 8, y - 8, 700, lines.length * lineHeight + 16);
    ctx.restore();

    ctx.save();
    ctx.font = "15px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillStyle = "rgba(220, 245, 255, 0.98)";

    for (let i = 0; i < lines.length; i++) {
      const ty = y + i * lineHeight;
      ctx.strokeText(lines[i], x, ty);
      ctx.fillText(lines[i], x, ty);
    }

    ctx.restore();
  }

  #pointInRect(mx, my, rect) {
    return mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h;
  }

  #roundedRectPath(ctx, x, y, w, h, r = 10) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  #drawPanelGlow(ctx, x, y, w, h) {
    const pad = 26;

    ctx.save();
    const panelGrad = ctx.createLinearGradient(x, y, x, y + h);
    panelGrad.addColorStop(0, "rgba(34,12,66,0.45)");
    panelGrad.addColorStop(0.5, "rgba(10,16,48,0.35)");
    panelGrad.addColorStop(1, "rgba(4,20,34,0.42)");
    this.#roundedRectPath(ctx, x, y, w, h, 20);
    ctx.fillStyle = panelGrad;
    ctx.fill();

    const borderGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    borderGrad.addColorStop(0, "rgba(255,87,239,0.45)");
    borderGrad.addColorStop(1, "rgba(86,240,255,0.45)");
    this.#roundedRectPath(ctx, x, y, w, h, 20);
    ctx.lineWidth = 2;
    ctx.strokeStyle = borderGrad;
    ctx.stroke();

    const glowGrad = ctx.createRadialGradient(x + w * 0.5, y + h * 0.45, 20, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.85);
    glowGrad.addColorStop(0, "rgba(188,91,255,0.20)");
    glowGrad.addColorStop(1, "rgba(86,240,255,0)");
    ctx.fillStyle = glowGrad;
    this.#roundedRectPath(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, 34);
    ctx.fill();
    ctx.restore();
  }

  #drawNeonTitle(ctx, text, x, y) {
    ctx.save();
    const grad = ctx.createLinearGradient(x, y - 72, x, y + 10);
    grad.addColorStop(0, "#ff8bff");
    grad.addColorStop(0.52, "#c867ff");
    grad.addColorStop(1, "#70efff");

    ctx.font = "900 86px 'Audiowide', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    ctx.shadowColor = "rgba(255,84,238,0.95)";
    ctx.shadowBlur = 28;
    ctx.fillStyle = grad;
    ctx.fillText(text, x, y);

    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "rgba(224,245,255,0.75)";
    ctx.strokeText(text, x, y);
    ctx.restore();
  }

  #drawNeonButton(ctx, rect, label, state) {
    const { x, y, w, h } = rect;
    const radius = 9;
    const pulse = state.hovered ? 0.5 + 0.5 * Math.sin(performance.now() * 0.006) : 0;
    const glowBoost = state.hovered ? 1 : 0.35;
    const pressBoost = state.pressed ? 0.35 : 0;

    const borderGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    borderGrad.addColorStop(0, "rgba(255,84,236,0.96)");
    borderGrad.addColorStop(1, "rgba(82,237,255,0.96)");

    ctx.save();
    this.#roundedRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = "rgba(10,10,20,0.55)";
    ctx.fill();

    ctx.shadowColor = "rgba(244,103,255,0.95)";
    ctx.shadowBlur = 10 + glowBoost * 14 + pulse * 4 + pressBoost * 10;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = borderGrad;
    this.#roundedRectPath(ctx, x, y, w, h, radius);
    ctx.stroke();

    if (state.hovered || state.pressed) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(215,252,255,${0.55 + pulse * 0.3 + pressBoost})`;
      this.#roundedRectPath(ctx, x + 4, y + 4, w - 8, h - 8, radius - 3);
      ctx.stroke();
    }

    const textGrad = ctx.createLinearGradient(x, y, x, y + h);
    textGrad.addColorStop(0, "#fff7ff");
    textGrad.addColorStop(1, "#bff7ff");
    ctx.fillStyle = textGrad;
    ctx.font = "700 27px 'Audiowide', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(127,245,255,0.85)";
    ctx.shadowBlur = 4 + glowBoost * 4 + pressBoost * 8;
    ctx.fillText(label, x + w * 0.5, y + h * 0.5 + 1);
    ctx.restore();
  }
}
