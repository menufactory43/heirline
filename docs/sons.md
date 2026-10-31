# Le son de Heirline

Tout le son du jeu est sous licence **CC0** (domaine public) : pas d'obligation de crédit, usage commercial permis. On crédite quand même les auteurs (écran Son du menu, et ci-dessous).

## Comment c'est construit

- `bash tools/son/telecharger.sh` télécharge les sources dans `son/sources/` (ignoré par git).
- `~/.venvs/famcrawl-audio/bin/python -I tools/son/construire.py [sfx|amb|mus] [id…]` construit :
  - les fichiers du jeu dans `client/public/son/{sfx,amb,mus}/` ;
  - `client/src/son-manifest.json` (fichiers, volumes, bus, voix, boucles).
- `client/src/son.ts` est le moteur : WebAudio, quatre bus (musique, ambiance, effets, interface) sous un compresseur.
  - Le contexte audio s'ouvre au premier toucher (iOS) et se met en pause quand l'app passe en arrière-plan.
  - Les bruitages se chargent au premier toucher (0,9 Mo) ; musiques et ambiances seulement quand on en a besoin.
  - Spatialisation : plein volume à moins de 90 px du soldat, plus rien au-delà de 520 px, panoramique selon le côté.
  - Limite de voix par bruitage et en tout (28) ; les sons de décor (priorité 0) se taisent les premiers.
  - Variation de hauteur à chaque lecture, et jamais deux fois de suite la même variante.
- `client/src/son-jeu.ts` décide quoi jouer : les effets venus du serveur, les tirs, la marche du robot, le monorail, et la musique et l'ambiance de l'endroit.
- Réglages : menu, tuile **Son**. Quatre volumes et la coupure, gardés sur l'appareil (`heirline.son`).
- Le test `tests/son.test.ts` vérifie que chaque son demandé par le code existe, et que chaque fichier existe.

## Les sources

| Source | Auteur | Licence | Pour quoi |
|---|---|---|---|
| Sci-fi Sounds, Impact Sounds, Interface Sounds, Digital Audio, RPG Audio, UI Audio, Music Jingles | Kenney (kenney.nl) | CC0 | toute la matière des bruitages, retravaillée dans `construire.py` |
| Free Music Pack : Great mission, Flags, Doomed | Alexander Ehlers (OpenGameArt) | CC0 | `titre`, `ville`, `boss_rage` |
| Exploration Theme | Cleyton Kauffman (OpenGameArt) | CC0 | `explo` |
| Dark Sci-Fi Audio Pack : Sector, Urgent, Airy, Pulse | SRG774 (OpenGameArt) | CC0 | `sombre`, `eden`, `epave`, `nid` |
| Epic Boss Battle (boucle) | Juhani Junkala / SubspaceAudio (OpenGameArt) | CC0 | `boss` |
| Victory Fanfare Short | cynicmusic (OpenGameArt) | CC0 | `victoire` |
| Medieval: Defeat Theme | RandomMind (OpenGameArt) | CC0 | `mort` (les 11 premières secondes) |

Ce qui est organique (ÉDEN, la Couveuse, les sacs, le sol arraché) et les douze ambiances sont **synthétisés** dans `construire.py` : bruit filtré, cris en dents de scie à formants, battements, avec quelques sons Kenney semés dedans (grincements, métal, slime). Ils sont donc à nous.

## Ce qui joue où

- **Musique** :
  - Port-Ancre et les lieux habités : `ville` ;
  - plaines, fougères, plateaux : `explo` ;
  - marais, Cimetière des Machines, concessions : `sombre` ;
  - Terres d'ÉDEN : `eden` ;
  - épave de la Constance : `epave` ;
  - le nid : `nid` ;
  - l'écran titre : `titre`.
- **Boss** (arène fermée, ou Engloutisseur blessé tout près) : `boss`, puis `boss_rage` au dernier tiers. À la mort du boss, le jingle `victoire`, puis la musique reprend. Mort au-delà du front, ou évacuation : `mort`.
- **Ambiance** : une par région (`port` en bord de mer). Par-dessus :
  - `front` au-delà du front ;
  - `pluie` quand il pleut ;
  - le roulement `rail` de chaque rame (plus fort en vitesse, selon la distance).

## Limites

- Les sources sont des banques génériques : rien n'a été composé pour Heirline. Les ElevenLabs (bruitages et musique sur mesure) étaient à sec au moment du travail (environ 100 crédits jusqu'au 19 novembre 2026), et fal.ai était bloqué en attente de recharge.
- Rien n'a été écouté par une oreille humaine : les choix viennent des descriptions, de mesures (tempo, sonie, spectre) et du test des boucles. Les volumes sont à régler à l'écoute.
- `ui_ouvre` et `ui_erreur` existent mais ne sont pas encore branchés : les boutons font `ui_clic`, ou `ui_ferme` pour un bouton « danger ».
