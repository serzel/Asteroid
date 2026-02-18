# Render Pipeline Audit (Canvas 2D)

## Scope
- Full scan for canvas state mutations affecting neon-like artifacts:
  - `globalCompositeOperation`
  - `globalAlpha`
  - `shadowBlur` / `shadowColor`
  - `filter`
- Verification of draw order and neon helper usage boundaries.
- Runtime instrumentation sample before `#drawParticles()` and `#drawShots()`.

## Key Findings

### 1) Composite operations are intentionally used in gameplay FX
- Bullets explicitly use additive blending:
  - `ctx.globalCompositeOperation = "lighter"` in bullet trail drawing. (`src/entities/Bullet.js`)
- Explosions explicitly use additive blending for flash/rings:
  - `ctx.globalCompositeOperation = "lighter"`. (`src/entities/effects/Explosion.js`)
- Background also uses additive/screen/overlay layers for neon ambience:
  - `lighter` + `screen` + `overlay`. (`src/engine/Background.js`)

All such operations are inside `save()/restore()` or followed by reset paths.

### 2) No `ctx.filter` contamination detected
- Codebase scan found no persistent `ctx.filter` mutation paths in gameplay drawing.
- Runtime log sample before particles/shots reported `filter: "none"`.

### 3) State before particles/shots is clean (runtime)
Temporary instrumentation before particle and shot stages produced repeatedly:

```txt
STATE BEFORE PARTICLES {alpha: 1, blur: 0, shadow: rgba(0, 0, 0, 0), comp: source-over, filter: none}
STATE BEFORE SHOTS {alpha: 1, blur: 0, shadow: rgba(0, 0, 0, 0), comp: source-over, filter: none}
```

This indicates no upstream leak entering those stages.

### 4) Root cause is stylistic additive/glow in shot rendering itself
The bullet renderer itself applies glow-like visuals directly:
- Additive trail: `globalCompositeOperation = "lighter"`
- Saturated weapon colors with high alpha (`0.90`–`0.95`) sourced from ship weapon palette.
- Body glow blur: `shadowColor = this.color` + `shadowBlur = glowBlur`.

These produce a neon-like appearance by design even when render state is clean.

## Draw Order (PLAY)
1. `background.draw(ctx)`
2. `ship.render(ctx, combo)`
3. asteroids
4. particles stage (`explosions`, `debris`, `particles`)
5. shots stage (`bullets`)
6. combo warning border FX
7. collider overlay (debug)
8. game-over overlay (if state)
9. HUD
10. profiler overlay

Particles and shots are drawn **before** HUD and are **not** inside HUD.

## Neon helper contamination check
No calls from bullet/particle/explosion paths to neon UI helpers:
- `neonLine`
- `neonText`
- `neonPanel`
- `neonBar`
- `tubeStroke`

Those helpers are used by HUD/UI, not projectile/particle entities.

## Diagnosis
The observed “random neon” on shots/particles is not a context leak from neon UI helpers.
The dominant cause is additive blending + glow parameters in bullet/explosion rendering and high-saturation weapon color alpha values on a dark background.
