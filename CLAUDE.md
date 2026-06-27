# Contexte projet — Estim·clim Pro

Outil web mono-page de chiffrage clim / PAC pour le terrain (Wallonie). À destination d'un commercial qui visite des clients, scope les pièces, chiffre, présente et imprime un devis.

## Architecture

- **Sans framework, sans build.** Vanilla HTML/CSS/JS.
  - `index.html` : shell minimal, charge `styles.css`, `app.js`, et Three.js depuis un CDN (`three@0.128.0`).
  - `styles.css` : tous les styles (variables CSS dans `:root`).
  - `app.js` : toute la logique, dans une IIFE `(function(){ ... })()`.
- **Un seul objet `state`** (société, catalogue, groupes extérieurs, main-d'œuvre, prestations, primes, finances, devis courant, plan, devis enregistrés, ui).
- **Pattern de rendu** : `render()` reconstruit la vue active selon `state.ui.tab` (`devis`, `plan`, `3d`, `dash`, `admin`). Les vues lourdes se reconstruisent à chaque changement d'onglet ; les éditions champ-par-champ mutent `state` + recalculent sans tout re-rendre (pour préserver le focus des inputs).
- **Persistance** : `localStorage` (clé `estimclim_pro_v1`, best-effort dans try/catch) + export/import JSON complet. `state.ui` n'est pas persisté.

## Modules

- **Devis** : `computeRoom` (W/m²), `computeTotals`, `computePrime` (primes wallonnes, air-air = 0), `computeFinance` (acompte/reste), `computeROI`.
- **Plan** : éditeur SVG (`buildEditorSVG`, drag via pointer events + `getScreenCTM`), `planSVGString` (rendu read-only pour vue client/PDF).
- **3D** : `buildThreeScene` extrude le plan en Three.js (murs translucides, unités, photos en texture de sol). Orbit caméra maison.
- **AR** : `launchAR` — WebXR `immersive-ar` + hit-test. Crée une pièce dans le plan depuis le métré.
- **PDF** : `buildPrint` génère un document imprimable (devis + plan), via `window.print()`.

## Contraintes à respecter

- **Garder vanilla** (pas de framework) sauf raison forte. Three.js reste la seule dépendance externe.
- **Pas de localStorage cassant** : toujours envelopper les accès stockage dans try/catch.
- **AR** : nécessite un contexte sécurisé (https) + Chrome Android + ARCore. Toujours dégrader proprement (message clair) si non supporté.
- **Données métier sensibles** : prix et coefficients de primes sont éditables et indicatifs. Ne pas coder en dur de vrais barèmes officiels sans source vérifiée (logement.wallonie.be).
- Le **dimensionnement reste une estimation** — ne pas le présenter comme une étude thermique.

## Tester

- Ouvrir `index.html` dans un navigateur (2D/devis/dashboard marchent hors-ligne).
- 3D : nécessite internet (CDN Three.js).
- AR : nécessite https → tester via le déploiement GitHub Pages, sur un Android Chrome.
- Vérif rapide de syntaxe : `node --check app.js`.

## Idées d'évolution

1. Module PAC air-eau dédié (déperditions + prime complète).
2. Mesure AR en polygone (pièces en L).
3. Backend optionnel pour multi-utilisateur / synchronisation.
