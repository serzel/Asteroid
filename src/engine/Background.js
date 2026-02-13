const STAR_COLORS = [
  "rgba(255,255,255,1)",
  "rgba(255,250,220,1)",
  "rgba(255,238,180,1)",
  "rgba(255,220,130,1)",
  "rgba(255,190,90,1)",
  "rgba(255,160,70,1)",
];

export class Background {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.time = 0;

    this.starLayers = [
      { count: 160, speedX: 0.01, speedY: 0.02, stars: [] },
      { count: 110, speedX: 0.02, speedY: 0.05, stars: [] },
      { count: 60, speedX: 0.03, speedY: 0.1, stars: [] },
    ];

    for (const layer of this.starLayers) {
      for (let i = 0; i < layer.count; i++) {
        const roll = Math.random();
        const isHero = roll >= 0.97;
        const isMedium = !isHero && roll >= 0.8;

        let size = 1 + Math.random() * 0.6;
        if (isMedium) size = 1.7 + Math.random() * 0.6;
        if (isHero) size = 2.4 + Math.random() * 0.8;

        layer.stars.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          size,
          color: this.#pickStarColor(),
          baseAlpha: isHero ? 0.72 + Math.random() * 0.24 : 0.28 + Math.random() * 0.52,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.45 + Math.random() * 1.1,
          driftX: (Math.random() * 2 - 1) * 0.01,
          driftY: (Math.random() * 2 - 1) * 0.014,
          isHero,
          heroBlur: 8 + Math.random() * 4,
          twinkleBoost: 0,
        });
      }
    }

    this.clouds = [];
    const cloudCount = 8 + Math.floor(Math.random() * 5);
    const minSize = Math.min(this.w, this.h);
    const radiusFloor = Math.max(220, minSize * 0.24);
    const radiusCeil = Math.min(650, Math.max(radiusFloor + 1, minSize * 0.68));

    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: radiusFloor + Math.random() * (radiusCeil - radiusFloor),
        hueOffset: -10 + Math.random() * 35,
        alpha: 0.04 + Math.random() * 0.05,
        driftX: (Math.random() * 2 - 1) * 0.01,
        driftY: (Math.random() * 2 - 1) * 0.01,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.shooters = [];
    this.shooterMinDelay = 2.5;
    this.shooterMaxDelay = 7.0;
    this.shooterSpawnCooldown = this.#rand(this.shooterMinDelay, this.shooterMaxDelay);
    this.maxShooters = 2;

    this.planet = {
      x: this.w * 0.15,
      y: this.h * 0.65,
      r: Math.min(this.w, this.h) * 0.12,
      vx: 6,
      vy: -2,
      hueOffset: 30,
      alpha: 0.22,
      ringTilt: 0.35,
      ringAlpha: 0.1,
    };
  }

  #rand(min, max) {
    return min + Math.random() * (max - min);
  }

  #pickStarColor() {
    const roll = Math.random();
    if (roll < 0.43) return STAR_COLORS[0];
    if (roll < 0.72) return STAR_COLORS[1];
    if (roll < 0.87) return STAR_COLORS[2];
    if (roll < 0.95) return STAR_COLORS[3];
    if (roll < 0.985) return STAR_COLORS[4];
    return STAR_COLORS[5];
  }

  #clamp(min, max, value) {
    return Math.max(min, Math.min(max, value));
  }

  #spawnShooter() {
    if (this.shooters.length >= this.maxShooters) return;

    let x;
    let y;
    if (Math.random() < 0.5) {
      x = Math.random() * this.w;
      y = -30;
    } else {
      x = -30;
      y = Math.random() * this.h;
    }

    const angle = this.#rand(20, 55) * (Math.PI / 180);
    const speed = this.#rand(900, 1400);

    this.shooters.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: this.#rand(0.35, 0.75),
      size: this.#rand(1, 2),
      color: Math.random() < 0.5 ? "rgba(255,245,220,1)" : "rgba(255,230,180,1)",
      didTwinkle: false,
    });
  }

  #triggerShooterTwinkle() {
    const allStars = [];
    for (const layer of this.starLayers) allStars.push(...layer.stars);
    if (allStars.length === 0) return;

    const picks = Math.min(6, allStars.length);
    for (let i = 0; i < picks; i++) {
      const idx = Math.floor(Math.random() * allStars.length);
      allStars[idx].twinkleBoost = 0.6;
    }
  }

  resize(w, h) {
    this.w = w;
    this.h = h;

    for (const layer of this.starLayers) {
      for (const s of layer.stars) {
        s.x = Math.random() * w;
        s.y = Math.random() * h;
      }
    }

    for (const c of this.clouds) {
      c.x = Math.random() * w;
      c.y = Math.random() * h;
    }

    if (this.planet) {
      this.planet.x = w * 0.15;
      this.planet.y = h * 0.65;
      this.planet.r = Math.min(w, h) * 0.12;
    }
  }

  update(dt) {
    this.time += dt;

    for (const layer of this.starLayers) {
      for (const star of layer.stars) {
        star.x += (layer.speedX + star.driftX) * 60 * dt;
        star.y += (layer.speedY + star.driftY) * 60 * dt;
        star.twinkleBoost = Math.max(0, star.twinkleBoost - 1.5 * dt);

        if (star.x < 0) star.x += this.w;
        if (star.x > this.w) star.x -= this.w;
        if (star.y < 0) star.y += this.h;
        if (star.y > this.h) star.y -= this.h;
      }
    }

    for (const cloud of this.clouds) {
      cloud.x += cloud.driftX * 60 * dt;
      cloud.y += cloud.driftY * 60 * dt;

      if (cloud.x < 0) cloud.x += this.w;
      if (cloud.x > this.w) cloud.x -= this.w;
      if (cloud.y < 0) cloud.y += this.h;
      if (cloud.y > this.h) cloud.y -= this.h;
    }

    if (this.planet) {
      this.planet.x += this.planet.vx * dt;
      this.planet.y += this.planet.vy * dt;

      const { x, y, r } = this.planet;
      if (x - r > this.w + 200) this.planet.x = -200 - r;
      if (y + r < -200) this.planet.y = this.h + 200 + r;
      if (y - r > this.h + 200) this.planet.y = -200 - r;
    }

    this.shooterSpawnCooldown -= dt;
    if (this.shooterSpawnCooldown <= 0) {
      this.#spawnShooter();
      this.shooterSpawnCooldown = this.#rand(this.shooterMinDelay, this.shooterMaxDelay);
    }

    let write = 0;
    for (let i = 0; i < this.shooters.length; i++) {
      const shooter = this.shooters[i];
      shooter.x += shooter.vx * dt;
      shooter.y += shooter.vy * dt;
      shooter.life += dt;

      const progress = shooter.life / shooter.maxLife;
      if (!shooter.didTwinkle && progress > 0.25) {
        shooter.didTwinkle = true;
        this.#triggerShooterTwinkle();
      }

      const isExpired = shooter.life >= shooter.maxLife;
      const outBounds =
        shooter.x < -150 || shooter.x > this.w + 150 || shooter.y < -150 || shooter.y > this.h + 150;

      if (!isExpired && !outBounds) {
        this.shooters[write] = shooter;
        write += 1;
      }
    }
    this.shooters.length = write;
  }

  render(ctx) {
    const baseHue = 215 + Math.sin(this.time * 0.18) * 18;
    const accentHue = (baseHue + 35) % 360;

    const bg = ctx.createLinearGradient(0, 0, this.w, this.h);
    bg.addColorStop(0, `hsl(${baseHue}, 65%, 18%)`);
    bg.addColorStop(0.5, `hsl(${baseHue + 15}, 70%, 14%)`);
    bg.addColorStop(1, `hsl(${baseHue + 30}, 65%, 10%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const vignette = ctx.createRadialGradient(
      this.w * 0.5,
      this.h * 0.5,
      Math.min(this.w, this.h) * 0.2,
      this.w * 0.5,
      this.h * 0.5,
      Math.max(this.w, this.h) * 0.72
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.w, this.h);

    if (this.planet) {
      const p = this.planet;
      const hue = accentHue + p.hueOffset;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const planetGrad = ctx.createRadialGradient(
        p.x - p.r * 0.3,
        p.y - p.r * 0.3,
        p.r * 0.2,
        p.x,
        p.y,
        p.r
      );
      planetGrad.addColorStop(0, `hsla(${hue},70%,55%,${p.alpha})`);
      planetGrad.addColorStop(1, `hsla(${hue + 20},70%,20%,${p.alpha})`);

      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = `hsla(${hue + 10},70%,70%,1)`;
      ctx.globalAlpha = p.alpha * 0.4;
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + i * p.r * 0.22, p.r * 0.95, p.r * (0.16 + (i + 1) * 0.02), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.globalAlpha = p.ringAlpha;
      ctx.strokeStyle = `hsla(${hue + 15},80%,70%,1)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 1.35, p.r * 0.55, p.ringTilt, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const cloud of this.clouds) {
      const cloudGrad = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
      cloudGrad.addColorStop(0, `hsla(${baseHue + cloud.hueOffset}, 85%, 45%, ${cloud.alpha})`);
      cloudGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const shooter of this.shooters) {
      const progress = shooter.life / shooter.maxLife;
      const alpha = (1 - progress) * 0.9;
      const speed = Math.hypot(shooter.vx, shooter.vy) || 1;
      const tail = this.#clamp(80, 160, 120 * (speed / 1200));

      const x2 = shooter.x - (shooter.vx / speed) * tail;
      const y2 = shooter.y - (shooter.vy / speed) * tail;

      ctx.strokeStyle = shooter.color;
      ctx.globalAlpha = alpha * 0.7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shooter.x, shooter.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 12;
      ctx.shadowColor = shooter.color;
      ctx.fillStyle = shooter.color;
      ctx.fillRect(shooter.x, shooter.y, shooter.size + 1, shooter.size + 1);
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    for (const layer of this.starLayers) {
      for (const star of layer.stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(this.time * star.twinkleSpeed + star.twinklePhase);
        let alphaFinal = star.baseAlpha * (0.65 + 0.35 * twinkle);
        alphaFinal *= 1 + star.twinkleBoost * 0.35;
        alphaFinal = Math.min(1.2, alphaFinal);

        ctx.globalAlpha = alphaFinal;
        ctx.fillStyle = star.color;

        if (star.isHero) {
          ctx.shadowBlur = star.heroBlur;
          ctx.shadowColor = star.color;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillRect(star.x, star.y, star.size, star.size);

        if (star.isHero) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = star.color;
          ctx.globalAlpha = 0.25 * alphaFinal;
          ctx.lineWidth = 1;

          ctx.beginPath();
          ctx.moveTo(star.x - 6, star.y + 0.5);
          ctx.lineTo(star.x + 6, star.y + 0.5);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(star.x + 0.5, star.y - 6);
          ctx.lineTo(star.x + 0.5, star.y + 6);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.globalCompositeOperation = "source-over";
  }
}
