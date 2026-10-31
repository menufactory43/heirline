# Audit de l'histoire et des quêtes (31 octobre 2026)

## Ce qui a été lu

- La bible (`docs/histoire.md`).
- Les 34 quêtes (`shared/quests.ts`), dont 18 de la trame, en français et en anglais (`shared/i18n/contenu/quetes.ts`).
- Les 22 habitants (`shared/npcs.ts`, `contenu/pnj.ts`) et leurs salutations selon le choix de l'acte 1.
- Les régions, leurs camps et leurs ressources (`shared/regions/`), les cartes, les donjons, le raid et les gares
  (`shared/monde.ts`).
- Les créatures et les boss (`shared/rules.ts`), les talents.

## La preuve automatique : `tools/verifier-quetes.ts`

Lancé par les tests (`tests/quetes-chaines.test.ts`). Pour chaque quête, il vérifie :

- **les habitants** : le donneur et le destinataire existent et se tiennent sur une case praticable ;
- **les prérequis** : ils existent, et chaque quête est atteignable depuis zéro en suivant les prérequis, y compris
  les deux voies de « La Constance » (`requisUn`) ; l'acte ne recule jamais le long d'une chaîne ;
- **les objectifs** :
  - les habitants à qui parler ou à escorter existent ;
  - les lieux à explorer sont des points d'intérêt des cartes (sinon l'objectif ne peut pas s'accomplir) ;
  - les textes à lire existent ;
  - les créatures à abattre vivent bien dans la région désignée (camps de la région), sauf les boss ;
  - les objets à rapporter s'obtiennent dans cette région (ressource à ramasser ou butin d'une créature qui y vit) ;
- **le niveau** : il est dans la fourchette de la région de la quête, à 2 niveaux près ;
- **la récompense** : entre 15 et 120 % de l'XP du niveau suivant, jusqu'à 150 % aux niveaux 1 et 2 ;
- **la traduction** : un nom existe en français et en anglais.

Résultat avant les corrections : 7 remarques, dont 4 vraies incohérences. Après : 0.

## Incohérences corrigées

| Où | Problème | Correction |
|---|---|---|
| Trame, acte 2 | « Le robot qui chante » (niveau 8) envoie abattre des Greffés : il n'y en a qu'au Cimetière (niveau 13 à 15) et dans les terres d'ÉDEN (16 à 20). La suite de l'acte 2 envoyait aussi des niveaux 9 et 10 dans des zones 12 à 16. | La trame suit les niveaux des régions : 12, 12, 12, 13 (acte 2), puis 13, 14, 15, 16, 17 (acte 3). « Le nid » arrive au niveau 16, celui de la Couveuse. Bible : acte 2 de 6 à 13, acte 3 de 13 à 20. |
| « Les ruches » | Rangée dans les terres d'ÉDEN (16 à 20) alors qu'elle envoie à la Ruche du Basalte, dans les Plateaux. | Zone : Plateaux, niveau 14. |
| « L'Engloutisseur » | Quête de niveau 11, proposée dès le niveau 9, pour un donjon de niveau 13. | Niveau 12. |
| « La Constance » (voie livrée) | Cantor : « HAUTE-SÈVE EST VIDE ». Or Maëlle y est toujours, et parle : « Les patrouilles du Corps tournent autour du village. » La bible disait aussi « vide ». | Cantor : « ILS NE LA DONNERONT PAS À CELUI QUI A MONTRÉ LE CHEMIN » (FR et EN). La bible est alignée sur le jeu. |
| « Ceux qui ont dit oui » | Maëlle demandait de l'aide au soldat qui avait livré son village. | Proposée seulement si Haute-Sève a été tue. |
| Ilona Marest, scribe de Port-Ancre | Même nom que Paul et Anne Marest, colons de la Constance enterrés au Tertre et chantés par Cantor : un faux indice. | Ilona Garnier, et la maison des Garnier (FR et EN). |

## Vérifié et cohérent

- **Chronologie** : −212 ÉDEN, −140 départ de la Constance, −118 chute (an 0), −96 mort de Varga (an 22), −61 la Terre
  se tait (an 57), −40 colonie vide (an 78), −31 la Patience (an 87, voyage de 110 ans). Les quêtes et l'easter egg du
  dernier message (« cinquante-sept ans après sa chute ») tombent juste.
- **Noms** : Cantor, Danet, Varga, Park, Wren et Okonkwo sont les mêmes dans les quêtes, les journaux et la bible. Les
  colons chantés (Aubert, Lenoir, Marest, Kimura) et Paul Sève, arrière-grand-père de Maëlle, aussi.
- **Les trois actes et leurs révélations** arrivent dans l'ordre de la bible (§ 5). « La sève » (acte 1) annonce que
  le Semeur « a été l'un de nous » sans le nommer : c'est une annonce, pas une fuite.
- **La règle du métal** : la Couveuse est cuirassée tant qu'aucun métal n'approche, les Rouillards sont d'anciens
  drones (pas ÉDEN), le monorail a tenu un siècle et l'Engloutisseur est de la faune.
- **Easter eggs** : la cassette, le Tamagoyle, la tombe « Elle a wipe », la plaque Tabula Rasa, le robot qui danse et la
  salle secrète sont tous présents.
- **La bible couvre maintenant** les donjons (le nid, l'Antre, le Gosier), le raid et le monorail (§ 11).

## Ce qui reste

- **La règle du métal et le combat** : les créatures d'ÉDEN tirent sur les robots et les mettent hors service. Dans la
  fiction, ÉDEN « éteint » sans détruire, ce que la règle tolère (comme la Glaneuse). Mais le jeu montre des dégâts
  chiffrés sur les robots. À trancher :
  - soit on assume dans les textes : « ÉDEN n'endommage pas, il met hors tension » ;
  - soit les coups d'ÉDEN sur les robots deviennent des « surcharges » (une autre couleur, pas de pièces arrachées).
- **Le Gosier** n'a pas de quête. Le raid porte le même nom que la dernière quête de la trame : c'est voulu (la suite),
  mais aucun habitant n'y envoie encore.
- **La fin de campagne** compare les rayons des ruches. Le raid n'entre pas dans ce calcul : à décider.
