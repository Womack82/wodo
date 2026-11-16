# Règles du projet « Wodo » (anciennement « Mes listes »)

## Le projet

- Petite web app installable (PWA) pour tenir des listes à faire : films,
  séries, jeux et livres. Son nom affiché est **Wodo** (depuis la v1.21).
- Depuis la v2.0 (15/11/2026), les recettes et cocktails ont leur propre
  app, **Toque&Tonic** (dossier `../Toque&Tonic`,
  https://womack82.github.io/toque-tonic/), née d'une copie de Wodo v1.30.
  Wodo ne permet plus d'en ajouter. Depuis la v2.6, celles qui restaient
  sont effacées au démarrage, ne sont jamais exportées ni importées, et une
  sauvegarde de Toque&Tonic est refusée : chaque app a son propre fichier
  de sauvegarde. Depuis la v2.10, le code des fiches est retiré (recettes.js,
  ia.js, photos.js, page de la fiche, Gemini) ; au démarrage, l'app efface
  encore la mémoire des photos et la clé Gemini restées sur l'appareil.
  Le relais Cloudflare sert aussi à Toque&Tonic (import de recettes) : ne
  pas retirer cette partie de `relais/worker.js`.
  Une correction du code commun n'est pas reportée automatiquement dans
  l'autre app.
- Depuis la v1.30, les noms techniques commencent par « wodo » : clés de
  la mémoire (localStorage), format des sauvegardes (`format: "wodo"`),
  nom du cache (« wodo-v… »). Les anciens noms « mes-listes… » restent
  connus : `migration.js` déplace les anciennes données, l'import accepte
  les anciennes sauvegardes. Ne pas retirer ce code ni renommer à nouveau
  sans migration : on perdrait les données déjà enregistrées.
- Le nettoyage du cache (`service-worker.js`) ne doit effacer que les
  caches de Wodo : d'autres apps sont publiées sur le même site
  (womack82.github.io).
- Publiée sur GitHub Pages : https://womack82.github.io/wodo/
  (dépôt github.com/Womack82/wodo, renommé depuis « mes-listes » le
  15/11/2026 ; l'ancienne adresse /mes-listes/ ne marche plus).
  Le relais Cloudflare garde son nom « mes-listes-relais ».
- Utilisée surtout sur iPhone.
- Les améliorations à faire et déjà faites sont suivies dans `TODO.md`.

## Façon de travailler

- L'utilisateur débute en programmation : explique brièvement ce que tu fais
  et pourquoi, avec des mots simples.
- Avant de coder, signale tout point qui pose problème (limite technique,
  risque, effet secondaire) et attends sa réponse.
- Fais un commit Git par étape, avec un message clair qui dit ce qui change.
- Après chaque commit, fais `git push` automatiquement, sans demander
  l'accord de l'utilisateur (demande faite le 15/11/2026). Le site GitHub
  Pages se met alors à jour tout seul.
- Ne mets jamais une clé API dans un fichier suivi par Git sans le dire
  clairement à l'utilisateur. Aujourd'hui, la clé TMDB et l'adresse du relais
  sont gardées uniquement dans la mémoire de l'appareil (localStorage).
  Open Library (livres) n'a pas besoin de clé.

## Version et cache

- À chaque modification, change la version du cache (`NOM_CACHE`) dans
  `service-worker.js`. Sinon, le téléphone continue d'utiliser l'ancienne copie.
- Change en même temps `VERSION` en haut de `app.js` : c'est le numéro affiché
  en haut des Réglages, et il doit rester identique à celui du cache.
- Numérotation : depuis le 15/11/2026, on est en **v2** (v2.0 : livres, et
  recettes passées dans Toque&Tonic). Chaque changement, quel qu'il soit
  (nouvelle demande ou retouche), ajoute 1 au second numéro :
  v2.0 → v2.1 → v2.2… (avant : v1.1 à v1.30, et encore avant v10 à v15.1).

## Apparence

- Mobile d'abord : boutons et zones à toucher d'au moins 44 px, texte lisible
  sans zoomer.
- Palette de couleurs :

  | Rôle                        | Couleur   | Texte posé dessus          |
  |-----------------------------|-----------|----------------------------|
  | Fond                        | `#e9eef5` | —                          |
  | Texte principal             | `#0a2342` | —                          |
  | Texte secondaire            | `#4a5d78` | —                          |
  | Accent                      | `#ff6a00` | `#0a2342` (jamais blanc)   |
  | Survol (de l'accent)        | `#ff9b54` | `#0a2342`                  |
  | Actif et secondaire         | `#2c6e9a` | blanc                      |

- Animations légères, de 150 à 280 ms, et désactivées quand l'option
  « réduire les animations » est activée sur l'appareil
  (`@media (prefers-reduced-motion: reduce)`).
- Quand l'utilisateur demande un changement d'apparence, ne modifie que
  l'apparence (CSS, présentation) : ne touche à aucune fonction.
