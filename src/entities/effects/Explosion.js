import { drawCircularGlow } from "../../rendering/GlowRenderer.js";

const EXPLOSION_DEFAULT_PROFILE = {
  life: 0.3,
  ringCount: 2,
  maxRadius: 90,
  flashAlpha: 0.8,
  colorMode: "normal",
};

const EXPLOSION_COLOR_MODES = {
  normal: {
    ring: ["rgba(255,255,255,0.95)", "rgba(130,220,255,0.85)", "rgba(110,160,255,0.75)"],
    flash: "rgba(255,245,210,1)",
  },
  dense: {
    ring: ["rgba(255,235,160,0.95)", "rgba(255,164,90,0.85)", "rgba(255,120,80,0.75)"],
    flash: "rgba(255,220,150,1)",
  },
  fast: {
    ring: ["rgba(180,245,255,0.95)", "rgba(120,255,255,0.8)", "rgba(95,180,255,0.7)"],
    flash: "rgba(200,255,255,1)",
  },
};

export class Explosion {
  constructor(x, y, profile = {}) {
    this.x = x;
    this.y = y;
    this.t = 0;

    const merged = { ...EXPLOSION_DEFAULT_PROFILE, ...profile };
    const ringCount = Math.max(1, Math.min(3, Math.floor(merged.ringCount)));
    const maxRadiusCap = merged.maxRadius > 100 ? merged.maxRadius * 0.85 : merged.maxRadius;

    this.profile = {
      ...merged,
      ringCount,
      maxRadius: maxRadiusCap,
    };
    this.dead = false;
  }

  update(dt) {
    this.t += dt;
    if (this.t >= this.profile.life) this.dead = true;
  }

  drawBase(ctx) {
    const p = Math.min(1, this.t / this.profile.life);
    const colors = EXPLOSION_COLOR_MODES[this.profile.colorMode] ?? EXPLOSION_COLOR_MODES.normal;

    ctx.save();
    const flashRadius = this.profile.maxRadius * (0.18 + 0.4 * p);
    const flashGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, flashRadius);
    flashGrad.addColorStop(0, colors.flash);
    flashGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = this.profile.flashAlpha * (1 - p);
    ctx.fillStyle = flashGrad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, flashRadius, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < this.profile.ringCount; i++) {
      const ringProgress = Math.max(0, p - i * 0.08);
      const radius = this.profile.maxRadius * ringProgress * (0.92 + i * 0.18);
      const alpha = (1 - ringProgress) * (0.78 - i * 0.16);
      if (alpha <= 0 || radius <= 0.1) continue;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colors.ring[Math.min(i, colors.ring.length - 1)];
      ctx.lineWidth = Math.max(1, 3 - i);
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawGlow(ctx) {
    const p = Math.min(1, this.t / this.profile.life);
    const colors = EXPLOSION_COLOR_MODES[this.profile.colorMode] ?? EXPLOSION_COLOR_MODES.normal;
    drawCircularGlow(ctx, this.x, this.y, this.profile.maxRadius * (0.2 + 0.4 * p), colors.flash, (1 - p) * this.profile.flashAlpha * 2);
  }

  draw(ctx) {
    this.drawBase(ctx);
    this.drawGlow(ctx);
  }
}
