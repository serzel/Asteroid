import { wrap } from "../engine/math.js";
import { Bullet } from "./Bullet.js";

const WEAPON_COLORS = {
  1: "rgba(0, 200, 255, 0.90)",
  2: "rgba(0, 255, 120, 0.95)",
  3: "rgba(180, 0, 255, 0.95)",
  4: "rgba(255, 60, 0, 0.95)",
};

const WEAPON_TRAIL_COLORS = {
  1: "rgba(0, 200, 255, 0.20)",
  2: "rgba(0, 255, 120, 0.20)",
  3: "rgba(180, 0, 255, 0.20)",
  4: "rgba(255, 60, 0, 0.20)",
};

function weaponTrailColor(level) {
  return WEAPON_TRAIL_COLORS[level] ?? WEAPON_TRAIL_COLORS[1];
}

export class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;

    this.vx = 0;
    this.vy = 0;

    this.angle = -Math.PI / 2;
    this.radius = 12;

    this.turnSpeed = 3.8;       // rad/s
    this.thrust = 220;          // px/s²
    this.friction = 0.6;        // 0..1 (plus bas = glisse plus)
    this.maxSpeed = 360;

    this.cooldown = 0;
    this.fireRate = 0.18;
    this.thrusting = false;

    this.sprite = new Image();
    this.sprite.src = "assets/ship.png";
    this.spriteSize = 80; // ajuster selon la résolution
    this.spriteLoaded = false;

    this.sprite.onload = () => {
      this.spriteLoaded = true;
    };

    // Palier d'arme piloté par le combo.
    this.weaponLevel = 1;
    this.bulletLife = 1.2;

    this.invincible = 0; // secondes (respawn)

    this.weaponNames = {
      1: "Blaster",
      2: "Sniper",
      3: "Double Blaster",
      4: "Shotgun",
    };

    this.trail = [];
    this.trailMax = 12;
    this.trailSpacing = 0.015;
    this._trailAcc = 0;
  }

  resetTrail() {
    this.trail = [];
    this._trailAcc = 0;
  }

  respawn(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.angle = -Math.PI / 2;
    this.invincible = 2.0;
    this.resetTrail();
  }

  update(dt, input, world) {
    if (input.isDown("left")) this.angle -= this.turnSpeed * dt;
    if (input.isDown("right")) this.angle += this.turnSpeed * dt;

    this.thrusting = input.isDown("up");

    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * this.thrust * dt;
      this.vy += Math.sin(this.angle) * this.thrust * dt;
    }

    // friction simple (exponentielle)
    const damp = Math.pow(this.friction, dt);
    this.vx *= damp;
    this.vy *= damp;

    // clamp vitesse
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > this.maxSpeed) {
      const s = this.maxSpeed / speed;
      this.vx *= s;
      this.vy *= s;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const oldX = this.x;
    const oldY = this.y;

    this.x = wrap(this.x, world.w);
    this.y = wrap(this.y, world.h);

    const wrapped = Math.abs(this.x - oldX) > world.w * 0.5
      || Math.abs(this.y - oldY) > world.h * 0.5;

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.invincible = Math.max(0, this.invincible - dt);

    if (wrapped) {
      this.resetTrail();
      return;
    }

    this._trailAcc += dt;
    while (this._trailAcc >= this.trailSpacing) {
      this.trail.push({ x: this.x, y: this.y, a: this.angle });
      if (this.trail.length > this.trailMax) this.trail.shift();
      this._trailAcc -= this.trailSpacing;
    }
  }

  updateWeaponLevel(combo) {
    if (combo >= 45) {
      this.weaponLevel = 4;
      this.bulletLife = 0.95;
    } else if (combo >= 25) {
      this.weaponLevel = 3;
      this.bulletLife = 1.2;
    } else if (combo >= 10) {
      this.weaponLevel = 2;
      this.bulletLife = 1.9;
    } else {
      this.weaponLevel = 1;
      this.bulletLife = 1.2;
    }
  }

  getWeaponName() {
    return this.weaponNames[this.weaponLevel] ?? "Blaster";
  }

  tryShoot(bullets) {
    if (this.cooldown > 0) return;

    const baseSpeed = 520;
    const nx = Math.cos(this.angle);
    const ny = Math.sin(this.angle);
    const tx = -ny;
    const ty = nx;

    const weaponColor = `${WEAPON_COLORS[this.weaponLevel] ?? WEAPON_COLORS[1]}`;

    const spawn = (angleOffset = 0, sideOffset = 0, speedMul = 1) => {
      const ang = this.angle + angleOffset;
      const dirX = Math.cos(ang);
      const dirY = Math.sin(ang);
      const bx = this.x + nx * (this.radius + 2) + tx * sideOffset;
      const by = this.y + ny * (this.radius + 2) + ty * sideOffset;
      const bulletSpeed = baseSpeed * speedMul;
      const bvx = dirX * bulletSpeed + this.vx;
      const bvy = dirY * bulletSpeed + this.vy;
      bullets.push(new Bullet(bx, by, bvx, bvy, this.bulletLife, weaponColor));
    };

    if (this.weaponLevel >= 4) {
      // Triple tir courte portée avec léger éventail.
      spawn(-0.1, -6, 0.85);
      spawn(0, 0, 0.85);
      spawn(0.1, 6, 0.85);
    } else if (this.weaponLevel >= 3) {
      // Double tir parallèle portée standard.
      spawn(0, -5);
      spawn(0, 5);
    } else if (this.weaponLevel >= 2) {
      // Tir simple rapide (sniper).
      spawn(0, 0, 1.3);
    } else {
      // Tir simple normal.
      spawn(0, 0);
    }

    this.cooldown = this.fireRate;
  }

  render(ctx, combo = 1) {
    if (!this.spriteLoaded) return;

    const weaponColor = WEAPON_COLORS[this.weaponLevel] ?? WEAPON_COLORS[1];
    const trailColor = weaponTrailColor(this.weaponLevel);

    if (this.trail.length > 0) {
      ctx.save();
      for (let i = 0; i < this.trail.length; i++) {
        const point = this.trail[i];
        const t = (i + 1) / this.trail.length;
        const alpha = (this.thrusting ? 0.5 : 0.3) * t;
        ctx.fillStyle = trailColor.replace(/\d?\.\d+\)$/, `${alpha.toFixed(2)})`);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2 + t * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();

    // Translation au centre du vaisseau
    ctx.translate(this.x, this.y);

    // Rotation autour du centre
    ctx.rotate(this.angle);

    // Glow dynamique selon combo
    const glowIntensity = Math.min(combo * 0.8, 25);
    ctx.shadowBlur = glowIntensity;
    ctx.shadowColor = weaponColor;

    // Dessin du sprite centré
    const size = this.spriteSize;
    ctx.drawImage(
      this.sprite,
      -size / 2,
      -size / 2,
      size,
      size
    );

    // Reset du glow
    ctx.shadowBlur = 0;

    // Flammes dynamiques générées par code (si thrusting)
    if (this.thrusting) {
      const flameLength = 15 + Math.random() * 10;
      const baseX = -size * 0.35;
      const baseY = 0;
      const weaponColorHalf = weaponColor.replace(/\d?\.\d+\)$/, "0.50)");

      const grad = ctx.createRadialGradient(
        baseX,
        baseY,
        0,
        baseX,
        baseY,
        flameLength
      );

      grad.addColorStop(0, weaponColor);
      grad.addColorStop(0.5, weaponColorHalf);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.ellipse(
        baseX,
        baseY,
        flameLength,
        8,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    if (this.weaponLevel >= 3) {
      const radiusX = size * 0.42;
      const radiusY = size * 0.34;
      const segments = 26;
      const jitter = this.weaponLevel >= 4 ? 3 : 2;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = weaponColor;
      ctx.lineWidth = this.weaponLevel >= 4 ? 2 : 1;
      ctx.shadowColor = weaponColor;
      ctx.shadowBlur = this.weaponLevel >= 4 ? 12 : 6;
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        const rx = radiusX + (Math.random() - 0.5) * jitter * 2;
        const ry = radiusY + (Math.random() - 0.5) * jitter * 2;
        const px = Math.cos(t) * rx;
        const py = Math.sin(t) * ry;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    }

    ctx.restore();
  }
}
