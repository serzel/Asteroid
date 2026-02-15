const BG_LAYER_CONFIG = [
  { density: 0.00022, speedMul: 0.18, alphaMin: 0.16, alphaMax: 0.4, radiusMin: 0.65, radiusMax: 1.35 },
  { density: 0.00016, speedMul: 0.42, alphaMin: 0.22, alphaMax: 0.56, radiusMin: 0.95, radiusMax: 2.0 },
  { density: 0.00009, speedMul: 0.8, alphaMin: 0.34, alphaMax: 0.86, radiusMin: 1.2, radiusMax: 2.9 },
];

const BG_DRIFT_X = 9;
const BG_DRIFT_Y = 5;
const DEFAULT_PLANET_SIZE = 256;
const DEBUG_NEBULA = false;

const randomRange = (min, max) => min + Math.random() * (max - min);

const circleIntersectsRect = (x, y, radius, rect) => {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return (dx * dx + dy * dy) <= radius * radius;
};

const pickStarTint = () => {
  const roll = Math.random();
  if (roll < 0.68) {
    return { h: randomRange(36, 52), s: randomRange(4, 14), l: randomRange(88, 97) };
  }
  if (roll < 0.9) {
    return { h: randomRange(186, 205), s: randomRange(34, 64), l: randomRange(82, 95) };
  }
  if (roll < 0.97) {
    return { h: randomRange(292, 315), s: randomRange(36, 68), l: randomRange(78, 90) };
  }
  return { h: randomRange(12, 28), s: randomRange(45, 72), l: randomRange(74, 88) };
};

const pickStarSize = () => {
  const roll = Math.random();
  if (roll < 0.7) return { mul: randomRange(0.68, 1), large: false };
  if (roll < 0.95) return { mul: randomRange(1, 1.35), large: false };
  return { mul: randomRange(1.35, 1.85), large: true };
};

