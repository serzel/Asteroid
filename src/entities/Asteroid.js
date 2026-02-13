import { wrap, rand } from "../engine/math.js";

export class Asteroid {
  static TYPE = {
    normal:   { speedMul: 1.0,  hpMul: 1, splitCount: 2, dashed: false, lineWidth: 1, points: 10, jitterMin: 0.75, jitterMax: 1.25, scoreMul: 1.0, tint: "rgba(180,180,180,1)" },
    dense:    { speedMul: 0.75, hpMul: 2, splitCount: 2, dashed: false, lineWidth: 3, points: 11, jitterMin: 0.80, jitterMax: 1.20, scoreMul: 1.4, tint: "rgba(90, 110, 160, 1)", highlight: "rgba(160, 180, 230, 1)", shadow: "rgba(50, 65, 110, 1)" },
    fast:     { speedMul: 2.2,  hpMul: 1, splitCount: 0, dashed: true,  lineWidth: 1, points: 9,  jitterMin: 0.85, jitterMax: 1.15, scoreMul: 1.3, tint: "rgba(150,190,210,1)" },
    splitter: { speedMul: 1.05, hpMul: 1, splitCount: 3, dashed: false, lineWidth: 2, points: 13, jitterMin: 0.70, jitterMax: 1.30, scoreMul: 1.6, tint: "rgba(190,150,220,1)" },
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
    this.seed = Math.random();
    this.craters = this.#makeCraters();
    this.grain = this.#makeGrain();

    this.rot = rand(0, Math.PI * 2);
    this.rotSpeed = rand(-1.2, 1.2);

    this.hitFlash = 0;
    this.hitFlashDecay = 6.0;

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

  #rand01(i) {
    const v = Math.sin((this.seed + i * 0.6180339887) * 43758.5453123) * 10000;
    return v - Math.floor(v);
  }

