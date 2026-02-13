import { wrap, rand } from "../engine/math.js";

export class Asteroid {
  static TYPE = {
    normal:   { speedMul: 1.0,  hpMul: 1, splitCount: 2, dashed: false, lineWidth: 1, points: 10, jitterMin: 0.75, jitterMax: 1.25, scoreMul: 1.0 },
    dense:    { speedMul: 0.75, hpMul: 2, splitCount: 2, dashed: false, lineWidth: 3, points: 11, jitterMin: 0.80, jitterMax: 1.20, scoreMul: 1.4 },
    fast:     { speedMul: 2.2,  hpMul: 1, splitCount: 0, dashed: true,  lineWidth: 1, points: 9,  jitterMin: 0.85, jitterMax: 1.15, scoreMul: 1.3 },
    splitter: { speedMul: 1.05, hpMul: 1, splitCount: 3, dashed: false, lineWidth: 2, points: 13, jitterMin: 0.70, jitterMax: 1.30, scoreMul: 1.6 },
  };

  constructor(x, y, size = 3, type = "normal") {
    this.x = x;
    this.y = y;
    this.size = size;
    this.type = type;

    const cfg = Asteroid.TYPE[this.type] ?? Asteroid.TYPE.normal;

    this.radius = size * 18 + 14;
    if (this.type === "fast") {
      this.radius *= 0.75; // 25% plus petit
    }

    // Valeur de combo selon la taille (gros/moyen/petit).
    this.comboValue = size >= 3 ? 1.0 : size === 2 ? 0.5 : 0.25;

    this.maxHp = Math.max(1, Math.round(size * cfg.hpMul));
    this.hp = this.maxHp;

    const speed = (rand(30, 90) / size) * cfg.speedMul;
    const ang = rand(0, Math.PI * 2);
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;

    this.points = this.#makeShape(cfg.points, cfg.jitterMin, cfg.jitterMax);

    this.rot = rand(0, Math.PI * 2);
    this.rotSpeed = rand(-1.2, 1.2);

    this.dead = false;
  }

  #makeShape(n = 10, jMin = 0.75, jMax = 1.25) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const jitter = rand(jMin, jMax);
      pts.push({ ang, r: jitter });
    }
    return pts;
  }

  update(dt, world) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = wrap(this.x, world.w);
    this.y = wrap(this.y, world.h);

    this.rot += this.rotSpeed * dt;
  }

  hit() {
    this.hp -= 1;
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  split() {
    if (this.size <= 1) return [];

    const cfg = Asteroid.TYPE[this.type] ?? Asteroid.TYPE.normal;
    const count = cfg.splitCount;

    if (count <= 0) return [];

    const kids = [];
    for (let i = 0; i < count; i++) {
      kids.push(new Asteroid(this.x, this.y, this.size - 1, this.type));
    }
    return kids;
  }

draw(ctx) {
  const cfg = Asteroid.TYPE[this.type] ?? Asteroid.TYPE.normal;

  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.rotate(this.rot);

  ctx.strokeStyle = "white";
  ctx.lineWidth = cfg.lineWidth;

  if (cfg.dashed) ctx.setLineDash([6, 6]);

  // contour principal
  ctx.beginPath();
  for (let i = 0; i < this.points.length; i++) {
    const p = this.points[i];
    const rr = this.radius * p.r;
    const px = Math.cos(p.ang) * rr;
    const py = Math.sin(p.ang) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  // reset dash pour ne pas impacter le reste
  ctx.setLineDash([]);

  // DENSE: noyau + ring HP
  if (this.type === "dense") {
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.25, 0, Math.PI * 2);
    ctx.stroke();

    const p = Math.max(0, this.hp / this.maxHp);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
}
