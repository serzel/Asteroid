export class Background {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.time = 0;

    this.starLayers = [
      {
        count: 140,
        speedX: -0.004,
        speedY: 0.012,
        sizeMin: 1,
        sizeMax: 1.4,
        alphaMin: 0.15,
        alphaMax: 0.45,
        stars: [],
      },
      {
        count: 90,
        speedX: 0.008,
        speedY: 0.02,
        sizeMin: 1,
        sizeMax: 1.7,
        alphaMin: 0.28,
        alphaMax: 0.68,
        stars: [],
      },
      {
        count: 50,
        speedX: 0.014,
        speedY: 0.03,
        sizeMin: 1.2,
        sizeMax: 2,
        alphaMin: 0.45,
        alphaMax: 0.9,
        stars: [],
      },
    ];


    for (const layer of this.starLayers) {
      for (let i = 0; i < layer.count; i++) {
        const type = this.#pickStarType();
        layer.stars.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          type,
          size: this.#pickStarSize(type),
          colorVariant: Math.floor(Math.random() * 3),
          color: type === "hero" ? this.#pickHeroStarColor() : null,
          baseAlpha: this.#pickStarBaseAlpha(layer, type),
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.4 + Math.random(),
          driftX: (Math.random() * 2 - 1) * 0.015,
          driftY: (Math.random() * 2 - 1) * 0.02,
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
        phase: Math.random() * Math.PI * 2,
        driftX: (Math.random() * 2 - 1) * 0.01,
        driftY: (Math.random() * 2 - 1) * 0.01,
        hueOffset: -10 + Math.random() * 35,
        alpha: 0.04 + Math.random() * 0.05,
      });
    }
  }

  #pickStarType() {
    const roll = Math.random();
    if (roll < 0.8) return "small";
    if (roll < 0.97) return "medium";
    return "hero";
  }

  #pickStarSize(type) {
    if (type === "small") return 1.0 + Math.random() * 0.6;
    if (type === "medium") return 1.7 + Math.random() * 0.6;
    return 2.4 + Math.random() * 0.8;
  }

  #pickStarBaseAlpha(layer, type) {
    if (type === "hero") return 0.75 + Math.random() * 0.25;
    return layer.alphaMin + Math.random() * (layer.alphaMax - layer.alphaMin);
  }

  #pickHeroStarColor() {
    return Math.random() < 0.55 ? "rgba(255,250,232,1)" : "rgba(255,245,215,1)";
  }

  resize(w, h) {
    const oldW = this.w;
    const oldH = this.h;

    this.w = w;
    this.h = h;

    if (oldW === this.w && oldH === this.h) return;

    for (const layer of this.starLayers) {
      for (const s of layer.stars) {
        s.x = Math.random() * this.w;
        s.y = Math.random() * this.h;
      }
    }

    if (this.clouds) {
      const minSize = Math.min(this.w, this.h);
      const radiusFloor = Math.max(220, minSize * 0.24);
      const radiusCeil = Math.min(650, Math.max(radiusFloor + 1, minSize * 0.68));
      for (const c of this.clouds) {
        c.x = Math.random() * this.w;
        c.y = Math.random() * this.h;
        c.r = radiusFloor + Math.random() * (radiusCeil - radiusFloor);
      }
    }
  }

  update(dt) {
    this.time += dt;

    for (const layer of this.starLayers) {
      for (const star of layer.stars) {
        star.x += (layer.speedX + star.driftX) * 60 * dt;
        star.y += (layer.speedY + star.driftY) * 60 * dt;

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
  }

  render(ctx) {
    const baseHue = 215 + Math.sin(this.time * 0.18) * 18;
    const accentHue = (baseHue + 35) % 360;

    const grad = ctx.createLinearGradient(0, 0, this.w, this.h);
    grad.addColorStop(0, `hsl(${baseHue}, 65%, 18%)`);
    grad.addColorStop(0.5, `hsl(${baseHue + 15}, 70%, 14%)`);
    grad.addColorStop(1, `hsl(${baseHue + 30}, 65%, 10%)`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const cloud of this.clouds) {
      const pulse = 0.9 + 0.1 * Math.sin(this.time * 0.2 + cloud.phase);
      const cloudGrad = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
      cloudGrad.addColorStop(0, `hsla(${baseHue + cloud.hueOffset}, 85%, 45%, ${cloud.alpha * pulse})`);
      cloudGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
      ctx.fillStyle = cloudGrad;
      ctx.fill();
    }

    ctx.restore();

    const starCool = `hsla(${baseHue}, 90%, 82%, 1)`;
    const starCyan = `hsla(${accentHue}, 92%, 86%, 1)`;
    const starViolet = `hsla(${(baseHue + 18) % 360}, 90%, 84%, 1)`;

    for (const layer of this.starLayers) {
      for (const star of layer.stars) {
        const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(this.time * star.twinkleSpeed + star.twinklePhase));
        const alphaFinal = star.baseAlpha * (0.65 + 0.35 * tw);
        ctx.globalAlpha = alphaFinal;

        if (star.type === "hero") {
          ctx.fillStyle = star.color;
          ctx.shadowBlur = 5;
          ctx.shadowColor = star.color;
        } else {
          ctx.shadowBlur = 0;
          if (star.colorVariant === 0) ctx.fillStyle = starCool;
          else if (star.colorVariant === 1) ctx.fillStyle = starCyan;
          else ctx.fillStyle = starViolet;
        }

        ctx.fillRect(star.x, star.y, star.size, star.size);

        if (star.type === "hero") {
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

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}
