import { wrap, clamp } from "../engine/math.js";
import { Bullet } from "./Bullet.js";
import { DEFAULT_KEYBOARD_LAYOUT } from "../engine/constants.js";

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

    this.invincible = 0; // secondes (respawn)
  }

  respawn(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.angle = -Math.PI / 2;
    this.invincible = 2.0;
  }

  update(dt, input, world, keyboardLayout = DEFAULT_KEYBOARD_LAYOUT) {
    // Determine which keys to use based on layout
    const leftKey = keyboardLayout === 'WASD' ? 'KeyA' : 'KeyQ';
    const rightKey = 'KeyD'; // Same for both layouts
    const upKey = keyboardLayout === 'WASD' ? 'KeyW' : 'KeyZ';

    if (input.isDown("ArrowLeft") || input.isDown(leftKey)) this.angle -= this.turnSpeed * dt;
    if (input.isDown("ArrowRight") || input.isDown(rightKey)) this.angle += this.turnSpeed * dt;

    if (input.isDown("ArrowUp") || input.isDown(upKey)) {
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

  tryShoot(bullets) {
    if (this.cooldown > 0) return;

    const speed = 520;
    const bx = this.x + Math.cos(this.angle) * (this.radius + 2);
    const by = this.y + Math.sin(this.angle) * (this.radius + 2);
    const bvx = Math.cos(this.angle) * speed + this.vx;
    const bvy = Math.sin(this.angle) * speed + this.vy;

    bullets.push(new Bullet(bx, by, bvx, bvy));
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
