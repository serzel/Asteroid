import { wrap, rand } from "../engine/math.js";
import { computeAlphaBBox } from "../engine/utils.js";
import { drawCircularGlow } from "../rendering/GlowRenderer.js";

const SPLIT_KICK = 60;
const MAX_CHILD_SPEED = 520;
const SPLIT_ENERGY_LOSS = 0.92;

const ASTEROID_SPRITE_FILES = {
  normal: {
    1: "normal_petit.png",
    2: "normal_moyen.png",
    3: "normal_grand.png",
  },
  dense: {
    1: "dense_petit.png",
    2: "dense_moyen.png",
    3: "dense_grand.png",
  },
  fast: {
    1: "fast_petit.png",
    2: "fast_moyen.png",
    3: "fast_grand.png",
  },
  splitter: {
    1: "splitter_petit.png",
    2: "splitter_moyen.png",
    3: "splitter_grand.png",
  },
};

function loadAsteroidSprites() {
  const sprites = {};

  for (const [type, bySize] of Object.entries(ASTEROID_SPRITE_FILES)) {
    sprites[type] = {};

    for (const [size, fileName] of Object.entries(bySize)) {
      const img = new Image();
      const asset = {
        img,
        meta: {
          bbox: null,
        },
      };

      img.onload = () => {
        asset.meta.bbox = computeAlphaBBox(img);
      };

      img.src = new URL(`../../assets/${fileName}`, import.meta.url);

      if (img.complete && img.naturalWidth > 0) {
        asset.meta.bbox = computeAlphaBBox(img);
      }

      sprites[type][Number(size)] = asset;
    }
  }

  return sprites;
}

const ASTEROID_SPRITES = loadAsteroidSprites();

const ASTEROID_VISUAL_SCALE_BY_TYPE = {
  normal: 1.10,
  dense: 1.08,
  fast: 1.15,
  splitter: 1.12,
};

const ASTEROID_VISUAL_SCALE_BY_SIZE = {
  1: 1.0,
  2: 1.0,
  3: 1.0,
};

