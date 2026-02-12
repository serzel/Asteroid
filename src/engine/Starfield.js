import { rand, wrap } from "./math.js";

export class Starfield {
  constructor(seedDensity = 0.00009) {
    this.seedDensity = seedDensity; // étoiles par pixel² (réglable)
    this.stars = [];
    this.w = 0;
    this.h = 0;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;

    const targetCount = Math.floor(w * h * this.seedDensity);
    this.stars = [];

    for (let i = 0; i < targetCount; i++) {
      // Petites tailles : 0.6 -> 1.8 (max)
      const r = rand(0.6, 1.8);

      // Certaines scintillent (ex: 25%)
      const twinkle = Math.random() < 0.25;

      // Parallax léger : 3 couches selon la taille
      const layer = r < 1.0 ? 0.35 : (r < 1.4 ? 0.6 : 0.9);

      this.stars.push({
        x: rand(0, w),
        y: rand(0, h),
        r,
        baseA: rand(0.35, 0.85),
        twinkle,
        twSpeed: rand(2.2, 5.0),
        twPhase: rand(0, Math.PI * 2),
        layer,
      });
    }
  }

  update(dt, shipVx = 0, shipVy = 0) {
    // Option parallax : le fond “glisse” légèrement selon la vitesse du vaisseau
    // (tu peux mettre 0,0 si tu veux un fond fixe)
    const k = 0.02;

    for (const s of this.stars) {
      s.x = wrap(s.x - shipVx * k * s.layer * dt, this.w);
      s.y = wrap(s.y - shipVy * k * s.layer * dt, this.h);

      if (s.twinkle) {
        s.twPhase += s.twSpeed * dt;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.w, this.h);

    for (const s of this.stars) {
      let a = s.baseA;

      if (s.twinkle) {
      // scintillement plus lisible
      const tw = (Math.sin(s.twPhase) + 1) * 0.5; // 0..1

      // alpha : variation plus forte mais toujours douce
      a *= 0.45 + tw * 0.95; // 0.45..1.40

      // micro "sparkle" : certaines étoiles grossissent légèrement
      // (ça se voit bien même sur des petits rayons)
      var rr = s.r * (0.85 + tw * 0.55); // 0.85..1.40
    } else {
      var rr = s.r;
}

      ctx.globalAlpha = Math.min(1, Math.max(0, a));
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(s.x, s.y, rr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