const buildStarTwinkle = () => {
  if (Math.random() > randomRange(0.12, 0.18)) {
    return { twinkle: false, phase: 0, speed: 0, amplitude: 0 };
  }

  return {
    twinkle: true,
    phase: randomRange(0, Math.PI * 2),
    speed: randomRange(0.25, 0.75),
    amplitude: randomRange(0.08, 0.16),
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
    this.shootTimer = randomRange(7, 13);
    this.nebula = null;
    this.nebulaDebugLastLog = 0;

    this.glowImg = new Image();
    this.glowImg.src = new URL("../../assets/glow_soft.png", import.meta.url);

    this.nebulaImgs = [];
    for (const path of ["../../assets/nebula_neon_01.png", "../../assets/nebula_neon_02.png"]) {
      const img = new Image();
      img.src = new URL(path, import.meta.url);
      this.nebulaImgs.push(img);
    }

    this.noiseGrainImg = new Image();
    this.noiseGrainImg.src = new URL("../../assets/noise_grain.png", import.meta.url);
    this.noiseScanlinesImg = new Image();
    this.noiseScanlinesImg.src = new URL("../../assets/noise_scanlines.png", import.meta.url);

    for (let i = 1; i <= 6; i++) {
      const img = new Image();
      img.src = new URL(`../../assets/planet_0${i}.png`, import.meta.url);
      this.planetImgs.push(img);
    }

    this.resize(width, height);
  }

  #isImageReady(img) {
    return !!img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
  }

  #resetLayerState(ctx) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;
  }

  #planetRadiusFor(img, scale) {
    const base = this.#isImageReady(img) ? Math.max(img.naturalWidth, img.naturalHeight) : DEFAULT_PLANET_SIZE;
    return base * scale * 0.5;
  }

  #buildLayer(config) {
    const area = this.w * this.h;
    const count = Math.max(35, Math.floor(area * config.density));
    const stars = [];

    for (let i = 0; i < count; i++) {
      const size = pickStarSize();
      stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: (config.radiusMin + Math.random() * (config.radiusMax - config.radiusMin)) * size.mul,
        a: config.alphaMin + Math.random() * (config.alphaMax - config.alphaMin),
        speedMul: config.speedMul * (0.65 + Math.random() * 0.7),
        large: size.large,
        glowMul: size.large ? randomRange(2, 3.5) : 0,
        glowAlpha: size.large ? randomRange(0.05, 0.1) : 0,
        ...pickStarTint(),
        ...buildStarTwinkle(),
      });
    }

    return { ...config, stars };
  }

  #pickNebulaStart() {
    const forbidden = {
      x: this.w * 0.2,
      y: this.h * 0.2,
      w: this.w * 0.6,
      h: this.h * 0.6,
    };
    const size = Math.max(this.w, this.h) * randomRange(1.25, 1.75);

    let x = randomRange(this.w * 0.1, this.w * 0.9);
    let y = randomRange(this.h * 0.1, this.h * 0.9);
    for (let tries = 0; tries < 30; tries++) {
      if (!circleIntersectsRect(x, y, size * 0.18, forbidden)) break;
      x = randomRange(this.w * 0.04, this.w * 0.96);
      y = randomRange(this.h * 0.04, this.h * 0.96);
    }

    return {
      img: this.nebulaImgs[Math.floor(Math.random() * this.nebulaImgs.length)],
      x,
      y,
      size,
      alpha: randomRange(0.14, 0.24),
      glowAlpha: randomRange(0.07, 0.13),
      vx: randomRange(1, 4) * (Math.random() > 0.5 ? 1 : -1),
      vy: randomRange(1, 4) * (Math.random() > 0.5 ? 1 : -1),
    };
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.layers = BG_LAYER_CONFIG.map((config) => this.#buildLayer(config));
    this.nebula = this.#pickNebulaStart();

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

    const blockedZones = [gameplayForbidden, ...hudZones];
    const isBlocked = (x, y, radius) => blockedZones.some((zone) => circleIntersectsRect(x, y, radius, zone));

    const picks = [];
    const bigCount = Math.floor(randomRange(1, 3));
    for (let i = 0; i < bigCount; i++) picks.push({ scaleMin: 0.7, scaleMax: 0.92, layer: 0 });
    if (Math.random() < 0.8) picks.push({ scaleMin: 0.5, scaleMax: 0.68, layer: 1 });
    const smallCount = Math.floor(randomRange(1, 3));
    for (let i = 0; i < smallCount; i++) picks.push({ scaleMin: 0.28, scaleMax: 0.45, layer: 2 });

    this.planets = [];
    for (const pick of picks) {
      const img = this.planetImgs[Math.floor(Math.random() * this.planetImgs.length)];
      const scale = randomRange(pick.scaleMin, pick.scaleMax);
      const radius = this.#planetRadiusFor(img, scale);

      let x = Math.random() * this.w;
      let y = randomRange(this.h * 0.08, this.h * 0.92);
      let placed = false;

      for (let tries = 0; tries < 40; tries++) {
        const overlap = this.planets.some((other) => {
          const dx = x - other.x;
          const dy = y - other.y;
          const minDist = 1.2 * Math.max(radius, other.radius);
          return (dx * dx + dy * dy) < (minDist * minDist);
        });

        if (!isBlocked(x, y, radius) && !overlap) {
          placed = true;
          break;
        }

        x = Math.random() * this.w;
        y = randomRange(this.h * 0.08, this.h * 0.92);
      }

      if (!placed) continue;

      this.planets.push({
        img,
        x0: x,
        y0: y,
        x,
        y,
        radius,
        driftRange: randomRange(90, 200),
        driftSpeed: randomRange(2.5, 8),
        dir: Math.random() > 0.5 ? 1 : -1,
        alpha: randomRange(0.18, 0.35),
        scale,
        layer: pick.layer,
        floatFreq: randomRange(0.09, 0.2),
        floatPhase: randomRange(0, Math.PI * 2),
        haloTint: Math.random() < 0.65 ? "cyan" : "magenta",
        haloRadiusMul: randomRange(1.3, 1.8),
        haloAlpha: randomRange(0.06, 0.14),
        haloSizeMul: randomRange(2.6, 3.6),
      });
    }

    this.shootingStars = [];
    this.shootTimer = randomRange(7, 13);
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

    if (this.nebula) {
      this.nebula.x += this.nebula.vx * dt;
      this.nebula.y += this.nebula.vy * dt;
      const margin = this.nebula.size * 0.2;
      if (this.nebula.x < -margin) this.nebula.x = this.w + margin;
      if (this.nebula.x > this.w + margin) this.nebula.x = -margin;
      if (this.nebula.y < -margin) this.nebula.y = this.h + margin;
      if (this.nebula.y > this.h + margin) this.nebula.y = -margin;
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
      const x = fromTop ? Math.random() * this.w : randomRange(-80, this.w * 0.2);
      const y = fromTop ? randomRange(-80, this.h * 0.2) : randomRange(0, this.h * 0.26);
      const tone = Math.random() < 0.8
        ? { r: 225, g: 250, b: 255 }
        : { r: 190, g: 245, b: 255 };

      this.shootingStars.push({
        x,
        y,
        vx: randomRange(520, 860),
        vy: randomRange(240, 520),
        maxLife: randomRange(0.35, 0.65),
        life: 0,
        len: randomRange(190, 340),
        width: randomRange(1.1, 2.8),
        baseAlpha: randomRange(0.45, 0.8),
        offset: randomRange(1, 2),
        headGlowAlpha: randomRange(0.06, 0.12),
        ...tone,
      });
      this.shootingStars[this.shootingStars.length - 1].life = this.shootingStars[this.shootingStars.length - 1].maxLife;

      this.shootTimer = randomRange(7, 13);
    }

    this.shootingStars = this.shootingStars.filter((star) => {
      star.x += star.vx * dt;
      star.y += star.vy * dt;
      star.life -= dt;

      return star.life > 0 && star.x > -300 && star.y > -300 && star.x < this.w + 300 && star.y < this.h + 300;
    });
  }

  #drawNebula(ctx) {
    if (DEBUG_NEBULA) {
      const now = performance.now() * 0.001;
      if (now - this.nebulaDebugLastLog >= 1) {
        console.log("[nebula] draw entry");
        this.nebulaDebugLastLog = now;
      }
    }

    if (!this.nebula) return;

    const { img, x, y, size, alpha, glowAlpha } = this.nebula;
    if (!this.#isImageReady(img)) return;

    const drawX = x - size * 0.5;
    const drawY = y - size * 0.5;
    const composite = "source-over";

    this.#resetLayerState(ctx);
    ctx.globalCompositeOperation = composite;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, drawX, drawY, size, size);

    ctx.globalAlpha = glowAlpha;
    ctx.drawImage(img, x - size * 0.52, y - size * 0.52, size * 1.04, size * 1.04);

    if (DEBUG_NEBULA) {
      const now = performance.now() * 0.001;
      if (now - this.nebulaDebugLastLog >= 1) {
        console.log("[nebula]", {
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          x: drawX,
          y: drawY,
          size,
          alpha,
          comp: composite,
        });
        this.nebulaDebugLastLog = now;
      }
    }

    if (DEBUG_NEBULA) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(8, 8, 420, 108);
      ctx.fillStyle = "#7ef5ff";
      ctx.font = "12px monospace";
      ctx.textBaseline = "top";
      const lines = [
        `nebula complete: ${img.complete}`,
        `natural: ${img.naturalWidth} x ${img.naturalHeight}`,
        `draw rect: ${drawX.toFixed(1)}, ${drawY.toFixed(1)}, ${size.toFixed(1)}, ${size.toFixed(1)}`,
        `alpha: ${alpha.toFixed(3)}`,
        `composite: ${composite}`,
      ];
      lines.forEach((line, i) => ctx.fillText(line, 16, 16 + i * 18));
      ctx.restore();
    }

    this.#resetLayerState(ctx);
  }

  #drawStarLayers(ctx, indices) {
    this.#resetLayerState(ctx);
    const glowReady = this.#isImageReady(this.glowImg);

    for (const i of indices) {
      const layer = this.layers[i];
      for (const star of layer.stars) {
        const twinkle = star.twinkle
          ? 1 + Math.sin(this.time * star.speed + star.phase) * star.amplitude
          : 1;
        const alpha = Math.min(1, star.a * twinkle);

        if (star.large && glowReady) {
          const glowSize = star.r * star.glowMul;
          ctx.save();
          ctx.globalAlpha = star.glowAlpha * alpha;
          ctx.drawImage(this.glowImg, star.x - glowSize * 0.5, star.y - glowSize * 0.5, glowSize, glowSize);
          ctx.restore();
        }

        ctx.fillStyle = `hsla(${star.h.toFixed(1)}, ${star.s.toFixed(1)}%, ${star.l.toFixed(1)}%, ${alpha.toFixed(4)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  #drawPlanets(ctx, layers) {
    this.#resetLayerState(ctx);

    for (const planet of this.planets) {
      if (!layers.includes(planet.layer)) continue;

      const img = planet.img;
      const radius = planet.radius;

      if (this.#isImageReady(img)) {
        ctx.globalAlpha = planet.alpha;
        ctx.drawImage(img, planet.x - radius, planet.y - radius, radius * 2, radius * 2);
      } else {
        const fallback = ctx.createRadialGradient(planet.x, planet.y, radius * 0.2, planet.x, planet.y, radius);
        fallback.addColorStop(0, "rgba(210,230,255,0.25)");
        fallback.addColorStop(1, "rgba(40,58,90,0.02)");
        ctx.fillStyle = fallback;
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this.#resetLayerState(ctx);
  }

  #drawShootingStars(ctx) {
    if (!this.shootingStars.length) return;

    this.#resetLayerState(ctx);
    const glowReady = this.#isImageReady(this.glowImg);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const streak of this.shootingStars) {
      const t = streak.life / streak.maxLife;
      const alpha = streak.baseAlpha * t;
      const mag = Math.hypot(streak.vx, streak.vy) || 1;
      const dx = streak.vx / mag;
      const dy = streak.vy / mag;
      const nx = -dy;
      const ny = dx;

      ctx.lineCap = "round";
      ctx.strokeStyle = `rgba(${streak.r}, ${streak.g}, ${streak.b}, ${alpha.toFixed(4)})`;
      ctx.lineWidth = streak.width;
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      ctx.lineTo(streak.x - dx * streak.len, streak.y - dy * streak.len);
      ctx.stroke();

      const shiftedX = streak.x + nx * streak.offset;
      const shiftedY = streak.y + ny * streak.offset;
      ctx.strokeStyle = `rgba(210, 45, 255, ${(alpha * 0.5).toFixed(4)})`;
      ctx.lineWidth = Math.max(1, streak.width * 0.75);
      ctx.beginPath();
      ctx.moveTo(shiftedX, shiftedY);
      ctx.lineTo(shiftedX - dx * streak.len * 0.92, shiftedY - dy * streak.len * 0.92);
      ctx.stroke();

      if (glowReady) {
        const glowSize = streak.width * 14;
        ctx.globalAlpha = streak.headGlowAlpha * t;
        ctx.drawImage(this.glowImg, streak.x - glowSize * 0.5, streak.y - glowSize * 0.5, glowSize, glowSize);
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  #drawNeonGrade(ctx) {
    this.#resetLayerState(ctx);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = "rgba(0,180,255,1)";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = "rgba(200,0,255,1)";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();

    const vignette = ctx.createRadialGradient(
      this.w * 0.5,
      this.h * 0.5,
      Math.min(this.w, this.h) * 0.2,
      this.w * 0.5,
      this.h * 0.5,
      Math.max(this.w, this.h) * 0.72,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.6, "rgba(0,0,0,0)");
    vignette.addColorStop(0.85, "rgba(0,120,255,0.05)");
    vignette.addColorStop(1, "rgba(185,0,255,0.08)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.w, this.h);
    this.#resetLayerState(ctx);
  }

  #drawNoiseTile(ctx, img, alpha) {
    if (!this.#isImageReady(img)) return;

    this.#resetLayerState(ctx);
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = alpha;
    const tileW = img.naturalWidth;
    const tileH = img.naturalHeight;

    for (let y = 0; y < this.h; y += tileH) {
      for (let x = 0; x < this.w; x += tileW) {
        ctx.drawImage(img, x, y, tileW, tileH);
      }
    }
    this.#resetLayerState(ctx);
  }

  draw(ctx) {
    this.#resetLayerState(ctx);
    const bg = ctx.createLinearGradient(0, 0, this.w, this.h);
    bg.addColorStop(0, "hsl(224, 72%, 6%)");
    bg.addColorStop(0.5, "hsl(238, 70%, 5%)");
    bg.addColorStop(1, "hsl(258, 78%, 4%)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    this.#drawNebula(ctx);
    this.#drawStarLayers(ctx, [0]);
    this.#drawPlanets(ctx, [0, 1, 2]);
    this.#drawStarLayers(ctx, [1, 2]);
    this.#drawShootingStars(ctx);
    this.#drawNeonGrade(ctx);
    this.#drawNoiseTile(ctx, this.noiseGrainImg, 0.025);
    this.#drawNoiseTile(ctx, this.noiseScanlinesImg, 0.018);
    this.#resetLayerState(ctx);
  }

  render(ctx) {
    this.draw(ctx);
  }
}
