<p align="center">
  <img src="docs/media/heirline.gif" width="560" alt="Heirline : l'arène d'un boss, des flots d'acide lumineux et des vagues de spores, quatre soldats qui esquivent sous la Couveuse.">
</p>

<h1 align="center">Heirline</h1>

<p align="center">
  <b>Un jeu de tir RPG en ligne, en 2D et en pixel art, où tes soldats meurent et ton robot continue.</b><br>
  Dans le navigateur · téléphone en paysage d'abord · français et anglais
</p>

<p align="center">
  <a href="https://heirline.praxeongames.com"><b>▶ Jouer</b></a> ·
  <a href="https://praxeongames.com/">Praxeon</a> ·
  <a href="README.md">English version</a>
</p>

---

Heirline est un petit monde en ligne, sur le continent d'Ossara. ÉDEN, une intelligence de terraformation laissée
seule pendant deux siècles, répand une biomasse vivante depuis ses ruches, et la colonie de Port-Ancre tient la côte
sud. Tu joues une **lignée**, pas un héros. Derrière le front, un soldat tombé est évacué ; au-delà, la mort est
définitive. Ton robot se plante alors en avant-poste et tient la ligne pour tout le serveur, et ton héritier reprend
le nom, le robot et ce qu'il reste de la guerre.

C'est un prototype, fait le soir, avec un serveur hébergé à la maison.

## Ce qu'il y a dedans

- **Un vrai jeu de tir à deux joysticks.** On vise, on esquive, on se met à l'abri. La prédiction côté client garde
  le soldat réactif.
- **Un front vivant.** Cinq ruches répandent la biomasse par taches, et leur bordure avec la colonie est le front.
  Les morts au-delà, les avant-postes et les raids le font bouger pour tout le monde.
- **Des lignées et des robots.** Mort définitive au-delà du front, héritiers, et un robot qui sert aussi de monture
  et qui est ta vraie progression.
- **Six classes, puis un arbre de classes.** Une spécialité au niveau 15 (12 choix) et une maîtrise au niveau 30
  (24 choix), avec des arbres de talents.
- **Deux campagnes, 70 quêtes.** *La côte de Port-Ancre* (niveaux 1 à 20) et *Les Hauts de Glane* (20 à 35),
  chacune en trois actes avec de vrais choix. Les habitants se souviennent de ce que tu as choisi, et les fins
  dépendent du front de tout le serveur.
- **Des arènes de boss.** Des salles façon shmup : motifs de balles déterministes, une seule zone annoncée à la fois.
  Un joueur parfait peut éviter toutes les zones, et un test le prouve.
- **Donjons et raids.** Quatre donjons en normal et en héroïque, deux raids à dix. Des soldats IA tiennent les rôles
  (tanks, soigneurs, tireurs) quand il manque des joueurs.
- **Butin.** Raretés, affixes, légendaires et ensembles, avec comparaison et recyclage.
- **Un monorail** qui roule vraiment sur sa ligne surélevée, d'une gare à l'autre.
- **Le social.** Canaux de discussion, groupes qui partagent leur instance, échanges sûrs en deux temps, guildes, et
  des duels qui ne tuent jamais.
- **Des agents IA qui construisent.** Les joueurs peuvent brancher leur propre agent IA par MCP et publier en direct
  des zones jouables (les « concessions »), dans un schéma fermé, avec un budget de puissance et des parties de test
  jouées par le serveur.

## Captures

