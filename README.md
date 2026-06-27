# Estim·clim Pro

Outil de **chiffrage et de présentation pour l'installation de climatisation et de pompe à chaleur**, pensé pour le terrain (marché wallon / belge). Une seule page web, sans backend : on l'ouvre dans un navigateur, on chiffre, on présente au client, on imprime le devis.

## Fonctionnalités

- **Devis** : dimensionnement des pièces (méthode au W/m²), catalogue d'unités intérieures/extérieures, calcul automatique de la TVA (6 % climatisation/PAC depuis 2026), **primes wallonnes** (PAC air-eau, coefficients éditables), acompte / conditions de paiement / CGV, **reste à charge** et **estimation d'économies (ROI)**.
- **Plan** : éditeur 2D façon planificateur — on dessine les pièces et on dépose les éléments de clim, on leur affecte un modèle du catalogue.
- **3D** : extrusion automatique du plan en maquette navigable (Three.js), avec les **photos des pièces** en texture de sol.
- **Mesure AR** : sur Android Chrome, métré des pièces directement à la caméra (WebXR), qui crée la pièce dans le plan.
- **Tableau de bord** : pipeline des devis enregistrés avec statuts (brouillon / envoyé / accepté / perdu).
- **Données** : tout est enregistré localement dans le navigateur + **export/import JSON** complet (catalogue, prix, société).

## Lancer en local

Ouvre simplement `index.html` dans un navigateur. La plupart des fonctions marchent **hors-ligne**.

Deux exceptions :
- La **vue 3D** charge Three.js depuis un CDN → connexion internet requise.
- La **mesure AR** exige une **adresse https** (donc pas en fichier local — voir déploiement) + **Chrome sur Android** + « Google Play Services for AR ».

## Déployer sur GitHub Pages

```bash
git init
git add .
git commit -m "Estim·clim Pro — version initiale"
git branch -M main
git remote add origin https://github.com/<ton-utilisateur>/<ton-repo>.git
git push -u origin main
```

Puis sur GitHub : **Settings → Pages → Source : Deploy from a branch → `main` / `root` → Save**.
L'app sera servie sur `https://<ton-utilisateur>.github.io/<ton-repo>/` — en **https**, donc la mesure AR fonctionne.

## ⚠️ À savoir (important)

- **Les données du catalogue, prix et coefficients de primes sont des exemples.** À remplacer par les vraies valeurs (onglet *Réglages*). Ne jamais montrer les montants de démo à un client.
- Le **dimensionnement est une estimation** au W/m² destinée à aller vite sur le terrain, **pas une étude thermique**.
- Les **primes wallonnes** sont indicatives → à vérifier sur [logement.wallonie.be](https://logement.wallonie.be). La climatisation air-air n'ouvre **pas** droit aux primes.
- La **mesure AR** vise une précision « bon pour chiffrer », pas géomètre (dérive ARCore, murs blancs/faible lumière la pénalisent). Approximation en rectangle.
- **Pas de backend** : mono-utilisateur, données stockées dans le navigateur. Pense à exporter régulièrement une sauvegarde.

## Structure

```
index.html     Structure de la page (charge styles.css + app.js + Three.js CDN)
styles.css     Styles
app.js         Toute la logique (vanilla JS, sans framework)
CLAUDE.md      Contexte du projet pour Claude Code
```

## Pile technique

HTML / CSS / JavaScript **vanilla**, sans build ni dépendance — sauf **Three.js** (CDN) pour la 3D et la mesure AR (WebXR).

## Roadmap (idées)

- Module **PAC air-eau** dédié (calcul de déperditions + prime automatique complète).
- Mesure AR en **polygone** (pièces en L) plutôt qu'en rectangle.
- Mode **multi-utilisateur** / synchronisation → nécessiterait un backend (Supabase/Firebase).

## Licence

MIT — voir `LICENSE`.
