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
        layer.stars.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          size: layer.sizeMin + Math.random() * (layer.sizeMax - layer.sizeMin),
          baseAlpha: layer.alphaMin + Math.random() * (layer.alphaMax - layer.alphaMin),
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.5 + Math.random(),
          driftX: (Math.random() * 2 - 1) * 0.015,
          driftY: (Math.random() * 2 - 1) * 0.02,
        });
      }
    }

    this.clouds = [];
    const cloudCount = 8 + Math.floor(Math.random() * 7);
    const minSize = Math.min(this.w, this.h);

    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: minSize * (0.2 + Math.random() * 0.5),
        phase: Math.random() * Math.PI * 2,
        driftX: (Math.random() * 2 - 1) * 0.003,
        driftY: (Math.random() * 2 - 1) * 0.003,
        hueOffset: -20 + Math.random() * 60,
        alpha: 0.05 + Math.random() * 0.07,
      });
    }
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
      for (const c of this.clouds) {
        c.x = Math.random() * this.w;
        c.y = Math.random() * this.h;
        c.r = minSize * (0.2 + Math.random() * 0.5);
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
    const baseHue = 220 + Math.sin(this.time * 0.2) * 20;

    const grad = ctx.createLinearGradient(0, 0, this.w, this.h);
    grad.addColorStop(0, `hsl(${baseHue}, 60%, 18%)`);
    grad.addColorStop(0.5, `hsl(${baseHue + 20}, 70%, 14%)`);
    grad.addColorStop(1, `hsl(${baseHue + 40}, 60%, 10%)`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const cloud of this.clouds) {
      const pulse = 0.85 + 0.15 * Math.sin(this.time * 0.2 + cloud.phase);
      const cloudGrad = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.r);
      cloudGrad.addColorStop(0, `hsla(${baseHue + cloud.hueOffset}, 80%, 45%, ${cloud.alpha * pulse})`);
      cloudGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
      ctx.fillStyle = cloudGrad;
      ctx.fill();
    }

    ctx.restore();

    ctx.fillStyle = "white";
    for (const layer of this.starLayers) {
      for (const star of layer.stars) {
        const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(this.time * star.twinkleSpeed + star.twinklePhase));
        const a = star.baseAlpha * (0.65 + 0.35 * tw);
        ctx.globalAlpha = a;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }
    }

    ctx.globalAlpha = 1;
  }
}
