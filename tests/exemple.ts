// Une concession d'exemple, valide, utilisée par les tests et la doc.
export const exemple = {
  nom: 'La Serre Noire',
  description: 'Une ancienne serre que la biomasse a reprise. Trois vagues, puis une Couveuse mineure.',
  taille: { largeur: 36, hauteur: 22 },
  sol: 'dalle',
  murs: [
    { x: 12, y: 4, l: 2, h: 6, type: 'metal' },
    { x: 12, y: 13, l: 2, h: 5, type: 'metal' },
    { x: 22, y: 8, l: 3, h: 2, type: 'caisse' },
    { x: 26, y: 14, l: 4, h: 2, type: 'chair' },
  ],
  depart: { x: 4, y: 11 },
  vagues: [
    { delai: 2, groupes: [{ brique: 'rampant', nombre: 6, x: 24, y: 5 }] },
    { delai: 6, groupes: [{ brique: 'rampant', nombre: 5, x: 28, y: 18 }, { brique: 'cracheur', nombre: 2, x: 30, y: 6 }] },
    { delai: 6, groupes: [{ brique: 'cuirasse', nombre: 2, x: 30, y: 11, variante: { teinte: '#8ad0ff' } }, { brique: 'oeuf', nombre: 2, x: 20, y: 17 }] },
  ],
  boss: { brique: 'couveuse_mineure', x: 30, y: 11, pv: 0.35 },
  textes: { intro: 'La serre respire.', victoire: 'La serre se tait.' },
}