  #makeCraters() {
    const count = this.size >= 3 ? 12 : this.size === 2 ? 9 : 6;
    return Array.from({ length: count }, (_, i) => ({
      a: this.#rand01(i * 4 + 1) * Math.PI * 2,
      d: this.#rand01(i * 4 + 2) * 0.75,
      r: 0.06 + this.#rand01(i * 4 + 3) * 0.10,
      depth: 0.4 + this.#rand01(i * 4 + 4) * 0.6,
    }));
  }

  #makeGrain() {
    const count = 20 + this.size * 7;
    const points = [];
    let i = 0;
    while (points.length < count && i < count * 5) {
      const x = (this.#rand01(1000 + i * 5 + 1) * 2 - 1) * this.radius;
      const y = (this.#rand01(1000 + i * 5 + 2) * 2 - 1) * this.radius;
      if (x * x + y * y <= this.radius * this.radius) {
        points.push({
          x,
          y,
          alpha: 0.02 + this.#rand01(1000 + i * 5 + 3) * 0.02,
          bright: this.#rand01(1000 + i * 5 + 4) > 0.5,
        });
      }
      i += 1;
    }
    return points;
  }

  #tintShades(tint) {
    const match = tint.match(/rgba?\((\d+),(\d+),(\d+)(?:,[^)]+)?\)/);
    if (!match) {
      return {
        highlightColor: "rgba(230,230,230,1)",
        baseColor: tint,
        shadowColor: "rgba(60,60,60,1)",
        outlineColor: "rgba(45,45,45,0.95)",
      };
    }
    const toNum = (v) => Number(v);
    const r = toNum(match[1]);
    const g = toNum(match[2]);
    const b = toNum(match[3]);
    const lift = (v) => Math.round(v + (230 - v) * 0.7);
    const dark = (v) => Math.round(v * 0.35);
    return {
      highlightColor: `rgba(${lift(r)},${lift(g)},${lift(b)},1)`,
      baseColor: tint,
      shadowColor: `rgba(${dark(r)},${dark(g)},${dark(b)},1)`,
      outlineColor: `rgba(${Math.round(dark(r) * 0.8)},${Math.round(dark(g) * 0.8)},${Math.round(dark(b) * 0.8)},0.95)`,
    };
  }

  update(dt, world) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = wrap(this.x, world.w);
    this.y = wrap(this.y, world.h);

    this.rot += this.rotSpeed * dt;

    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - this.hitFlashDecay * dt);
    }
  }

  #traceRoundedPath(ctx) {
    const len = this.points.length;
    if (len < 2) return;

    const p0 = this.points[0];
    const p1 = this.points[1];
    const r0 = this.radius * p0.r;
    const r1 = this.radius * p1.r;
    const p0x = Math.cos(p0.ang) * r0;
    const p0y = Math.sin(p0.ang) * r0;
    const p1x = Math.cos(p1.ang) * r1;
    const p1y = Math.sin(p1.ang) * r1;
    const firstMidX = (p0x + p1x) * 0.5;
    const firstMidY = (p0y + p1y) * 0.5;

    ctx.beginPath();
    ctx.moveTo(firstMidX, firstMidY);

    for (let i = 1; i < len; i++) {
      const curr = this.points[i];
      const next = this.points[(i + 1) % len];
      const currR = this.radius * curr.r;
      const nextR = this.radius * next.r;
      const currX = Math.cos(curr.ang) * currR;
      const currY = Math.sin(curr.ang) * currR;
      const nextX = Math.cos(next.ang) * nextR;
      const nextY = Math.sin(next.ang) * nextR;
      ctx.quadraticCurveTo(currX, currY, (currX + nextX) * 0.5, (currY + nextY) * 0.5);
    }

    ctx.quadraticCurveTo(p0x, p0y, firstMidX, firstMidY);
    ctx.closePath();
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
  const shades = this.#tintShades(cfg.tint);
  const highlightColor = cfg.highlight ?? shades.highlightColor;
  const baseColor = cfg.tint;
  const shadowColor = cfg.shadow ?? shades.shadowColor;
  const outlineColor = shades.outlineColor;
  const lightX = -0.35 * this.radius;
  const lightY = -0.35 * this.radius;

  ctx.save();
  ctx.translate(this.x, this.y);
  ctx.rotate(this.rot);

  if (cfg.dashed) ctx.setLineDash([6, 6]);

  // contour principal (forme procédurale lissée)
  this.#traceRoundedPath(ctx);

  const gradient = ctx.createRadialGradient(lightX, lightY, this.radius * 0.2, 0, 0, this.radius);
  gradient.addColorStop(0, highlightColor);
  gradient.addColorStop(0.55, baseColor);
  gradient.addColorStop(1, shadowColor);
  ctx.fillStyle = gradient;
  ctx.fill();

  if (this.hitFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,255,255,${0.25 * this.hitFlash})`;
    this.#traceRoundedPath(ctx);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.18 * this.hitFlash})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // cratères subtils
  for (const crater of this.craters) {
    const cx = Math.cos(crater.a) * crater.d * this.radius * 0.9;
    const cy = Math.sin(crater.a) * crater.d * this.radius * 0.9;
    const cr = crater.r * this.radius;

    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${0.12 + crater.depth * 0.12})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx - cr * 0.15, cy - cr * 0.15, cr * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.05 + crater.depth * 0.08})`;
    ctx.fill();
  }

  // grain léger stable
  for (const dot of this.grain) {
    ctx.fillStyle = dot.bright
      ? `rgba(255,255,255,${dot.alpha})`
      : `rgba(0,0,0,${dot.alpha})`;
    ctx.fillRect(dot.x, dot.y, 1, 1);
  }

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = this.size >= 3 ? 2 : 1;
  ctx.stroke();

  // rim light discret côté lumière
  ctx.shadowColor = highlightColor;
  ctx.shadowBlur = this.size >= 3 ? 6 : 4;
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowBlur = 0;

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
