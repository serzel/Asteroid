# Refactor plan `src/engine/Game.js` (sans changement de gameplay)

## Arborescence proposée

```txt
src/
  engine/
    Game.js                      # orchestration only
    game/
      GameStateMachine.js        # transitions TITLE/PLAY/GAME_OVER
      GameLoop.js                # dt clamp + update/render timing wrappers
      GameContext.js             # état partagé (world, score, entities, timers)
    ui/
      GameUIRenderer.js          # rendu title/menu/game over + interactions UI
      widgets/
        NeonPanel.js             # drawPanelGlow
        NeonText.js              # drawNeonTitle
        NeonButton.js            # drawNeonButton
    debug/
      DebugController.js         # toggles debug + logs périodiques
      ProfilerOverlay.js         # agrégation/perf view + rendu overlay
```

---

## Responsabilités exactes

### `Game.js` (orchestrateur)
- Instancie `Input`, `Background`, `Ship`, pools, systems et modules UI/debug.
- Délègue les updates métier (`PlayState`, collisions, spawner, effets).
- Délègue le rendu UI et debug.
- Ne contient plus de logique de dessin détaillée (pas de `ctx` low-level UI).

### `game/GameContext.js`
- Contient **uniquement** les données runtime partagées.
- Sert d’objet unique passé aux modules pour éviter de multiplier les paramètres.
- Aucune logique de rendu/IO.

### `game/GameStateMachine.js`
- API claire pour transitions:
  - `toTitle()`
  - `toPlay(difficultyId)`
  - `toGameOverAnim()`
  - `toGameOverReady()`
- Encapsule les effets de transition (reset timers, cursor, hoveredButtonId, etc.).

### `ui/GameUIRenderer.js`
- Gère:
  - layout boutons title/menu,
  - hit-test pointer sur boutons,
  - rendu title screen,
  - rendu game over screen,
  - appel HUD existant (`drawHUD`).
- Expose des callbacks (`onStartGame`, `onBackToMenu`) pour laisser `Game` décider des transitions.

### `debug/DebugController.js`
- Lit les inputs debug (`debug`, `debugToggle`, `debugProfiler`, etc.).
- Met à jour les flags (`debugEnabled`, `debugColliders`, `debugSeams`).
- Produit les logs debug/perf périodiques sans accès au rendu.

### `debug/ProfilerOverlay.js`
- Maintient la structure `profView` (refresh window, peaks, freeze).
- Reçoit mesures update/render/fps/collisions.
- Rend l’overlay quand activé.

---

## Signatures (applicables directement)

```js
// src/engine/game/GameContext.js
export function createGameContext(canvas, input, deps) {
  return {
    canvas,
    ctx: canvas.getContext("2d"),
    input,
    world: { w: 0, h: 0 },
    state: "TITLE",
    ship: null,
    asteroids: [], bullets: [], particles: [], explosions: [], debris: [],
    score: 0, combo: 1, comboTimer: 0, lives: 3, level: 1,
    hoveredButtonId: null,
    // ...reprendre 1:1 les champs runtime déjà présents
  };
}
```

```js
// src/engine/ui/GameUIRenderer.js
export class GameUIRenderer {
  constructor({ drawText, drawHUD, now = () => performance.now() }) {}

  syncLayout(ctx) {}

  handlePointerMove(ctx, mx, my) {
    // returns hoveredButtonId | null
  }

  handlePointerDown(ctx, mx, my) {
    // returns { action: "start", difficultyId } | { action: "menu" } | null
  }

  renderTitle(ctx) {}
  renderGameOver(ctx) {}
  renderHud(ctx) {}
}
```

```js
// src/engine/debug/DebugController.js
export class DebugController {
  constructor({ logger = console.log }) {}

  handleInput(ctx, dt) {}

  tickLogs(ctx, dt) {}

  isEnabled(ctx) {}
}
```

```js
// src/engine/debug/ProfilerOverlay.js
export class ProfilerOverlay {
  constructor({ drawText }) {}

  recordFrame({ dt, fps, updateMs, renderMs, collisionCount, maxSpeed, kineticEnergy }) {}

  freeze(seconds = 2) {}

  render(ctx, world) {}
}
```

---

## Découpage concret (depuis le fichier actuel)

### Étape 1 — UI pure (safe)
Déplacer depuis `Game.js` vers `GameUIRenderer.js`:
- `#drawPanelGlow`
- `#drawNeonTitle`
- `#drawNeonButton`
- `#drawTitleScreen`
- `#drawGameOverScreen`
- `#drawHUD` wrapper (conserver `drawHUD` import actuel)
- `#rebuildTitleButtons`, logique `menuButton`
- hit-test `#pointInRect` côté UI

`Game.js` garde seulement:
```js
this.ui.syncLayout(this.ctx);
this.ui.renderTitle(this.ctx);
this.ui.renderGameOver(this.ctx);
this.ui.renderHud(this.ctx);
```

### Étape 2 — Pointer/UI interactions
Déplacer:
- `#mouseToCanvas`
- partie UI de `#onPointerMove`
- partie UI de `#onPointerDown`

`Game.js` devient:
```js
const hit = this.ui.handlePointerDown(ctx, mx, my);
if (hit?.action === "start") this.startGame(hit.difficultyId);
if (hit?.action === "menu") this.stateMachine.toTitle();
```

### Étape 3 — Debug/Profiler
Déplacer:
- toggles debug dans `#updateDebug`
- logs `debugLogAccum` / `debugPerfAccum`
- update `profView` dans la boucle
- rendu profiler/debug overlay

`Game.js`:
```js
this.debug.handleInput(this.ctxData, dt);
this.profiler.recordFrame(metrics);
if (this.debug.isEnabled(this.ctxData)) this.profiler.render(this.ctx, this.world);
```

---

## Garde-fous zéro régression

1. **Extraction 1:1**: copier-coller les méthodes vers modules sans modifier les formules.
2. **Ordre de rendu inchangé**: background -> gameplay -> UI -> debug.
3. **Même source de temps**: conserver `performance.now()` pour les animations UI.
4. **Diff de sécurité**: comparer screenshots title/gameplay/game over avant/après.
5. **Checklist courte**:
   - Start game depuis title OK
   - Hover/click boutons OK
   - Game over -> MENU OK
   - Toggles debug/profiler identiques
   - FPS/update/render affichés identiques (à ± jitter normal)

---

## Plan d’implémentation recommandé (2 PR max)

- **PR1: UI extraction only**
  - Ajout `GameUIRenderer` + widgets.
  - `Game.js` allégé mais même state machine.
- **PR2: Debug/profiler extraction**
  - Ajout `DebugController` + `ProfilerOverlay`.
  - Aucune logique gameplay touchée.

Ce découpage limite les risques et permet de valider la non-régression étape par étape.
