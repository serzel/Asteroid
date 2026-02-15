const BG_LAYER_CONFIG = [
  { density: 0.00022, speedMul: 0.18, alphaMin: 0.18, alphaMax: 0.45, radiusMin: 0.7, radiusMax: 1.5 },
  { density: 0.00016, speedMul: 0.42, alphaMin: 0.26, alphaMax: 0.62, radiusMin: 1.0, radiusMax: 2.2 },
  { density: 0.00009, speedMul: 0.8, alphaMin: 0.4, alphaMax: 0.92, radiusMin: 1.4, radiusMax: 3.1 },
];

const BG_DRIFT_X = 9;
const BG_DRIFT_Y = 5;
const DUST_DRIFT_X = 2.2;
const DUST_DRIFT_Y = 1.2;

const randomRange = (min, max) => min + Math.random() * (max - min);

const pickWarmTint = () => {
  const roll = Math.random();

  if (roll < 0.6) {
    return {
      h: randomRange(40, 55),
      s: randomRange(0, 10),
      l: randomRange(85, 95),
    };
  }

  if (roll < 0.85) {
    return {
      h: randomRange(40, 55),
      s: randomRange(30, 55),
      l: randomRange(80, 92),
    };
  }

  if (roll < 0.95) {
    return {
      h: randomRange(25, 40),
      s: randomRange(45, 70),
      l: randomRange(75, 88),
    };
  }

  return {
    h: randomRange(0, 15),
    s: randomRange(55, 80),
    l: randomRange(70, 85),
  };
};

const pickStarSizeMultiplier = () => {
  const roll = Math.random();
  if (roll < 0.7) return randomRange(0.7, 1.0);
  if (roll < 0.95) return randomRange(1.0, 1.35);
  return randomRange(1.35, 1.85);
};

const buildStarTwinkle = () => {
  if (Math.random() > randomRange(0.1, 0.15)) {
    return { twinkle: false, phase: 0, speed: 0, amplitude: 0 };
  }

  return {
    twinkle: true,
    phase: randomRange(0, Math.PI * 2),
    speed: randomRange(0.6, 1.6),
    amplitude: randomRange(0.08, 0.18),
  };
};

export class Background {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.time = 0;
    this.ambienceFactor = 0;
    this.layers = [];
    this.planetImgs = [];
    this.planets = [];
    this.shootingStars = [];
    this.shootTimer = randomRange(8, 14);
    this.dust = [];

    for (let i = 1; i <= 6; i++) {
      const img = new Image();
      img.src = new URL(`../../assets/planet_0${i}.png`, import.meta.url);
      this.planetImgs.push(img);
    }

