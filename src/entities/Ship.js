import { wrap } from "../engine/math.js";
import { Bullet } from "./Bullet.js";

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
  }

  respawn(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.angle = -Math.PI / 2;
    this.invincible = 2.0;
  }

  update(dt, input, world) {
    if (input.isDown("left")) this.angle -= this.turnSpeed * dt;
    if (input.isDown("right")) this.angle += this.turnSpeed * dt;

    if (input.isDown("up")) {
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

    this.x = wrap(this.x, world.w);
    this.y = wrap(this.y, world.h);

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.invincible = Math.max(0, this.invincible - dt);
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

    const spawn = (angleOffset = 0, sideOffset = 0, speedMul = 1) => {
      const ang = this.angle + angleOffset;
      const dirX = Math.cos(ang);
      const dirY = Math.sin(ang);
      const bx = this.x + nx * (this.radius + 2) + tx * sideOffset;
      const by = this.y + ny * (this.radius + 2) + ty * sideOffset;
      const bulletSpeed = baseSpeed * speedMul;
      const bvx = dirX * bulletSpeed + this.vx;
      const bvy = dirY * bulletSpeed + this.vy;
      bullets.push(new Bullet(bx, by, bvx, bvy, this.bulletLife));
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

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Invincibilité : blink + halo
    if (this.invincible > 0) {
      const blink = Math.floor(this.invincible * 12) % 2 === 0;
      ctx.globalAlpha = blink ? 1 : 0.25;

      // halo
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = "white";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, -10);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }
}