| | |
|---|---|
| ![L'arène de la Couveuse](docs/media/arena.jpg) | ![Le monorail](docs/media/monorail.jpg) |
| *La Couveuse : l'arène de boss et ses motifs de balles* | *Le monorail de la Première Vague* |
| ![La Gueule](docs/media/dungeon.jpg) | ![Le raid du Semeur](docs/media/raid.jpg) |
| *La Gueule, au fond du Gosier* | *L'offensive du Semeur, un raid à dix* |
| ![Port-Ancre](docs/media/anchorport.jpg) | ![Les Champs de Fer](docs/media/highlands.jpg) |
| *Port-Ancre et ses habitants* | *Les Hauts de Glane, campagne 2* |
| ![Talents](docs/media/talents.jpg) | ![Comparaison du butin](docs/media/loot.jpg) |
| *Talents et spécialités* | *Le butin, comparé à ce que tu portes* |

Ces captures sont en anglais ; le jeu suit la langue du téléphone et se règle dans le menu.

## Comment c'est fait

- **Client :** TypeScript et [Phaser 4](https://phaser.io). Le pixel art est dessiné par le code ou rendu au build,
  et les effets viennent de [pixelfx](https://github.com/patch-gg/pixelfx), recolorés à la palette du jeu.
- **Serveur :** [Colyseus 0.18](https://colyseus.io), autoritaire à 20 Hz. L'état est rembobinable, chaque joueur ne
  reçoit que ce qui l'entoure (StateView), et chaque carte a son salon, qui ouvre des copies quand il est plein. Un
  service central tient le front, les ruches, l'heure, la météo et les choix de campagne. Les données sont dans
  SQLite.
- **Motifs déterministes :** le serveur n'envoie que « tel motif démarre maintenant, avec telle graine ». Le client
  et le serveur calculent les mêmes balles avec le même code, le serveur valide les touches, et le client les
  dessine avec un aller-retour d'avance.
- **Code partagé :** règles, cartes, quêtes et motifs sont dans `shared/`, utilisés des deux côtés.
- **Langues :** tous les textes passent par des clés typées (`shared/i18n`), en français et en anglais. Le serveur
  envoie des clés, jamais des phrases.
- **MCP :** un point d'accès Streamable HTTP (`/mcp`), protégé par une clé par joueur.

### Les chiffres

Mesurés sur un Mac mini (Apple M4), un seul processus Node, avec des bases de test jetables (détails dans
[docs/charge.md](docs/charge.md) et [docs/latence.md](docs/latence.md)) :

| Joueurs simulés | Processeur (un cœur) | Mémoire | Boucle p99 |
|---|---|---|---|
| 100 | 34 % | 328 Mo | 21 ms |
| 200 | 36 % | 329 Mo | 18 ms |
| 400 | 62 % | 395 Mo | 19 ms |

Le point de rupture est vers 850 à 900 joueurs par processus. Il n'y a pas de fuite mémoire en 15 minutes à 400
joueurs, et chaque joueur coûte de 4 à 8 Ko/s. Grâce à la prédiction, le soldat réagit à l'écran en 22 à 33 ms quel
que soit le ping. Avec 234 ms de latence simulée, aucune balle esquivée à l'écran n'a touché.

## Lancer en local

Il faut Node 22 ou plus.

```sh
npm install
npm start          # construit le client dans dist/, puis sert le jeu, l'API et le MCP sur http://localhost:2700
npm run dev        # développement : serveur (tsx watch, 2700) + Vite (5190)
npm test           # 134 tests : règles, motifs, quêtes, réseau, social, campagnes
```

Le guide de développement (commandes, variables, API des agents) est dans
[docs/developpement.md](docs/developpement.md). La bible de l'univers est dans [docs/histoire.md](docs/histoire.md),
et la spécification dans [SPEC.md](SPEC.md).

## Crédits

- Conception, code et direction artistique : Gabriel, pour [Praxeon](https://praxeongames.com/).
- Effets : [pixelfx](https://github.com/patch-gg/pixelfx) de Patch (MIT), d'après la méthode de Hugo Duprez.
- Sons et musiques : CC0, par Kenney, Alexander Ehlers, Cleyton Kauffman, SRG774, Juhani Junkala, cynicmusic et
  RandomMind. La liste complète est dans [docs/sons.md](docs/sons.md).
- Inspiration : le genre des RPG d'action en ligne, et le souvenir de *Tabula Rasa* (2007), un jeu de tir RPG avec
  une guerre qui bouge et un arbre de classes. Heirline n'est affilié à aucun de ces jeux. Il n'en reprend que les
  conventions du genre, et chaque mécanique de boss passe un contrôle anti-copie.

## Licence

Le code est visible pour être lu, mais ce n'est pas de l'open source : tous droits réservés. Les parties de tiers
gardent leur licence (pixelfx en MIT, les sons en CC0). Voir [LICENSE](LICENSE).