const ASTEROID_HIT_CIRCLES = {
  normal: {
    1: [{ ox: 0, oy: 0, r: 1.0 }],
    2: [{ ox: 0, oy: 0, r: 1.0 }],
    3: [{ ox: 0, oy: 0, r: 1.0 }],
  },
  dense: {
    1: [{ ox: 0, oy: 0, r: 1.0 }],
    2: [{ ox: 0, oy: 0, r: 1.0 }],
    3: [{ ox: 0, oy: 0, r: 1.0 }],
  },
  splitter: {
    1: [{ ox: -0.33, oy: 0.0, r: 0.75 }, { ox: 0.33, oy: 0.0, r: 0.75 }],
    2: [{ ox: -0.34, oy: 0.0, r: 0.74 }, { ox: 0.34, oy: 0.0, r: 0.74 }],
    3: [{ ox: -0.36, oy: 0.0, r: 0.72 }, { ox: 0.36, oy: 0.0, r: 0.72 }],
  },
  fast: {
    1: [{ ox: -0.52, oy: 0.0, r: 0.52 }, { ox: 0.0, oy: 0.0, r: 0.48 }, { ox: 0.52, oy: 0.0, r: 0.52 }],
    2: [{ ox: -0.50, oy: 0.0, r: 0.53 }, { ox: 0.0, oy: 0.0, r: 0.49 }, { ox: 0.50, oy: 0.0, r: 0.53 }],
    3: [{ ox: -0.48, oy: 0.0, r: 0.54 }, { ox: 0.0, oy: 0.0, r: 0.5 }, { ox: 0.48, oy: 0.0, r: 0.54 }],
  },
};

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
    this.displayRadius = this.radius;
    this.hasBboxCollisionRadius = false;
    this.#refreshCollisionRadius();

    // Valeur de combo selon la taille (gros/moyen/petit).
    this.comboValue = size >= 3 ? 1.0 : size === 2 ? 0.5 : 0.25;

    this.maxHp = Math.max(1, Math.round(size * cfg.hpMul));
    this.hp = this.maxHp;

    const speed = (rand(30, 90) / size) * cfg.speedMul;
    const ang = rand(0, Math.PI * 2);
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;

    this.rot = rand(0, Math.PI * 2);
    this.rotSpeed = rand(-1.2, 1.2);

    this.hitFlash = 0;
    this.hitFlashDecay = 6.0;

    this.dead = false;
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

    if (!this.hasBboxCollisionRadius) {
      this.#refreshCollisionRadius();
    }
  }

  #getSprite() {
    return ASTEROID_SPRITES[this.type]?.[this.size] ?? ASTEROID_SPRITES.normal[this.size];
  }

  #refreshCollisionRadius() {
    const spriteAsset = this.#getSprite();
    const bbox = spriteAsset?.meta?.bbox;

    if (!bbox) {
      this.radius = this.displayRadius;
      this.hasBboxCollisionRadius = false;
      return;
    }

    const img = spriteAsset.img;
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    const scaleX = (this.displayRadius * 2) / imgW;
    const scaleY = (this.displayRadius * 2) / imgH;
    const bboxDisplayW = bbox.w * scaleX;
    const bboxDisplayH = bbox.h * scaleY;

    this.radius = Math.max(1, Math.hypot(bboxDisplayW, bboxDisplayH) * 0.48);
    this.hasBboxCollisionRadius = true;
  }

  getHitCircles() {
    return ASTEROID_HIT_CIRCLES[this.type]?.[this.size]
      ?? ASTEROID_HIT_CIRCLES.normal[this.size]
      ?? ASTEROID_HIT_CIRCLES.normal[3];
  }

  getWorldHitCircles(out = []) {
    out.length = 0;
    const hitCircles = this.getHitCircles();
    const cos = Math.cos(this.rot);
    const sin = Math.sin(this.rot);

    for (let i = 0; i < hitCircles.length; i++) {
      const c = hitCircles[i];
      const localX = c.ox * this.radius;
      const localY = c.oy * this.radius;
      out.push({
        x: this.x + localX * cos - localY * sin,
        y: this.y + localX * sin + localY * cos,
        r: c.r * this.radius,
      });
    }
    return out;
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
    const base = rand(0, Math.PI * 2);
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const kid = new Asteroid(this.x, this.y, this.size - 1, this.type);
      const angle = base + i * step;
      const kickX = Math.cos(angle) * SPLIT_KICK;
      const kickY = Math.sin(angle) * SPLIT_KICK;

      kid.vx = this.vx + kickX;
      kid.vy = this.vy + kickY;

      const speed = Math.hypot(kid.vx, kid.vy);
      if (speed > MAX_CHILD_SPEED) {
        const scale = MAX_CHILD_SPEED / speed;
        kid.vx *= scale;
        kid.vy *= scale;
      }

      kid.vx *= SPLIT_ENERGY_LOSS;
      kid.vy *= SPLIT_ENERGY_LOSS;

      kids.push(kid);
    }
    return kids;
  }

  drawBase(ctx) {
    const spriteAsset = this.#getSprite();
    const sprite = spriteAsset?.img;
    const bbox = spriteAsset?.meta?.bbox;
    const diameter = this.displayRadius * 2;
    const typeScale = ASTEROID_VISUAL_SCALE_BY_TYPE[this.type] ?? ASTEROID_VISUAL_SCALE_BY_TYPE.normal;
    const sizeScale = ASTEROID_VISUAL_SCALE_BY_SIZE[this.size] ?? 1.0;
    const visualScale = typeScale * sizeScale;
    const drawDiameter = diameter * visualScale;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    if (sprite?.complete && sprite.naturalWidth > 0) {
      const imgW = sprite.naturalWidth || sprite.width;
      const imgH = sprite.naturalHeight || sprite.height;
      const bb = bbox ?? {
        minX: 0,
        minY: 0,
        maxX: imgW - 1,
        maxY: imgH - 1,
        w: imgW,
        h: imgH,
        cx: imgW * 0.5,
        cy: imgH * 0.5,
      };
      const scaleX = drawDiameter / imgW;
      const scaleY = drawDiameter / imgH;
      const drawX = -bb.cx * scaleX;
      const drawY = -bb.cy * scaleY;

      ctx.drawImage(sprite, drawX, drawY, imgW * scaleX, imgH * scaleY);
    } else {
      ctx.fillStyle = "rgba(140,140,140,0.75)";
      ctx.beginPath();
      ctx.arc(0, 0, this.displayRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.18 * this.hitFlash})`;
      ctx.fillRect(-drawDiameter * 0.5, -drawDiameter * 0.5, drawDiameter, drawDiameter);
    }

    ctx.restore();
  }

  drawGlow(ctx) {
    if (this.hitFlash <= 0) return;
    drawCircularGlow(ctx, this.x, this.y, this.displayRadius * 0.72, "rgba(220,245,255,0.95)", this.hitFlash * 0.42);
  }

  draw(ctx) {
    this.drawBase(ctx);
    this.drawGlow(ctx);
  }
}