    this.resize(width, height);
  }

  #buildLayer(config) {
    const area = this.w * this.h;
    const count = Math.max(35, Math.floor(area * config.density));
    const stars = [];

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: (config.radiusMin + Math.random() * (config.radiusMax - config.radiusMin)) * pickStarSizeMultiplier(),
        a: config.alphaMin + Math.random() * (config.alphaMax - config.alphaMin),
        speedMul: config.speedMul * (0.65 + Math.random() * 0.7),
        ...pickWarmTint(),
        ...buildStarTwinkle(),
      });
    }

    return { ...config, stars };
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.layers = BG_LAYER_CONFIG.map((config) => this.#buildLayer(config));

    const planetCount = 3 + Math.floor(Math.random() * 3);
    const hudZones = [
      { x: 0, y: 0, w: this.w * 0.26, h: this.h * 0.17 },
      { x: this.w * 0.34, y: 0, w: this.w * 0.32, h: this.h * 0.15 },
      { x: this.w * 0.72, y: 0, w: this.w * 0.28, h: this.h * 0.17 },
      { x: this.w * 0.34, y: this.h * 0.84, w: this.w * 0.32, h: this.h * 0.16 },
    ];
    const gameplayForbidden = {
      x: this.w * 0.2,
      y: this.h * 0.2,
      w: this.w * 0.6,
      h: this.h * 0.6,
    };

    const isInZone = (x, y, zone) => x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h;
    const isBlocked = (x, y) => isInZone(x, y, gameplayForbidden) || hudZones.some((zone) => isInZone(x, y, zone));

    this.planets = [];
    for (let i = 0; i < planetCount; i++) {
      let x0 = Math.random() * this.w;
      let y0 = randomRange(this.h * 0.08, this.h * 0.92);
      for (let tries = 0; tries < 18 && isBlocked(x0, y0); tries++) {
        x0 = Math.random() * this.w;
        y0 = randomRange(this.h * 0.08, this.h * 0.92);
      }

      const layer = i === planetCount - 1 && Math.random() > 0.6 ? 2 : Math.floor(Math.random() * 2);
      const alpha = randomRange(0.18, 0.35);
      const baseScale = randomRange(0.35, 0.95);
      const scale = baseScale > 0.9 ? baseScale * randomRange(0.84, 0.93) : baseScale;
      const tint = pickWarmTint();

      this.planets.push({
        img: this.planetImgs[Math.floor(Math.random() * this.planetImgs.length)],
        x0,
        y0,
        x: x0,
        y: y0,
        driftRange: randomRange(120, 280),
        driftSpeed: randomRange(3, 12),
        dir: Math.random() > 0.5 ? 1 : -1,
        alpha,
        scale,
        layer,
        floatFreq: randomRange(0.12, 0.24),
        floatPhase: randomRange(0, Math.PI * 2),
        tint,
        haloRadiusMul: randomRange(1.3, 1.6),
        haloAlpha: randomRange(0.08, 0.15),
        shadeAlpha: randomRange(0.1, 0.22),
      });
    }

    const dustCount = Math.max(120, Math.floor((this.w * this.h) * 0.00011));
    this.dust = [];
    for (let i = 0; i < dustCount; i++) {
      this.dust.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: randomRange(0.7, 2.2),
        alpha: randomRange(0.03, 0.06),
        speedMul: randomRange(0.45, 1.1),
      });
    }

    this.shootingStars = [];
    this.shootTimer = randomRange(8, 14);
  }

  setAmbienceFactor(value) {
    this.ambienceFactor = Math.max(0, Math.min(1, value));
  }

  update(dt) {
    this.time += dt;

    for (const layer of this.layers) {
      const dx = BG_DRIFT_X * layer.speedMul * dt;
      const dy = BG_DRIFT_Y * layer.speedMul * dt;
      for (const star of layer.stars) {
        star.x += dx * star.speedMul;
        star.y += dy * star.speedMul;

        if (star.x < 0) star.x += this.w;
        if (star.x > this.w) star.x -= this.w;
        if (star.y < 0) star.y += this.h;
        if (star.y > this.h) star.y -= this.h;
      }
    }

    for (const mote of this.dust) {
      mote.x += DUST_DRIFT_X * mote.speedMul * dt;
      mote.y += DUST_DRIFT_Y * mote.speedMul * dt;

      if (mote.x < 0) mote.x += this.w;
      if (mote.x > this.w) mote.x -= this.w;
      if (mote.y < 0) mote.y += this.h;
      if (mote.y > this.h) mote.y -= this.h;
    }

    for (const planet of this.planets) {
      planet.x += planet.dir * planet.driftSpeed * dt;
      if (planet.x > planet.x0 + planet.driftRange) {
        planet.x = planet.x0 + planet.driftRange;
        planet.dir = -1;
      }
      if (planet.x < planet.x0 - planet.driftRange) {
        planet.x = planet.x0 - planet.driftRange;
        planet.dir = 1;
      }
      planet.y = planet.y0 + Math.sin(this.time * planet.floatFreq + planet.floatPhase) * 8;
    }

    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      const fromTop = Math.random() > 0.45;
      const x = fromTop ? Math.random() * this.w : randomRange(-80, this.w * 0.18);
      const y = fromTop ? randomRange(-80, this.h * 0.25) : randomRange(0, this.h * 0.25);
      const tint = Math.random() < 0.7
        ? { h: randomRange(40, 55), s: randomRange(0, 14), l: randomRange(84, 96) }
        : { h: randomRange(40, 55), s: randomRange(30, 55), l: randomRange(80, 92) };

      this.shootingStars.push({
        x,
        y,
        vx: randomRange(520, 860),
        vy: randomRange(240, 520),
        maxLife: randomRange(0.35, 0.65),
        life: 0,
        len: randomRange(200, 380),
        width: randomRange(1, 3),
        baseAlpha: randomRange(0.45, 0.8),
        ...tint,
      });
      this.shootingStars[this.shootingStars.length - 1].life = this.shootingStars[this.shootingStars.length - 1].maxLife;

      this.shootTimer = randomRange(8, 14);
    }

    this.shootingStars = this.shootingStars.filter((star) => {
      star.x += star.vx * dt;
      star.y += star.vy * dt;
      star.life -= dt;

      return star.life > 0 && star.x > -300 && star.y > -300 && star.x < this.w + 300 && star.y < this.h + 300;
    });
  }

  #drawPlanets(ctx, targetLayer) {
    for (const planet of this.planets) {
      if (planet.layer !== targetLayer) continue;
      const img = planet.img;
      if (!img || !img.complete || img.naturalWidth === 0) continue;

      const drawW = img.naturalWidth * planet.scale;
      const drawH = img.naturalHeight * planet.scale;
      const radius = Math.max(drawW, drawH) * 0.5;

      const halo = ctx.createRadialGradient(
        planet.x,
        planet.y,
        radius * 0.08,
        planet.x,
        planet.y,
        radius * planet.haloRadiusMul,
      );
      halo.addColorStop(0, `hsla(${planet.tint.h.toFixed(1)}, ${Math.max(5, planet.tint.s * 0.75).toFixed(1)}%, ${Math.min(95, planet.tint.l + 3).toFixed(1)}%, ${planet.haloAlpha.toFixed(3)})`);
      halo.addColorStop(1, `hsla(${planet.tint.h.toFixed(1)}, ${Math.max(3, planet.tint.s * 0.4).toFixed(1)}%, ${planet.tint.l.toFixed(1)}%, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, radius * planet.haloRadiusMul, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = planet.alpha;
      ctx.drawImage(img, planet.x - drawW * 0.5, planet.y - drawH * 0.5, drawW, drawH);

      const shade = ctx.createRadialGradient(
        planet.x + radius * 0.26,
        planet.y + radius * 0.26,
        radius * 0.08,
        planet.x + radius * 0.26,
        planet.y + radius * 0.26,
        radius,
      );
      shade.addColorStop(0, `rgba(0, 0, 0, ${planet.shadeAlpha.toFixed(3)})`);
      shade.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  draw(ctx) {
    const bg = ctx.createLinearGradient(0, 0, this.w, this.h);
    bg.addColorStop(0, "hsl(224, 62%, 14%)");
    bg.addColorStop(0.45, "hsl(238, 65%, 10%)");
    bg.addColorStop(1, "hsl(256, 70%, 8%)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const glow = 1 + this.ambienceFactor * 0.35;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const drawLayerStars = (i) => {
      const layer = this.layers[i];
      for (const star of layer.stars) {
        const twinkle = star.twinkle
          ? 1 + Math.sin(this.time * star.speed + star.phase) * star.amplitude
          : 0.88 + 0.12 * Math.sin(this.time * (1.2 + i * 0.5) + (star.x + star.y) * 0.01);
        const alpha = Math.min(1, star.a * twinkle * glow);
        ctx.fillStyle = `hsla(${star.h.toFixed(1)}, ${star.s.toFixed(1)}%, ${star.l.toFixed(1)}%, ${alpha.toFixed(4)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawLayerStars(0);
    for (const mote of this.dust) {
      ctx.fillStyle = `rgba(255, 255, 255, ${mote.alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
      ctx.fill();
    }
    this.#drawPlanets(ctx, 0);
    drawLayerStars(1);
    this.#drawPlanets(ctx, 1);
    this.#drawPlanets(ctx, 2);
    drawLayerStars(2);

    for (const streak of this.shootingStars) {
      const t = streak.life / streak.maxLife;
      const alpha = streak.baseAlpha * t;
      const mag = Math.hypot(streak.vx, streak.vy) || 1;
      const dx = streak.vx / mag;
      const dy = streak.vy / mag;

      ctx.globalAlpha = 1;
      ctx.strokeStyle = `hsla(${streak.h.toFixed(1)}, ${streak.s.toFixed(1)}%, ${streak.l.toFixed(1)}%, ${alpha.toFixed(4)})`;
      ctx.lineWidth = streak.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      ctx.lineTo(streak.x - dx * streak.len, streak.y - dy * streak.len);
      ctx.stroke();
    }

    ctx.restore();
  }

  render(ctx) {
    this.draw(ctx);
  }
}
