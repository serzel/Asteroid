export class Background {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.time = 0;

    this.starLayers = [
      { speed: 0.02, alpha: 0.5, stars: [] },
      { speed: 0.05, alpha: 0.75, stars: [] },
      { speed: 0.1, alpha: 1, stars: [] },
    ];

    for (const layer of this.starLayers) {
      for (let i = 0; i < 100; i++) {
        layer.stars.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          size: 1 + Math.random(),
        });
      }
    }
  }

  update(dt) {
    this.time += dt;

    for (const layer of this.starLayers) {
      for (const star of layer.stars) {
        star.y += layer.speed * 60 * dt;

        if (star.y > this.h) {
          star.y = 0;
          star.x = Math.random() * this.w;
        }
      }
    }
  }

  render(ctx) {
    const hue = (this.time * 8) % 360;

    const grad = ctx.createRadialGradient(
      this.w * 0.5,
      this.h * 0.5,
      0,
      this.w * 0.5,
      this.h * 0.5,
      this.w * 0.9,
    );

    grad.addColorStop(0, `hsla(${hue}, 60%, 30%, 1)`);
    grad.addColorStop(1, `hsla(${(hue + 60) % 360}, 60%, 10%, 1)`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.fillStyle = "white";
    for (const layer of this.starLayers) {
      ctx.globalAlpha = layer.alpha;
      for (const star of layer.stars) {
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }
    }

    ctx.globalAlpha = 1;
  }
}
