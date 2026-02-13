# Asteroid - Version ZQSD

Un jeu d'astéroïdes classique avec des contrôles adaptés au clavier AZERTY français.

## 🎮 Description

Pilotez votre vaisseau spatial dans un champ d'astéroïdes dangereux ! Détruisez tous les astéroïdes pour passer au niveau suivant. Attention, chaque niveau devient progressivement plus difficile avec plus d'astéroïdes et des types variés.

### Types d'astéroïdes

- **Normal** : Astéroïde standard
- **Dense** : Plus résistant, nécessite plusieurs tirs
- **Fast** : Rapide avec une traînée de particules
- **Splitter** : Se divise en plusieurs morceaux

## 🕹️ Contrôles

**Note** : Ce jeu supporte deux systèmes de contrôle - utilisez celui qui vous convient !

Vous pouvez basculer entre les deux layouts en appuyant sur **P** pendant le jeu.

### Option 1 : Flèches directionnelles (QWERTY/AZERTY)
- **↑ (Flèche haut)** : Avancer (propulsion)
- **← (Flèche gauche)** : Tourner à gauche
- **→ (Flèche droite)** : Tourner à droite
- **ESPACE** : Tirer

### Option 2 : ZQSD (clavier AZERTY) - Par défaut
- **Z** : Avancer (propulsion)
- **Q** : Tourner à gauche
- **D** : Tourner à droite
- **ESPACE** : Tirer

### Option 3 : WASD (clavier QWERTY)
- **W** : Avancer (propulsion)
- **A** : Tourner à gauche
- **D** : Tourner à droite
- **ESPACE** : Tirer

### Autres commandes

- **P** : Basculer entre les layouts ZQSD et WASD
- **Entrée** : Rejouer après un Game Over

## 🚀 Comment jouer

### Méthode 1 : Ouvrir directement le fichier HTML

1. Clonez ou téléchargez ce dépôt
2. Ouvrez le fichier `index.html` dans votre navigateur web

### Méthode 2 : Utiliser un serveur local

Pour une meilleure expérience (évite certains problèmes de CORS avec les modules ES6) :

```bash
# Avec Python 3
python -m http.server 8000

# Avec Node.js (npx)
npx serve

# Avec PHP
php -S localhost:8000
```

Puis ouvrez http://localhost:8000 dans votre navigateur.

## 📊 Système de jeu

- **Vies** : Vous commencez avec 3 vies
- **Score** : Gagnez des points en détruisant les astéroïdes
  - Plus l'astéroïde est gros, plus vous gagnez de points
- **Niveaux** : Chaque niveau ajoute plus d'astéroïdes et augmente la difficulté
- **Invincibilité** : Après avoir perdu une vie, vous êtes temporairement invincible

## 🛠️ Technologies

- HTML5 Canvas
- JavaScript ES6 (modules)
- CSS3

## 📁 Structure du projet

```
.
├── index.html          # Point d'entrée du jeu
├── style.css          # Styles de base
├── README.md          # Ce fichier
└── src/
    ├── main.js        # Initialisation du jeu
    ├── engine/        # Moteur de jeu
    │   ├── Game.js    # Boucle principale et logique
    │   ├── Input.js   # Gestion des entrées clavier
    │   ├── math.js    # Fonctions mathématiques
    │   ├── utils.js   # Utilitaires
    │   └── Starfield.js # Fond étoilé
    └── entities/      # Entités du jeu
        ├── Ship.js    # Vaisseau du joueur
        ├── Asteroid.js # Astéroïdes
        ├── Bullet.js  # Projectiles
        └── effects/   # Effets visuels
            ├── Particle.js
            └── Explosion.js
```

## 🎯 Conseils de jeu

- Gardez toujours de l'espace pour manœuvrer
- Les petits astéroïdes sont plus difficiles à toucher mais donnent autant de points
- Utilisez votre vitesse à votre avantage - le vaisseau glisse dans l'espace !
- Faites attention aux collisions entre astéroïdes qui peuvent les envoyer vers vous

## 📝 Licence

Projet libre pour l'apprentissage et le divertissement.

## 🙏 Remerciements

Inspiré du jeu classique Asteroids d'Atari (1979).
