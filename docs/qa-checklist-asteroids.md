# QA manuel — collisions d’astéroïdes (anti-jitter / anti-boost / split / feeling billard)

## Préparation commune (pour tous les tests)
- Démarrer une partie en difficulté **NORMAL** (pour des mesures comparables).
- Activer l’overlay debug avec **F1** puis le profiler/stats avec **F2**.
- Vérifier que les lignes suivantes sont visibles :
  - `asteroid collisions`
  - `asteroid max speed`
  - `asteroid kinetic E`
- Contrôles de base : déplacement (`ZQSD`/flèches), tir (`Space`), bascule clavier (`P` si besoin).

## Seuils d’acceptation globaux
- **Vitesse max acceptable** (`asteroid max speed`) : **<= 500 px/s** en jeu normal.
  - Justification technique : la logique limite les enfants de split à une vitesse plafonnée et applique une perte d’énergie.
- **Stabilité énergétique** (`asteroid kinetic E`) :
  - Hors spawn / hors tir / hors split : variation lente, sans pics brusques ; cible **±10 % max sur 5 s**.
  - Pendant un split : **pas de pic positif durable** ; retour vers la tendance en **< 2 s**.

---

## Test 1 — Duel 1v1 (jitter de contact)
- **Condition initiale (wave, densité)** : wave 1, densité faible (laisser seulement 2 astéroïdes vivants).
- **Action joueur** : ne pas tirer pendant 10 s ; se placer loin pour garder les 2 astéroïdes à l’écran.
- **Résultat attendu (visuel + comportement)** :
  - Visuel : pas de micro-tremblement/oscillation rapide au point de contact.
  - Comportement : séparation propre après impact, trajectoires lisibles.
  - Stats : `asteroid max speed` reste sous 500 ; `asteroid kinetic E` n’affiche pas de spike abrupt.

## Test 2 — Pack dense (stabilité sous charge)
- **Condition initiale (wave, densité)** : wave 6+, densité élevée (au moins 8–12 astéroïdes simultanés).
- **Action joueur** : ne pas tirer pendant 8 s, laisser les collisions se produire naturellement.
- **Résultat attendu (visuel + comportement)** :
  - Visuel : aucun effet “popcorn” (rebonds erratiques à très haute fréquence).
  - Comportement : flux collisionnel continu, pas d’éjections ultra-rapides.
  - Stats : `asteroid max speed` <= 500 ; `asteroid kinetic E` sans dérive positive continue.

## Test 3 — Contact tangent (feeling billard)
- **Condition initiale (wave, densité)** : wave 3–4, densité moyenne (4–6 astéroïdes).
- **Action joueur** : attirer deux astéroïdes en trajectoires tangentes (sans tir), observer 3 collisions tangentielles.
- **Résultat attendu (visuel + comportement)** :
  - Visuel : glissement tangentiel perceptible, pas d’arrêt net “collant”.
  - Comportement : déviation cohérente façon billard, conservation de la direction dominante.
  - Stats : l’énergie totale baisse légèrement ou reste stable (pas de gain net).

## Test 4 — Contact frontal (rebond non explosif)
- **Condition initiale (wave, densité)** : wave 2–3, densité faible à moyenne.
- **Action joueur** : se positionner pour provoquer un choc quasi frontal entre deux gros astéroïdes (sans tir).
- **Résultat attendu (visuel + comportement)** :
  - Visuel : rebond net mais non violent.
  - Comportement : inversion/déviation plausible, sans accélération anormale post-impact.
  - Stats : `asteroid max speed` ne saute pas brutalement ; `asteroid kinetic E` ne monte pas de façon durable.

## Test 5 — Split simple (2 enfants) sans boost
- **Condition initiale (wave, densité)** : wave 4–6, densité moyenne ; cibler un astéroïde `normal` ou `dense` de taille 3.
- **Action joueur** : détruire l’astéroïde pour déclencher un split, puis arrêter de tirer pendant 3 s.
- **Résultat attendu (visuel + comportement)** :
  - Visuel : les enfants se séparent proprement sans “explosion” de vitesse.
  - Comportement : vitesse des enfants contrôlée, trajectoires stables après 1–2 collisions.
  - Stats : pas de dépassement 500 ; `asteroid kinetic E` sans boost durable après split.

## Test 6 — Splitter (3 enfants) non explosif
- **Condition initiale (wave, densité)** : wave 6+, densité moyenne/élevée, présence d’un `splitter`.
- **Action joueur** : détruire 1 `splitter`, puis ne pas tirer durant 4 s pour observer uniquement la physique.
- **Résultat attendu (visuel + comportement)** :
  - Visuel : dispersion en 3 directions lisible, sans flash de vitesse excessif.
  - Comportement : pas de réaction en chaîne “coup de canon” sur les voisins.
  - Stats : `asteroid max speed` <= 500 ; l’énergie totale redescend rapidement dans la tendance (<2 s).

## Test 7 — Chaîne de splits (robustesse)
- **Condition initiale (wave, densité)** : wave 8+, densité élevée avec plusieurs astéroïdes splittables.
- **Action joueur** : provoquer 3 splits en moins de 5 s, puis cesser de tirer 5 s.
- **Résultat attendu (visuel + comportement)** :
  - Visuel : scène lisible malgré la charge, pas de jitter global.
  - Comportement : pas d’augmentation cumulative de vitesse à chaque split.
  - Stats : pas de dérive à la hausse persistante de `asteroid kinetic E` sur la fenêtre d’observation.

## Test 8 — Endurance 60 s (feeling général billard)
- **Condition initiale (wave, densité)** : wave 7+, densité mixte (normal/dense/fast/splitter).
- **Action joueur** : jouer 60 s avec tirs modérés (rafales courtes), en conservant 6+ astéroïdes actifs.
- **Résultat attendu (visuel + comportement)** :
  - Visuel : aucun jitter perceptible sur la durée.
  - Comportement : collisions crédibles “billard arcade” ; pas de boosts aléatoires après séparations.
  - Stats : pics ponctuels tolérés, mais vitesse max bornée et énergie globale sans emballement.

---

## Règle de verdict (Go / No-Go)
- **GO** si les 8 tests passent, avec respect des seuils globaux.
- **NO-GO** dès qu’un de ces symptômes apparaît de manière reproductible :
  - jitter visible récurrent,
  - boost net lors d’une séparation/split,
  - split visuellement explosif,
  - perte du feeling billard (rebonds incohérents ou erratiques).
