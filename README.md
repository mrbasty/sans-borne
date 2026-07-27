# Sans Borne

**Le comparateur des vélos électriques en libre-service à Paris.**

Sans Borne compare les forfaits **Lime**, **Dott** et **Voi** selon votre usage réel
(fréquence et durée moyenne des trajets), ramène chaque offre à un coût mensuel
comparable, classe les forfaits du moins cher au plus cher et détaille le calcul
de chaque prix.

## Fonctionnement

- Réglez votre profil d'usage (préréglages ou curseurs).
- Chaque forfait est recalculé sur une base de 30 jours en tenant compte de sa
  mécanique réelle : pass de minutes plafonnés à leur fenêtre de validité,
  abonnements à prix fixe par trajet, paliers dégressifs, dépassements au tarif
  à la minute.
- Le classement et le podium se mettent à jour en direct ; chaque ligne se déplie
  sur le détail du calcul.

## Stack

Site **statique**, sans build ni dépendances : HTML, CSS et JavaScript natif.

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page |
| `styles.css` | Styles et animations |
| `app.js` | Moteur de calcul et rendu |
| `data.js` | Tarifs des trois opérateurs (seul fichier à éditer pour mettre à jour les prix) |
| `logos/` | Logos officiels des opérateurs |
| `server.mjs` | Serveur statique pour le développement local (non déployé) |

## Développement local

```bash
node server.mjs
```

Puis ouvrir <http://localhost:4321>.

## Mise à jour des tarifs

Tout est dans [`data.js`](data.js) : prix, durées de validité, minutes incluses.
Modifiez la valeur, rechargez la page.

## Données

Tarifs relevés dans les applications le 21/07/2026, pour Paris. Les grilles
évoluent fréquemment — vérifiez dans l'application avant de souscrire. Sans Borne
est indépendant des trois opérateurs ; marques et logos appartiennent à leurs
propriétaires respectifs.
