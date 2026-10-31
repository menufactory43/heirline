# Les effets visuels d'Heirline

## Le moteur prioritaire : pixelfx

Tout effet ajouté ou refait passe d'abord par **pixelfx** (`outils/pixelfx`, copie de
[patch-gg/pixelfx](https://github.com/patch-gg/pixelfx), commit `fe7103c`, licence MIT) : 232 effets écrits en code,
plus les nôtres dans `outils/pixelfx/src/fx/heirline/`. L'ancien moteur Pixel VFX de Scenario (`outils/pixel-vfx`)
n'a pas de licence connue : il ne sert plus qu'aux recettes qui n'ont pas encore été refaites.

- **La chaîne.** `npm run vfx` rend les recettes de `vfx/recettes/` (ancien moteur), puis les effets de
  `vfx/pixelfx.mjs` ; un effet pixelfx remplace la recette du même nom. Les planches vont dans `client/public/vfx/`,
  le manifeste dans `client/src/vfx-manifest.json` (champ `pixelfx` : l'effet source). Rien n'est rendu en direct en
  jeu : sur téléphone, 20 effets pixelfx en direct coûtent 12 ms par image (mesure du 31/10, `~/essais-pixelfx`).
- **La palette.** Chaque effet est recoloré par une rampe d'Heirline (`P` dans `vfx/pixelfx.mjs` : ÉDEN, acide,
  sève, rouille, chair, cyan, givre…). Graines fixes : la même planche à chaque rendu.
- **L'échelle : « pixels fins ».** pixelfx dessine pour un personnage de 24 × 38 px, nos soldats font 16 × 20.
  `DENSITE = 2` : la planche garde sa résolution et le jeu l'affiche à × 0,5 (champ `echelle` du manifeste, appliqué
  par `client/src/vfx.ts`). Pour revenir aux mêmes pixels que nos sprites : `DENSITE = 1` (les effets deviennent
  presque deux fois plus gros). `taille` ajuste en plus les tirs et impacts que pixelfx dessine larges.
- **Le poids.** 12 images/s, longues traînes coupées (`coupe`, fondu de 0,3 s), élan sauté (`debut`), planches
  rognées. Mesure du 31/10 : le lot des 11 cas « mieux » de l'avant/après pèse 15,3 Mo en mémoire, l'ensemble des
  36 effets pixelfx 28,8 Mo ; les recettes restantes 9,1 Mo.

## Créer un effet (la méthode de pixelfx)

1. Chercher le plus proche dans `outils/pixelfx/docs/CATALOG.md`, le rendre avec la palette :
   `cd outils/pixelfx && node tools/render.mjs fire/torch --opts '{"palette":[…]}'`.
2. Sinon, en écrire un dans `src/fx/heirline/` (`node tools/new.mjs heirline/mon-effet`), en suivant
   `docs/AUTHORING.md` : lignes et lumière, phases (élan, éclat, retombée), déterministe.
3. Rendre, regarder la planche (`records/…/contact.png`), corriger le pire, recommencer.
4. `node tools/check.mjs heirline/mon-effet` jusqu'à zéro avertissement.
5. L'ajouter à `EFFETS` dans `vfx/pixelfx.mjs`, puis `npm run vfx`.

Nos effets maison restent quand ils se lisent mieux en mêlée : les zones annoncées (le glyphe), l'éclair d'alerte
de la Couveuse, les impacts du Fantassin au palier 4, l'explosion du Démolisseur.

## Les effets d'Heirline faits avec pixelfx

| Nom | Source | Où |
|---|---|---|
| `sac-creve` | `heirline/sac-chair` | le sac de ponte qui crève (chair, pas un œuf) |
| `biomasse` | `heirline/biomasse` | la chair d'ÉDEN qui gagne au bord du front, dans la vue |
| `pommier` | `heirline/pommier` | l'abri du désherbage, dans le raid du Semeur |
| `etat-marque` | `heirline/marque` | l'état « marqué » |
| `greffe`, `bouture` | `shadow/hex-sigil`, `nature/root-snare` | les zones du Semeur |
| `essaim-pep`, `epines`, `colonne-vitres` | `nature/spore-burst`, `nature/thorns`, `ice/icicle-fall` | la Serre : l'essaim, la haie d'épines, les vitres qui tombent |
| `rature`, `colonne-pages`, `encre-anneau` | `water/splash`, `nature/leaf-storm`, `fire/fire-ring` | le Registre : la rature, les pages, l'anneau d'encre (palettes encre et papier) |
| `glane`, `pince`, `appel`, `colonne-fils` | `lightning/zap-hit`, `melee/heavy-cleave`, `lightning/charge-up`, `lightning/lightning-strike` | l'assaut du Métier : le robot glané, la pince, l'appel, les fils |
| `butin-0` à `butin-5` | `pickups/loot-beam` | le rayon du butin, à la couleur de sa rareté |
| `transition` | `transitions/iris` | le passage vers une autre carte |
| `eqp-*` | `shadow/life-steal`, `nature/healing-bloom`, `pickups/collect-burst`, `impacts/ricochet` | légendaires et ensembles |

## Crédits

- **pixelfx** : Patch (patch.gg), licence MIT (`outils/pixelfx/LICENSE`). Une partie du cœur (`src/core/sim.js`) et
  certains effets adaptent les effets libres de **Hugo Duprez** (Sprite Fusion), licence MIT
  (`outils/pixelfx/NOTICE.md`). La police de leur galerie n'est pas copiée.
- **Pixel VFX** (Scenario) : copie locale, sans licence fournie, **non publiée** (hors dépôt, `.gitignore`) ; seules les images qu'il a rendues sont versionnées. À remplacer entièrement par pixelfx avant une sortie commerciale.
