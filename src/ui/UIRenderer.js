import { drawText } from "../engine/utils.js";
import { drawCircularGlow, drawOutlineGlow } from "../rendering/GlowRenderer.js";
import { getHoveredButtonId, resolvePointerDownAction } from "./UIInput.js";

export class UIRenderer {
  handlePointerMove(uiModel, x, y) {
    return getHoveredButtonId(
      uiModel.state,
      x,
      y,
      uiModel.titleButtons,
      uiModel.menuButton,
      uiModel.GAME_STATE,
    );
  }

  handlePointerDown(uiModel, x, y) {
    return resolvePointerDownAction(
      uiModel.state,
      x,
      y,
      uiModel.titleButtons,
      uiModel.menuButton,
      uiModel.GAME_STATE,
    );
  }

  drawTitleScreen(ctx, uiModel) {
    const panelW = 440;
    const panelH = 330;
    const panelX = uiModel.world.w * 0.5 - panelW * 0.5;
    const panelY = uiModel.world.h * 0.5 - panelH * 0.5 + 40;
    this.#drawPanelGlow(ctx, panelX, panelY, panelW, panelH);

    this.#drawNeonTitle(ctx, "ASTEROID", uiModel.world.w * 0.5, uiModel.world.h * 0.22);
    ctx.save();
    ctx.font = "600 19px system-ui, sans-serif";
    ctx.fillStyle = "rgba(212,236,255,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Choisissez une difficulté", uiModel.world.w * 0.5, uiModel.world.h * 0.34);
    ctx.restore();

    for (const button of uiModel.titleButtons) {
      const drawState = {
        hovered: uiModel.hoveredButtonId === button.id,
        pressed: false,
      };
      this.#drawNeonButton(ctx, button, button.label, drawState);
    }

    ctx.save();
    ctx.font = "600 16px 'Audiowide', system-ui, sans-serif";
    ctx.fillStyle = "rgba(178,242,255,0.95)";
    drawCircularGlow(ctx, uiModel.world.w * 0.5, uiModel.world.h * 0.79, 95, "rgba(112,233,255,0.55)", 0.182, "low");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("[1] EASY   [2] NORMAL   [3] HARD", uiModel.world.w * 0.5, uiModel.world.h * 0.79);
    ctx.restore();
  }

  drawGameOverOverlay(ctx, uiModel) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, uiModel.world.w, uiModel.world.h);
    ctx.restore();

    drawText(ctx, "GAME OVER", uiModel.world.w * 0.5 - 120, uiModel.world.h * 0.38, 52);
    drawText(ctx, `Score: ${Math.floor(uiModel.score)}`, uiModel.world.w * 0.5 - 80, uiModel.world.h * 0.50, 24);
    drawText(ctx, "[R] Rejouer", uiModel.world.w * 0.5 - 65, uiModel.world.h * 0.58, 20);
    drawText(ctx, "[M] Menu", uiModel.world.w * 0.5 - 52, uiModel.world.h * 0.64, 20);
  }

  drawProfilerOverlay(ctx, uiModel) {
    if (!uiModel.debugProfiler || !uiModel.profView) return;

    const { profView } = uiModel;

    const x = 10;
    const y = 10;
    const lineHeight = 20;
    const lines = [
      `FPS: ${profView.shownFps.toFixed(0)}`,
      `update: ${profView.shownUpdateMs.toFixed(1)} ms | PEAK (last 1s): ${profView.peakUpdateMs.toFixed(1)} ms`,
      `render: ${profView.shownDrawMs.toFixed(1)} ms | PEAK (last 1s): ${profView.peakDrawMs.toFixed(1)} ms`,
      `asteroid collisions: ${profView.shownCollisions}`,
      `asteroid hash rebuilds/frame: ${profView.shownSpatialHashRebuilds}`,
      `asteroid max speed: ${profView.shownMaxSpeed.toFixed(2)}`,
      `asteroid kinetic E: ${profView.shownKE.toFixed(1)}`,
      `freeze(F3): ${profView.freezeT > 0 ? `${profView.freezeT.toFixed(1)}s` : "ready"}`,
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

    drawCircularGlow(ctx, x, y, 64, "rgba(255,84,238,0.95)", 0.28, "low");
    ctx.fillStyle = grad;
    ctx.fillText(text, x, y);

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

    drawOutlineGlow(ctx, (c) => this.#roundedRectPath(c, x, y, w, h, radius), "rgba(244,103,255,0.95)", 1.4, 0.224 + glowBoost * 0.21 + pulse * 0.084 + pressBoost * 0.196, "low");
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = borderGrad;
    this.#roundedRectPath(ctx, x, y, w, h, radius);
    ctx.stroke();

    if (state.hovered || state.pressed) {
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
    drawCircularGlow(ctx, x + w * 0.5, y + h * 0.5 + 1, Math.max(w, h) * 0.19, "rgba(127,245,255,0.85)", 0.168 + glowBoost * 0.126 + pressBoost * 0.14, "low");
    ctx.fillText(label, x + w * 0.5, y + h * 0.5 + 1);
    ctx.restore();
  }
}
