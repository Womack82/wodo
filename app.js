// ============================================================
// app.js : toute la logique de l'application
// ============================================================

// Numéro de version affiché à côté du logo.
// ⚠️ Doit toujours être le même que NOM_CACHE dans service-worker.js
// Chaque changement, quel qu'il soit, ajoute 1 au second numéro
// (v2.0 → v2.1 → v2.2…). v1.1 à v1.30 : avant la v2.0 (15/11/2026 : livres,
// recettes et cocktails passés dans Toque&Tonic). Avant le 10/11/2026 : v10 à v15.1.
const VERSION = "v2.10";

// Noms sous lesquels on range les données dans la mémoire du téléphone.
// Avant la v1.30, ils commençaient par « mes-listes » : migration.js
// déplace les anciennes données sous les nouveaux noms.
const CLE_STOCKAGE = "wodo";
// Ancien historique « Supprimés » (titre, type, date des éléments supprimés),
// retiré en v1.18 : la suppression est maintenant définitive. L'historique
// déjà enregistré est effacé de l'appareil au démarrage.
const CLE_SUPPRIMES_ANCIENNE = "mes-listes-supprimes";
try {
  localStorage.removeItem(CLE_SUPPRIMES_ANCIENNE);
} catch {
  // mémoire inaccessible : rien à faire
}

// Emoji affiché devant chaque type
const EMOJIS = { film: "🎬", serie: "📺", jeu: "🎮", livre: "📖", autre: "📌" };

// Recettes et cocktails (« fiches ») : depuis la v2.0, ils vivent dans
// l'app Toque&Tonic. Wodo ne sait plus les afficher (code retiré en v2.10) :
// ce nom sert seulement à les effacer au démarrage et à les laisser de côté
// quand on importe une ancienne sauvegarde.
const FICHES = new Set(["recette", "cocktail"]);
const estFiche = (type) => FICHES.has(type);

// Début de l'adresse des affiches TMDB (w185 = largeur 185 pixels)
const ADRESSE_AFFICHES = "https://image.tmdb.org/t/p/w185";

// --- 1. Charger les données sauvegardées --------------------
// localStorage ne stocke que du texte : on transforme le texte en
// tableau avec JSON.parse. Si rien n'est enregistré, on part d'un tableau vide.
function charger(cle) {
  try {
    return JSON.parse(localStorage.getItem(cle)) || [];
  } catch (erreur) {
    console.error("Impossible de lire les données :", erreur);
    return [];
  }
}

// --- 2. Sauvegarder les données ------------------------------
function sauvegarder() {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(elements));
}

// Les éléments de la liste. Chacun ressemble à :
// { id: "1731...", titre: "Inception", type: "film", fait: false }
let elements = charger(CLE_STOCKAGE);


// Séparation avec Toque&Tonic (v2.6) : les recettes et cocktails restés
// dans Wodo (déjà copiés dans Toque&Tonic) sont effacés de la mémoire. Les
// sauvegardes de Wodo ne contiennent ainsi plus que films, séries, jeux,
// livres et notes.
function retirerFiches() {
  const avant = elements.length;
  elements = elements.filter((el) => !estFiche(el.type));
  if (elements.length !== avant) sauvegarder();
}
retirerFiches();

// Ménage du code des recettes retiré en v2.10 :
// - la mémoire des photos (IndexedDB), qui ne servait qu'aux photos des
//   recettes : effacée en entier (nom actuel et nom d'avant la v1.30) ;
// - la clé et le modèle Gemini (ajout de recettes avec l'IA) : effacés.
try {
  if (window.indexedDB) {
    indexedDB.deleteDatabase("wodo-photos");
    indexedDB.deleteDatabase("mes-listes-photos");
  }
} catch {
  // mémoire des photos inaccessible : rien à faire
}
try {
  for (const cle of ["wodo-cle-gemini", "wodo-modele-gemini", "mes-listes-cle-gemini", "mes-listes-modele-gemini"]) {
    localStorage.removeItem(cle);
  }
} catch {
  // mémoire inaccessible : rien à faire
}

// La page affichée : "accueil" ou une catégorie ("film", "serie", "jeu", "livre")
let pageActive = "accueil";

// On récupère les morceaux de la page dont on a besoin
// Le calque « Ajouter » : formulaire et champ titre
const formulaire = document.getElementById("formulaire-ajout");
const champTitre = document.getElementById("champ-titre");
// En-tête, pages et barre du bas
const entetePetit = document.getElementById("entete-petit");
const enteteGrand = document.getElementById("entete-grand");
const boutonAccueil = document.getElementById("bouton-accueil");
const pageAccueil = document.getElementById("page-accueil");
const pageCategorie = document.getElementById("page-categorie");
const carres = document.querySelectorAll(".carre");
const listeRecents = document.getElementById("liste-recents");
const recentsVide = document.getElementById("recents-vide");
const liste = document.getElementById("liste");
const messageVide = document.getElementById("message-vide");
const mentionTmdb = document.getElementById("mention-tmdb");
const mentionIgdb = document.getElementById("mention-igdb");
const mentionOpenLibrary = document.getElementById("mention-openlibrary");
const onglets = document.querySelectorAll(".onglet");
// Dans le panneau Réglages
const listeFaits = document.getElementById("liste-faits");
const faitsVide = document.getElementById("faits-vide");
const listeAutres = document.getElementById("liste-autres");
const badgeAutres = document.getElementById("badge-autres");
const ligneAutres = document.getElementById("ligne-autres");

// Nom du type affiché sous le titre des cartes
const NOMS_SIMPLES = { film: "Film", serie: "Série", jeu: "Jeu", livre: "Livre", autre: "Autre" };

// Icônes des types, dessinées en SVG (24 × 24) pour pouvoir les colorer :
// pellicule, écran, manette, livre ouvert, punaise
const ICONES_TYPES = {
  film: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M7 3v18 M17 3v18 M3 7.5h4 M3 12h18 M3 16.5h4 M17 7.5h4 M17 16.5h4",
  serie: "M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M8 3l4 4 4-4",
  jeu: "M7 8h10a5 5 0 0 1 5 5v1a3.5 3.5 0 0 1-6.3 2.1L14.5 15h-5l-1.2 1.1A3.5 3.5 0 0 1 2 14v-1a5 5 0 0 1 5-5z M7.5 10.5v4 M5.5 12.5h4 M16 11.5h.01 M18 13.5h.01",
  livre: "M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z M12 6.5v13",
  autre: "M9 3h6 M10 3v6l-3 4h10l-3-4V3 M12 13v8",
};

// Fabrique une icône SVG à partir d'un tracé (trait de la couleur du texte)
function creerIcone(trace, classe = "icone-svg") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", classe);
  svg.setAttribute("aria-hidden", "true");
  const chemin = document.createElementNS(ns, "path");
  chemin.setAttribute("d", trace);
  svg.append(chemin);
  return svg;
}

// Les 4 catégories de la navigation (« Autre » n'en fait plus partie :
// ses anciens éléments sont gardés et visibles dans Réglages → Autres)
const NOMS_PLURIELS = { film: "Films", serie: "Séries", jeu: "Jeux", livre: "Livres" };
// Petit texte d'une page catégorie : « 12 à voir », « 3 à jouer », « 2 à lire »
const VERBES = { film: "à voir", serie: "à voir", jeu: "à jouer", livre: "à lire" };

// Date d'ajout d'un élément : son identifiant est l'heure de création
// (Date.now()). Renvoie null si l'identifiant n'est pas une date.
function dateAjout(el) {
  const temps = Number(el.id);
  return Number.isFinite(temps) && temps > 1e12 ? new Date(temps) : null;
}

// « Ajouté aujourd'hui », « Ajouté hier », « Ajouté il y a 5 jours »
function texteAjout(el) {
  const date = dateAjout(el);
  if (!date) return "";
  const minuit = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jours = Math.round((minuit(new Date()) - minuit(date)) / 86400000);
  if (jours <= 0) return "Ajouté aujourd'hui";
  if (jours === 1) return "Ajouté hier";
  return `Ajouté il y a ${jours} jours`;
}

// --- 3. Afficher les pages et les listes ----------------------
// Accueil : 4 carrés (nombre à faire) + 4 derniers ajoutés.
// Page catégorie : les éléments à faire de cette catégorie.
// Panneau Réglages : terminés, anciens « Autre ».
// animer = true : les cartes apparaissent en fondu, l'une après l'autre
// (seulement en arrivant sur une page, pas après chaque coche).
function afficher(animer = false) {
  const aFaire = elements.filter((el) => !el.fait);
  const faits = elements.filter((el) => el.fait);
  const autres = aFaire.filter((el) => el.type === "autre");

  // Carrés de l'accueil
  for (const carre of carres) {
    carre.querySelector(".carre-nombre").textContent =
      aFaire.filter((el) => el.type === carre.dataset.type).length;
  }

  // Derniers ajoutés (les 4 catégories), du plus récent au plus ancien.
  // Les anciens « Autre » n'y sont pas : ils restent dans Réglages.
  const recents = aFaire.filter((el) => Object.hasOwn(NOMS_PLURIELS, el.type))
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
    .slice(0, 4);
  listeRecents.replaceChildren(...recents.map((el) => creerCarte(el, true)));
  recentsVide.hidden = recents.length > 0;

  // Page catégorie
  liste.innerHTML = "";
  if (pageActive !== "accueil") {
    const toutes = elements.filter((el) => el.type === pageActive);
    const visibles = aFaire.filter((el) => el.type === pageActive);
    for (const el of visibles) liste.append(creerCarte(el));
    messageVide.textContent = toutes.length === 0
      ? "Rien ici pour l'instant. Appuie sur + pour ajouter."
      : "Tout est fait ! 🎉";
    messageVide.hidden = visibles.length > 0;
    entetePetit.textContent = `${visibles.length} ${VERBES[pageActive]}`;
  }

  // Panneau Réglages
  listeFaits.replaceChildren(...faits.map((el) => creerCarte(el)));
  listeAutres.replaceChildren(...autres.map((el) => creerCarte(el)));
  badgeAutres.textContent = autres.length;
  ligneAutres.hidden = autres.length === 0;
  faitsVide.hidden = faits.length > 0;

  if (animer && !sansAnimation.matches) {
    const blocs = pageActive === "accueil"
      ? [...carres, ...listeRecents.children]
      : [...liste.children];
    blocs.forEach((bloc, rang) => {
      bloc.style.setProperty("--rang", Math.min(rang, 8));
      bloc.classList.remove("apparition");
      void bloc.offsetWidth; // relance l'animation si le bloc l'avait déjà
      bloc.classList.add("apparition");
    });
  }
}

// Change de page : "accueil" ou une catégorie ("film", "serie"…)
function allerA(page) {
  pageActive = page;
  const accueil = page === "accueil";
  pageAccueil.hidden = !accueil;
  pageCategorie.hidden = accueil;
  enteteSalut();
  // Catégorie surlignée dans la barre (le bouton Accueil garde toujours
  // le même style ; aria-current indique la page aux lecteurs d'écran)
  boutonAccueil.toggleAttribute("aria-current", accueil);
  for (const onglet of onglets) {
    const actif = onglet.dataset.type === page;
    onglet.classList.toggle("actif", actif);
    onglet.toggleAttribute("aria-current", actif);
  }
  // Mentions TMDB (films, séries), IGDB (jeux) ou Open Library (livres) en bas de la page
  mentionTmdb.hidden = page !== "film" && page !== "serie";
  mentionIgdb.hidden = page !== "jeu";
  mentionOpenLibrary.hidden = page !== "livre";
  window.scrollTo(0, 0);
  afficher(true);
}

// Prénom affiché sur l'accueil : gardé sur l'appareil (Réglages → Prénom),
// « Womack » s'il n'a jamais été changé
const CLE_PRENOM = "wodo-prenom";
const PRENOM_PAR_DEFAUT = "Womack";
function lirePrenom() {
  try {
    return localStorage.getItem(CLE_PRENOM) || PRENOM_PAR_DEFAUT;
  } catch {
    return PRENOM_PAR_DEFAUT;
  }
}

// En-tête de l'accueil : « Bonjour » (petit) et le prénom (grand).
// Page catégorie : le nom de la catégorie en grand ; le petit texte
// (« 12 à voir ») est écrit par afficher().
function enteteSalut() {
  if (pageActive === "accueil") {
    entetePetit.textContent = "Bonjour";
    enteteGrand.textContent = lirePrenom();
  } else {
    enteteGrand.textContent = NOMS_PLURIELS[pageActive];
  }
}

// Fabrique la carte <li> d'un élément :
// vignette + titre + type/année (+ date d'ajout sur l'accueil) ; un appui
// ouvre le panneau d'actions. À droite, une case ronde pour cocher.
function creerCarte(el, avecDate = false) {
  const li = document.createElement("li");
  li.className = "carte";
  li.dataset.id = el.id; // pour retrouver la carte et la faire glisser (animations)
  if (el.fait) li.classList.add("fait");

  // Toute la partie gauche est un bouton : il ouvre le panneau d'actions
  const corps = document.createElement("button");
  corps.type = "button";
  corps.className = "carte-corps";
  corps.addEventListener("click", () => ouvrirActions(el.id));

  // Titre en gras (textContent empêche d'injecter du code HTML par erreur)
  const titre = document.createElement("span");
  titre.className = "carte-titre";
  titre.textContent = el.titre;

  // Ligne grise : type, année et auteur (livres) s'ils existent
  const details = document.createElement("span");
  details.className = "carte-details";
  details.textContent = [NOMS_SIMPLES[el.type], el.annee, el.auteur].filter(Boolean).join(" · ");

  const textes = document.createElement("span");
  textes.className = "carte-textes";
  textes.append(titre, details);

  // « Ajouté hier » (en bleu), sur l'accueil seulement
  const quand = avecDate ? texteAjout(el) : "";
  if (quand) {
    const date = document.createElement("span");
    date.className = "carte-date";
    date.textContent = quand;
    textes.append(date);
  }
  // Vignette : l'affiche (films, séries), la jaquette (jeux) ou la couverture (livres)
  corps.append(creerVignette(el.affiche, el.type), textes);

  // Case ronde : une vraie case à cocher, cachée, et un rond dessiné à côté.
  // Le <label> autour fait 44 px pour que le doigt ne la rate pas.
  const zone = document.createElement("label");
  zone.className = "case-ronde";
  const caseACocher = document.createElement("input");
  caseACocher.type = "checkbox";
  caseACocher.checked = el.fait;
  caseACocher.setAttribute("aria-label", el.fait ? `Remettre à faire : ${el.titre}` : `Marquer comme terminé : ${el.titre}`);
  caseACocher.addEventListener("change", () => basculer(el.id, li));
  const rond = document.createElement("span");
  rond.className = "rond";
  rond.append(creerIcone("M6 12.5l4 4 8-9", "coche"));
  zone.append(caseACocher, rond);

  li.append(corps, zone);
  return li;
}

// --- 4. Les actions ------------------------------------------
// infos (facultatif) :
// - TMDB (films, séries) : { annee, affiche, idTmdb } (+ idImdb, cherché juste après)
// - IGDB (jeux)          : { annee, affiche (jaquette), idIgdb } (anciens jeux RAWG : { annee, idRawg })
// - Open Library (livres): { annee, affiche (couverture), auteur, idOpenLibrary }
function ajouter(titre, type, infos = null) {
  const el = {
    id: Date.now().toString(), // identifiant unique basé sur l'heure
    titre: titre,
    type: type,
    fait: false,
  };
  if (infos) {
    if (infos.annee) el.annee = infos.annee;
    if (infos.affiche) el.affiche = infos.affiche;
    if (infos.idTmdb) el.idTmdb = infos.idTmdb;
    if (infos.idRawg) el.idRawg = infos.idRawg;
    if (infos.idIgdb) el.idIgdb = infos.idIgdb;
    if (infos.auteur) el.auteur = infos.auteur;
    if (infos.idOpenLibrary) el.idOpenLibrary = infos.idOpenLibrary;
  }
  elements.push(el);
  sauvegarder();
  afficher();
  // Film ou série venu de TMDB : on va chercher son identifiant IMDb
  if (el.idTmdb) completerImdb(el);
}

// Retire les informations venues de TMDB, IGDB, RAWG ou Open Library
// (affiche, année, auteur, identifiants)
function retirerInfosExternes(el) {
  delete el.auteur;
  delete el.idOpenLibrary;
  delete el.annee;
  delete el.affiche;
  delete el.idTmdb;
  delete el.idImdb;
  delete el.idRawg;
  delete el.idIgdb;
}

// « Réduire les animations » activé sur le téléphone ?
const sansAnimation = window.matchMedia("(prefers-reduced-motion: reduce)");

// Cocher / décocher. La coche est enregistrée tout de suite ; seul
// l'affichage attend la fin de l'animation :
// 1. la case se remplit (150 ms, en CSS)
// 2. la carte disparaît en fondu (220 ms, classe "sortie")
// 3. la liste est redessinée et les autres cartes remontent en glissant
function basculer(id, carte = null) {
  const el = elements.find((e) => e.id === id);
  el.fait = !el.fait; // true devient false et inversement
  sauvegarder();

  if (!carte || sansAnimation.matches) {
    afficher();
    return;
  }
  setTimeout(() => {
    carte.classList.add("sortie");
    setTimeout(afficherEnDouceur, 220);
  }, 150);
}

// Redessine les listes, puis fait glisser chaque carte restante de son
// ancienne place vers la nouvelle (au lieu de sauter d'un coup).
// On mesure les positions avant et après, et on anime seulement "transform".
function afficherEnDouceur() {
  const cle = (carte) => `${carte.parentElement.id}/${carte.dataset.id}`;
  const avant = new Map();
  for (const carte of document.querySelectorAll(".carte[data-id]")) {
    avant.set(cle(carte), carte.getBoundingClientRect().top);
  }
  afficher();
  for (const carte of document.querySelectorAll(".carte[data-id]")) {
    const ancienHaut = avant.get(cle(carte));
    if (ancienHaut === undefined) continue; // carte nouvelle dans cette liste
    const ecart = ancienHaut - carte.getBoundingClientRect().top;
    if (Math.abs(ecart) < 1) continue; // n'a pas bougé
    carte.animate(
      [{ transform: `translateY(${ecart}px)` }, { transform: "none" }],
      { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );
  }
}

// Change le titre et le type d'un élément
function modifier(id, titre, type) {
  const el = elements.find((e) => e.id === id);
  // Si le type change, les infos TMDB / IGDB ne correspondent plus
  // (un identifiant TMDB de film ne désigne pas la même chose côté séries)
  if (type !== el.type) retirerInfosExternes(el);
  el.titre = titre;
  el.type = type;
  sauvegarder();
  afficher();
}

// Suppression définitive (plus d'historique « Supprimés » depuis la v1.18).
function supprimer(id) {
  elements = elements.filter((e) => e.id !== id);
  sauvegarder();
  afficher();
}

// --- 4 bis. Le panneau d'actions (monte du bas de l'écran) ---
// S'ouvre quand on touche une carte : Voir sur IMDb (ou Open Library), Modifier, Supprimer.
const panneauActions = document.getElementById("panneau-actions");
const actionsTitre = document.getElementById("actions-titre");
const actionsBoutons = document.getElementById("actions-boutons");
const actionsImdb = document.getElementById("actions-imdb");
const actionsOpenLibrary = document.getElementById("actions-openlibrary");
const actionsModifier = document.getElementById("actions-modifier");
const actionsSupprimer = document.getElementById("actions-supprimer");
const actionsEdition = document.getElementById("actions-edition");
const editionTitre = document.getElementById("edition-titre");
const editionType = document.getElementById("edition-type");

// L'élément concerné par le panneau (null = panneau fermé)
let idActions = null;
let minuteurConfirmation = null;

// Le menu des types du panneau : « 🎬 Film », « 📺 Série »…
// « Autre » n'est proposé que pour un élément qui est déjà de ce type
// (catégorie retirée de Wodo : on ne peut plus en créer, mais on peut
// garder les anciens).
function remplirTypes(typeActuel) {
  editionType.replaceChildren();
  for (const type of Object.keys(NOMS_SIMPLES)) {
    if (type === "autre" && type !== typeActuel) continue;
    editionType.append(new Option(`${EMOJIS[type]} ${NOMS_SIMPLES[type]}`, type));
  }
}

// Remet le bouton « Supprimer » dans son état normal
function annulerConfirmation() {
  clearTimeout(minuteurConfirmation);
  actionsSupprimer.textContent = "Supprimer";
  actionsSupprimer.classList.remove("confirmer");
}

function ouvrirActions(id) {
  const el = elements.find((e) => e.id === id);
  if (!el) return;
  idActions = id;
  actionsTitre.textContent = el.titre;
  // Lien IMDb seulement pour les films et séries qui en ont un
  actionsImdb.hidden = !el.idImdb;
  if (el.idImdb) actionsImdb.href = `https://www.imdb.com/title/${el.idImdb}/`;
  // Lien Open Library pour les livres qui en ont un
  actionsOpenLibrary.hidden = !el.idOpenLibrary;
  if (el.idOpenLibrary) actionsOpenLibrary.href = `https://openlibrary.org/works/${el.idOpenLibrary}`;
  annulerConfirmation();
  actionsBoutons.hidden = false;
  actionsEdition.hidden = true;
  panneauActions.showModal();
}

function fermerActions() {
  annulerConfirmation();
  idActions = null;
  panneauActions.close();
}

// Ouvre la modification d'un élément dans le panneau du bas : titre, type
function ouvrirEdition(id) {
  const el = elements.find((e) => e.id === id);
  if (!el) return;
  idActions = id;
  annulerConfirmation();
  editionTitre.value = el.titre;
  remplirTypes(el.type);
  editionType.value = el.type;
  actionsTitre.textContent = el.titre;
  actionsBoutons.hidden = true;
  actionsEdition.hidden = false;
  if (!panneauActions.open) panneauActions.showModal();
  panneauActions.scrollTop = 0;
  editionTitre.focus();
}

actionsModifier.addEventListener("click", () => ouvrirEdition(idActions));

actionsEdition.addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const nouveauTitre = editionTitre.value.trim();
  if (nouveauTitre === "" || idActions === null) return;
  modifier(idActions, nouveauTitre, editionType.value);
  fermerActions();
});

document.getElementById("edition-annuler").addEventListener("click", () => {
  actionsEdition.hidden = true;
  actionsBoutons.hidden = false;
});

// « Supprimer » : premier appui → « Confirmer la suppression ? » pendant
// 3 secondes ; deuxième appui → l'élément est supprimé définitivement
actionsSupprimer.addEventListener("click", () => {
  if (idActions === null) return;
  if (actionsSupprimer.classList.contains("confirmer")) {
    supprimer(idActions);
    fermerActions();
    return;
  }
  actionsSupprimer.textContent = "Confirmer la suppression ?";
  actionsSupprimer.classList.add("confirmer");
  minuteurConfirmation = setTimeout(annulerConfirmation, 3000);
});

document.getElementById("actions-annuler").addEventListener("click", fermerActions);
// Échap (clavier) ferme aussi le panneau : on remet tout à zéro
panneauActions.addEventListener("close", () => {
  annulerConfirmation();
  idActions = null;
});

// Un appui sur le voile sombre (autour du panneau) ferme le panneau.
// Le contenu est dans un <div> intérieur : un clic qui vise le <dialog>
// lui-même est donc forcément un clic sur le voile.
function fermerSurVoile(panneau, fermer) {
  panneau.addEventListener("click", (evenement) => {
    if (evenement.target === panneau) fermer();
  });
}
fermerSurVoile(panneauActions, fermerActions);

// --- 4 ter. Le panneau Réglages (descend du haut de l'écran) ---
const panneauReglages = document.getElementById("panneau-reglages");
const reglagesTitre = document.getElementById("reglages-titre");
const reglagesRetour = document.getElementById("reglages-retour");
const VUES = {
  menu: { titre: "Réglages", bloc: document.getElementById("vue-menu") },
  prenom: { titre: "Prénom", bloc: document.getElementById("vue-prenom") },
  faits: { titre: "Terminés", bloc: document.getElementById("vue-faits") },
  autres: { titre: "Anciens « Autre »", bloc: document.getElementById("vue-autres") },
  sauvegarde: { titre: "Sauvegarde", bloc: document.getElementById("vue-sauvegarde") },
  cles: { titre: "Clés API", bloc: document.getElementById("vue-cles") },
  relais: { titre: "Relais (jeux)", bloc: document.getElementById("vue-relais") },
};

// Montre une seule vue du panneau ; la flèche de retour hors du menu
function afficherVue(nom) {
  for (const [cle, vue] of Object.entries(VUES)) vue.bloc.hidden = cle !== nom;
  reglagesTitre.textContent = VUES[nom].titre;
  reglagesRetour.hidden = nom === "menu";
}

document.getElementById("bouton-reglages").addEventListener("click", () => {
  afficherVue("menu");
  panneauReglages.showModal();
});
for (const ligne of document.querySelectorAll(".ligne-reglage")) {
  // « Notes » ouvre sa propre page (voir notes.js), pas une vue du panneau
  if (!ligne.dataset.vue) continue;
  ligne.addEventListener("click", () => afficherVue(ligne.dataset.vue));
}
reglagesRetour.addEventListener("click", () => afficherVue("menu"));
const fermerReglages = () => panneauReglages.close();
document.getElementById("reglages-fermer").addEventListener("click", fermerReglages);
fermerSurVoile(panneauReglages, fermerReglages);

// --- 4 quater bis. Navigation : accueil, catégories ----------
boutonAccueil.addEventListener("click", () => allerA("accueil"));
for (const carre of carres) {
  carre.querySelector(".carre-pastille").append(creerIcone(ICONES_TYPES[carre.dataset.type]));
  carre.addEventListener("click", () => allerA(carre.dataset.type));
}
for (const onglet of onglets) {
  onglet.querySelector(".onglet-icone").append(creerIcone(ICONES_TYPES[onglet.dataset.type]));
  onglet.addEventListener("click", () => allerA(onglet.dataset.type));
}

// --- 4 quater. Ajouter un élément : menu des catégories, puis calque de saisie ---
const feuilleAjout = document.getElementById("feuille-ajout");
const ajoutIcone = document.getElementById("ajout-icone");
const ajoutTitre = document.getElementById("ajout-titre");
const ajoutDirect = document.getElementById("ajout-direct");
const zoneResultats = document.getElementById("zone-resultats");
const ajoutTelQuel = document.getElementById("ajout-tel-quel");
const mentionSource = document.getElementById("mention-source");
// Adresse du relais Cloudflare (recherche de jeux), gardée sur l'appareil
const CLE_RELAIS = "wodo-relais";

// Catégorie choisie dans le menu (film, serie, jeu, livre)
let categorieAjout = "film";
// true quand la recherche de jeux (IGDB, via le relais) a échoué ou que le relais manque :
// le calque passe en saisie manuelle jusqu'à sa fermeture
let rechercheJeuxIndisponible = false;
function categorieChoisie() {
  return categorieAjout;
}

// Titre du calque et texte indicatif du champ, selon la catégorie
const TITRES_AJOUT = {
  film: "Ajouter un film",
  serie: "Ajouter une série",
  jeu: "Ajouter un jeu",
  livre: "Ajouter un livre",
};
const INDICATIONS = {
  film: "Nom du film",
  serie: "Nom de la série",
  jeu: "Nom du jeu",
  livre: "Titre ou auteur du livre",
};

// Mention de la source des données, en bas de la liste de résultats
const MENTIONS = {
  film: "Données films et séries fournies par TMDB",
  serie: "Données films et séries fournies par TMDB",
  jeu: "Données jeux vidéo fournies par IGDB",
  livre: "Données livres fournies par Open Library",
};

// Dernière ligne de la liste : « Ajouter « titre » tel quel », qui suit ce
// qui est tapé (cachée tant que le champ est vide)
function majTelQuel() {
  const titre = champTitre.value.trim();
  ajoutTelQuel.textContent = `Ajouter « ${titre} » tel quel`;
  // Saisie manuelle des jeux : le bouton orange « Ajouter » la remplace
  ajoutTelQuel.hidden = titre === "" || rechercheJeuxIndisponible;
}

// Quand le clavier de l'iPhone s'ouvre, la page ne rétrécit pas : il
// recouvre le bas de l'écran. On mesure la partie vraiment visible
// (visualViewport) pour caler le calque juste au-dessus du clavier et
// limiter sa hauteur à cette partie visible (voir .feuille dans style.css).
function ajusterAuClavier() {
  const vue = window.visualViewport;
  if (!vue) return; // vieux navigateur : on laisse faire
  const clavier = Math.max(0, window.innerHeight - vue.height - vue.offsetTop);
  feuilleAjout.style.setProperty("--clavier", `${clavier}px`);
  feuilleAjout.style.setProperty("--visible", `${vue.height}px`);
  // Même mesure pour les panneaux (Modifier, Réglages) : ils
  // restent au-dessus du clavier et jamais plus hauts que la partie visible
  const racine = document.documentElement.style;
  racine.setProperty("--clavier-ecran", `${clavier}px`);
  racine.setProperty("--visible-ecran", `${vue.height}px`);
  // Un site ne peut pas demander si le clavier est ouvert : on le devine
  // quand plus de 100 px du bas de l'écran sont cachés
  feuilleAjout.classList.toggle("clavier-ouvert", clavier > 100);
}

// Empêche la page derrière le menu et le calque de défiler :
// classe « verrou » sur <html> tant que l'un des deux est ouvert
function verrouillerPage() {
  document.documentElement.classList.add("verrou");
}
function deverrouillerPage() {
  const pageNotesOuverte = document.getElementById("page-notes").open;
  if (!menuCategories.open && !feuilleAjout.open && !pageNotesOuverte) {
    document.documentElement.classList.remove("verrou");
  }
}
// Sur iPhone, glisser le doigt sur une partie fixe (voile, en-tête, champ)
// fait quand même bouger l'écran : on l'interdit partout, sauf dans la
// liste de résultats (qui doit défiler) et les champs (pour placer le curseur)
function bloquerGlissement(panneau) {
  panneau.addEventListener("touchmove", (evenement) => {
    const cible = evenement.target;
    if (!zoneResultats.contains(cible) && !cible.matches("input, textarea")) evenement.preventDefault();
  }, { passive: false });
}

// Ouvre le calque de saisie pour une catégorie
function ouvrirAjout(type) {
  categorieAjout = type;
  const avecRecherche = sourcePourType(type) !== null; // film, série, jeu, livre
  ajoutIcone.replaceChildren(creerIcone(ICONES_TYPES[type]));
  ajoutTitre.textContent = TITRES_AJOUT[type];
  champTitre.placeholder = INDICATIONS[type];
  champTitre.value = "";
  // Avec recherche : liste de résultats ; sinon : bouton « Ajouter »
  zoneResultats.hidden = !avecRecherche;
  ajoutDirect.hidden = avecRecherche;
  // Avec recherche, le calque prend toute la hauteur visible (la liste
  // remplit la place) ; sans, il est juste assez haut pour le champ
  feuilleAjout.classList.toggle("avec-recherche", avecRecherche);
  // Touche du clavier : « Rechercher » ou « OK » (lue par l'iPhone au focus)
  champTitre.enterKeyHint = avecRecherche ? "search" : "done";
  mentionSource.textContent = MENTIONS[type] || "";
  rechercheJeuxIndisponible = false; // chaque ouverture retente la recherche de jeux
  masquerRecherche();
  // Jeu sans relais : saisie manuelle tout de suite
  if (type === "jeu" && lireCle(CLE_RELAIS) === "") passerJeuxEnManuel(true);
  ajusterAuClavier();
  verrouillerPage();
  feuilleAjout.showModal();
  // Focus dans le champ tout de suite (pendant l'appui) : c'est la condition
  // pour que l'iPhone accepte d'ouvrir le clavier
  champTitre.focus();
}

function fermerAjout() {
  masquerRecherche();
  feuilleAjout.close();
}

// --- Menu des catégories (bouton +) ---
// Le bouton + ouvre le menu ; un appui sur une catégorie ferme le menu et
// ouvre le calque de saisie tout de suite (pendant l'appui : sinon l'iPhone
// refuse d'ouvrir le clavier).
const menuCategories = document.getElementById("menu-categories");
function ouvrirMenu() {
  verrouillerPage();
  menuCategories.showModal();
}
const fermerMenu = () => menuCategories.close();
menuCategories.addEventListener("close", deverrouillerPage);
bloquerGlissement(menuCategories);
for (const choix of menuCategories.querySelectorAll(".choix-menu")) {
  choix.querySelector(".rond-menu").append(creerIcone(ICONES_TYPES[choix.dataset.type]));
  choix.addEventListener("click", () => {
    fermerMenu();
    ouvrirAjout(choix.dataset.type);
  });
}
document.getElementById("menu-fermer").addEventListener("click", fermerMenu);
// Appui sur le voile : la colonne laisse passer les appuis entre les
// boutons (pointer-events), ils arrivent donc sur le <dialog> lui-même
fermerSurVoile(menuCategories, fermerMenu);

// Bouton + : sur l'accueil, menu des catégories ; sur une page catégorie,
// saisie directe dans cette catégorie (pendant l'appui : le clavier s'ouvre)
document.getElementById("bouton-ajouter").addEventListener("click", () => {
  if (pageActive === "accueil") ouvrirMenu();
  else ouvrirAjout(pageActive);
});
// Flèche de retour : on referme le calque et on revient au menu
document.getElementById("ajout-retour").addEventListener("click", () => {
  fermerAjout();
  ouvrirMenu();
});
document.getElementById("ajout-fermer").addEventListener("click", fermerAjout);
fermerSurVoile(feuilleAjout, fermerAjout);
feuilleAjout.addEventListener("close", () => {
  masquerRecherche(); // aussi après Échap au clavier
  deverrouillerPage();
});
bloquerGlissement(feuilleAjout);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", ajusterAuClavier);
  window.visualViewport.addEventListener("scroll", ajusterAuClavier);
}
ajusterAuClavier(); // premières mesures (panneaux)

// Saisie manuelle (« Ajouter » ou « Ajouter « titre » tel quel ») :
// le titre tel qu'il est écrit, sans infos TMDB / IGDB
function ajouterTelQuel() {
  const type = categorieChoisie();
  const titre = champTitre.value.trim();
  if (titre === "") {
    champTitre.focus(); // rien d'écrit : on remet simplement le curseur
    return;
  }
  ajouter(titre, type);
  fermerAjout();
}

// Touche Entrée dans le titre : on envoie le formulaire nous-mêmes
// (le navigateur ne le fait pas toujours tout seul)
champTitre.addEventListener("keydown", (evenement) => {
  if (evenement.key !== "Enter" || evenement.isComposing) return;
  evenement.preventDefault();
  formulaire.requestSubmit();
});
// Touche Entrée du clavier :
// - Film, Série, Jeu : lance la recherche tout de suite et ferme le clavier
//   (pour voir tous les résultats) ;
// - jeu quand la recherche de jeux est indisponible : ajoute l'élément.
formulaire.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // empêche la page de se recharger
  if (sourcePourType(categorieChoisie()) && !rechercheJeuxIndisponible) {
    clearTimeout(minuteurRecherche);
    rechercher();
    champTitre.blur(); // fait descendre le clavier
  } else {
    ajouterTelQuel();
  }
});
ajoutDirect.addEventListener("click", ajouterTelQuel);
ajoutTelQuel.addEventListener("click", ajouterTelQuel);

// --- 6. Sauvegarde : exporter et importer --------------------
// Numéro de version du format du fichier. Si un jour on change la forme
// du fichier, on passera à 2 et on saura lire les anciens fichiers.
const FORMAT_NOM = "wodo";
// Les sauvegardes faites avant la v1.30 portent l'ancien nom : on les accepte
const FORMATS_ACCEPTES = [FORMAT_NOM, "mes-listes"];
// Version 1 : titre, type, fait. Version 2 : + année, affiche, identifiant TMDB
// (facultatifs). Version 3 : + identifiant RAWG pour les jeux (facultatif).
// Version 4 : + identifiant IMDb pour les films et séries (facultatif).
// Version 5 : + lien et note des recettes (facultatifs).
// Version 6 : + type « cocktail » ; recettes et cocktails ne sont jamais
// « terminés » (une ancienne recette cochée est remise en fiche à l'import).
// Version 7 : + contenu des fiches (facultatif) : photos (adresses),
// ingrédients, étapes, portions, temps de préparation et de cuisson,
// verre, méthode et alcool de base (cocktails).
// Version 8 : + fiches créées avec l'IA (facultatif) : ingrédients détaillés
// (quantité, unité, nom) et une photo gardée dans la fiche (image JPEG).
// Version 9 : + notes (Réglages → Notes) : texte, état, date de création.
// Un fichier sans notes laisse les notes actuelles intactes.
// Version 10 : plus d'historique « supprimes » (suppression définitive) ;
// celui des anciens fichiers est ignoré à l'import.
// Version 11 : les photos gardées sont rangées dans IndexedDB ; la fiche
// garde « photoId » et le fichier contient « photos » : { id: image JPEG
// en texte }. Les anciennes photos « photoPerso » (versions 8 à 10) sont
// rangées dans IndexedDB après l'import.
// Version 12 : jeux venus d'IGDB : identifiant « idIgdb » et jaquette dans « affiche »
// (adresse images.igdb.com) ; les anciens jeux RAWG gardent « idRawg ».
// Version 13 : + livres (type « livre ») venus d'Open Library : auteur,
// identifiant « idOpenLibrary » (OL…W) et couverture dans « affiche »
// (adresse covers.openlibrary.org).
// L'app sait lire les treize. Les clés (TMDB) n'y sont jamais.
// Depuis la v2.6, les recettes et cocktails (et leurs photos) n'y sont plus :
// ceux d'un ancien fichier sont laissés de côté (ils sont dans Toque&Tonic).
const FORMAT_VERSION = 13;

const boutonExporter = document.getElementById("bouton-exporter");
const boutonImporter = document.getElementById("bouton-importer");
const champFichier = document.getElementById("champ-fichier");
const messageSauvegarde = document.getElementById("message-sauvegarde");
const fenetreImport = document.getElementById("fenetre-import");
const texteImport = document.getElementById("texte-import");
const conseilSauvegarde = document.getElementById("conseil-sauvegarde");
const infoSauvegardeFaite = document.getElementById("info-sauvegarde-faite");
const boutonSauverAvant = document.getElementById("bouton-sauver-avant");
const boutonRemplacer = document.getElementById("bouton-remplacer");
const boutonAnnulerImport = document.getElementById("bouton-annuler-import");

// Les données du fichier choisi, en attente de confirmation
let importEnAttente = null;

// Affiche un message dans une zone (succes = vert, sinon rouge).
// Par défaut, la zone de la section Sauvegarde.
function afficherMessage(texte, succes, zone = messageSauvegarde) {
  zone.textContent = texte;
  zone.className = succes ? "message succes" : "message erreur";
  zone.hidden = false;
}

// "1 élément" / "3 éléments"
function pluriel(nombre, mot) {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}

// Résumé lisible d'une liste : "12 à faire, 5 terminés"
function resumer(lesElements) {
  const faits = lesElements.filter((e) => e.fait).length;
  return `${lesElements.length - faits} à faire, ${pluriel(faits, "terminé")}`;
}

// Proposer le fichier à l'utilisateur.
// - Sur iPhone / téléphone : le menu de partage ("Enregistrer dans Fichiers", AirDrop…)
// - Sur ordinateur : un téléchargement classique
async function exporter() {
  const donnees = {
    format: FORMAT_NOM,
    version: FORMAT_VERSION,
    dateExport: new Date().toISOString(),
    elements,
    notes: notesPourExport(), // version 9 : notes de Réglages → Notes
  };
  const texte = JSON.stringify(donnees, null, 2); // indenté : lisible à l'œil
  const date = new Date().toLocaleDateString("sv-SE"); // donne "2026-11-09"
  const nomFichier = `wodo-${date}.json`; // ex. : wodo-2026-11-12.json
  const fichier = new File([texte], nomFichier, { type: "application/json" });

  // Écran tactile + partage de fichiers possible → menu de partage
  const ecranTactile = window.matchMedia("(pointer: coarse)").matches;
  if (ecranTactile && navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: nomFichier });
      return true;
    } catch (erreur) {
      // L'utilisateur a fermé le menu sans rien choisir : ce n'est pas une erreur
      if (erreur.name === "AbortError") return false;
      // Autre problème : on essaie le téléchargement classique
    }
  }

  // Téléchargement classique : on crée un lien invisible et on "clique" dessus
  const adresse = URL.createObjectURL(fichier);
  const lien = document.createElement("a");
  lien.href = adresse;
  lien.download = nomFichier;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 1000); // libère la mémoire
  return true;
}

// Vérifie le contenu d'un fichier. Renvoie { elements, notes } si tout
// est correct, sinon lance une erreur avec un message clair.
// L'historique « supprimes » des anciens fichiers (versions 1 à 9) est ignoré.
// On recopie seulement les champs connus, pour ne rien garder d'inattendu.
function verifierFichier(donnees) {
  if (typeof donnees === "object" && donnees !== null && donnees.format === "toque-tonic") {
    throw new Error("Ce fichier est une sauvegarde de Toque&Tonic : importe-le dans Toque&Tonic.");
  }
  if (typeof donnees !== "object" || donnees === null || !FORMATS_ACCEPTES.includes(donnees.format)) {
    throw new Error("Ce fichier n'est pas une sauvegarde de Wodo.");
  }
  if (!Number.isInteger(donnees.version) || donnees.version < 1) {
    throw new Error("Le numéro de version du fichier est invalide.");
  }
  if (donnees.version > FORMAT_VERSION) {
    throw new Error("Ce fichier vient d'une version plus récente de l'app. Mets l'app à jour puis réessaie.");
  }
  if (!Array.isArray(donnees.elements)) {
    throw new Error("Le fichier est incomplet : il manque la liste des éléments.");
  }

  const typeValide = (t) => Object.hasOwn(EMOJIS, t);
  const titreValide = (t) => typeof t === "string" && t.trim() !== "";
  const idsVus = new Set();

  // Les recettes et cocktails d'un ancien fichier sont laissés de côté,
  // sans les vérifier (ils sont dans Toque&Tonic)
  const nouveauxElements = donnees.elements.filter((el) => !(el && estFiche(el.type))).map((el, i) => {
    const numero = `L'élément n°${i + 1}`;
    if (typeof el !== "object" || el === null) throw new Error(`${numero} est illisible.`);
    if (typeof el.id !== "string" || el.id === "") throw new Error(`${numero} n'a pas d'identifiant.`);
    if (idsVus.has(el.id)) throw new Error(`${numero} a le même identifiant qu'un autre élément.`);
    idsVus.add(el.id);
    if (!titreValide(el.titre)) throw new Error(`${numero} n'a pas de titre.`);
    if (!typeValide(el.type)) throw new Error(`${numero} a un type inconnu (« ${el.type} »).`);
    if (typeof el.fait !== "boolean") throw new Error(`${numero} n'indique pas s'il est terminé.`);
    const propre = { id: el.id, titre: el.titre.trim(), type: el.type, fait: el.fait };

    // Infos TMDB (version 2, facultatives) : vérifiées si elles sont là
    if (el.idTmdb !== undefined) {
      if (!Number.isInteger(el.idTmdb) || el.idTmdb <= 0) throw new Error(`${numero} a un identifiant TMDB invalide.`);
      if (el.type !== "film" && el.type !== "serie") throw new Error(`${numero} a un identifiant TMDB mais n'est ni un film ni une série.`);
      propre.idTmdb = el.idTmdb;
    }
    // Identifiant IMDb (version 4, facultatif) : "tt" suivi de chiffres,
    // seulement pour un film ou une série venu de TMDB
    if (el.idImdb !== undefined) {
      if (typeof el.idImdb !== "string" || !/^tt\d{1,12}$/.test(el.idImdb)) throw new Error(`${numero} a un identifiant IMDb invalide.`);
      if (el.idTmdb === undefined) throw new Error(`${numero} a un identifiant IMDb mais pas d'identifiant TMDB.`);
      propre.idImdb = el.idImdb;
    }
    // Infos RAWG (version 3, facultatives) : seulement pour les jeux, sans jaquette
    if (el.idRawg !== undefined) {
      if (!Number.isInteger(el.idRawg) || el.idRawg <= 0) throw new Error(`${numero} a un identifiant RAWG invalide.`);
      if (el.type !== "jeu") throw new Error(`${numero} a un identifiant RAWG mais n'est pas un jeu.`);
      propre.idRawg = el.idRawg;
    }
    // Infos IGDB (version 12, facultatives) : seulement pour les jeux
    if (el.idIgdb !== undefined) {
      if (!Number.isInteger(el.idIgdb) || el.idIgdb <= 0) throw new Error(`${numero} a un identifiant IGDB invalide.`);
      if (el.type !== "jeu") throw new Error(`${numero} a un identifiant IGDB mais n'est pas un jeu.`);
      propre.idIgdb = el.idIgdb;
    }
    // Infos Open Library (version 13, facultatives) : seulement pour les livres
    if (el.idOpenLibrary !== undefined) {
      if (typeof el.idOpenLibrary !== "string" || !MOTIF_ID_OPEN_LIBRARY.test(el.idOpenLibrary)) throw new Error(`${numero} a un identifiant Open Library invalide.`);
      if (el.type !== "livre") throw new Error(`${numero} a un identifiant Open Library mais n'est pas un livre.`);
      propre.idOpenLibrary = el.idOpenLibrary;
    }
    if (el.auteur !== undefined) {
      if (typeof el.auteur !== "string" || el.auteur.length > LONGUEUR_MAX_AUTEUR) throw new Error(`${numero} a un auteur invalide.`);
      if (el.type !== "livre") throw new Error(`${numero} a un auteur mais n'est pas un livre.`);
      if (el.auteur.trim() !== "") propre.auteur = el.auteur.trim();
    }
    // Année : livres anciens acceptés (Open Library connaît des œuvres de l'Antiquité)
    if (el.annee !== undefined) {
      const anneeMin = el.type === "livre" ? -3000 : 1800;
      if (!Number.isInteger(el.annee) || el.annee < anneeMin || el.annee > 2200) throw new Error(`${numero} a une année invalide.`);
      propre.annee = el.annee;
    }
    // Affiche : TMDB (films, séries), jaquette IGDB (jeux) ou couverture Open Library (livres)
    if (el.affiche !== undefined) {
      const afficheTmdb = typeof el.affiche === "string" && el.affiche.startsWith(ADRESSE_AFFICHES);
      const jaquetteIgdb = typeof el.affiche === "string" && el.type === "jeu" && MOTIF_JAQUETTE_IGDB.test(el.affiche);
      const couverture = typeof el.affiche === "string" && el.type === "livre" && MOTIF_COUVERTURE_OPEN_LIBRARY.test(el.affiche);
      if (!afficheTmdb && !jaquetteIgdb && !couverture) {
        throw new Error(`${numero} a une adresse d'affiche invalide.`);
      }
      propre.affiche = el.affiche;
    }
    return propre;
  });

  // Notes (version 9, facultatives) : null si le fichier n'en contient pas
  // (les notes actuelles seront alors gardées) ; vérifiées dans notes.js
  return { elements: nouveauxElements, notes: verifierNotesFichier(donnees.notes) };
}

// Le fichier a été choisi : on le lit, on le vérifie, puis on demande confirmation
async function lireFichierChoisi() {
  const fichier = champFichier.files[0];
  champFichier.value = ""; // permet de rechoisir le même fichier plus tard
  if (!fichier) return;
  messageSauvegarde.hidden = true;

  let donnees;
  try {
    donnees = JSON.parse(await fichier.text());
  } catch {
    afficherMessage(`« ${fichier.name} » n'est pas un fichier de sauvegarde lisible. Rien n'a été modifié.`, false);
    return;
  }

  try {
    importEnAttente = verifierFichier(donnees);
  } catch (erreur) {
    afficherMessage(`Fichier refusé : ${erreur.message} Rien n'a été modifié.`, false);
    return;
  }

  // Préparer la fenêtre de confirmation
  const nbActuels = elements.length;
  const nbImportes = importEnAttente.elements.length;
  // Notes (version 9) : remplacées seulement si le fichier en contient
  const notesDuFichier = importEnAttente.notes;
  const notesPerdues = notesDuFichier === null ? 0 : notes.length;
  const listeVide = nbActuels === 0 && notesPerdues === 0;
  const phraseNotes = notesDuFichier === null
    ? (notes.length
      ? ` Le fichier ne contient pas de notes : ${notes.length > 1 ? `tes ${notes.length} notes sont gardées` : "ta note est gardée"}.`
      : "")
    : (notes.length
      ? ` ${notes.length > 1 ? `Tes ${notes.length} notes seront remplacées` : "Ta note sera remplacée"} par les notes du fichier (${notesDuFichier.length}).`
      : ` Le fichier contient ${pluriel(notesDuFichier.length, "note")}.`);
  texteImport.textContent = (nbActuels === 0
    ? `Ta liste actuelle est vide. Elle sera remplacée par celle du fichier (${resumer(importEnAttente.elements)}).`
    : `Tu vas perdre ${pluriel(nbActuels, "élément")} de ta liste actuelle (${resumer(elements)}). ` +
      `Ils seront remplacés par les ${pluriel(nbImportes, "élément")} du fichier (${resumer(importEnAttente.elements)}).`) +
    phraseNotes;
  // Pas de sauvegarde à proposer si rien ne sera perdu
  conseilSauvegarde.hidden = listeVide;
  boutonSauverAvant.hidden = listeVide;
  infoSauvegardeFaite.hidden = true;
  fenetreImport.showModal();
}

// Remplace toute la liste par le fichier importé
async function remplacerListe() {
  if (!importEnAttente) return;
  const enAttente = importEnAttente;
  // La liste et les notes
  const anciensElements = elements;
  elements = enAttente.elements;
  try {
    sauvegarder();
    // Notes du fichier (s'il en contient) ; en cas d'échec, notes.js
    // remet les anciennes et on remet aussi la liste
    if (enAttente.notes !== null) remplacerNotes(enAttente.notes);
  } catch (erreur) {
    // Mémoire du téléphone pleine, etc. : on remet tout comme avant
    elements = anciensElements;
    sauvegarder();
    fenetreImport.close();
    afficherMessage("Impossible d'enregistrer la nouvelle liste (mémoire pleine ?). Rien n'a été modifié.", false);
    return;
  }
  fenetreImport.close();
  afficher();
  afficherMessage(`Import réussi : ${resumer(elements)}.`, true);
  completerImdbManquants(); // un ancien fichier n'a pas encore les liens IMDb
}

boutonExporter.addEventListener("click", async () => {
  messageSauvegarde.hidden = true;
  await exporter();
});
boutonImporter.addEventListener("click", () => champFichier.click());
champFichier.addEventListener("change", lireFichierChoisi);
boutonSauverAvant.addEventListener("click", async () => {
  if (await exporter()) infoSauvegardeFaite.hidden = false;
});
boutonRemplacer.addEventListener("click", remplacerListe);
boutonAnnulerImport.addEventListener("click", () => fenetreImport.close());
// Quand la fenêtre se ferme (Annuler, touche Échap…), on oublie le fichier
fenetreImport.addEventListener("close", () => {
  importEnAttente = null;
});

// --- 7. La clé TMDB, et les appels (TMDB, relais pour les jeux) ---
// Les clés sont rangées dans la mémoire de l'appareil (localStorage),
// jamais dans un fichier du projet ni dans les exports.
const CLE_TMDB = "wodo-cle-tmdb";
// Ancienne clé RAWG (jeux), remplacée par IGDB via le relais en v1.22 :
// effacée de l'appareil
try {
  localStorage.removeItem("mes-listes-cle-rawg");
} catch {
  // mémoire inaccessible : rien à faire
}

function lireCle(nomStockage) {
  try {
    return localStorage.getItem(nomStockage) || "";
  } catch {
    return "";
  }
}
const lireCleTmdb = () => lireCle(CLE_TMDB);

// Interroge TMDB. TMDB donne deux sortes de clés, on accepte les deux :
// - la "clé d'API" courte (32 caractères) → ajoutée à l'adresse
// - le "jeton d'accès en lecture" très long (commence par "eyJ") → envoyé à part
async function appelerTmdb(chemin, parametres = {}, cle = lireCleTmdb()) {
  const adresse = new URL("https://api.themoviedb.org/3" + chemin);
  for (const [nom, valeur] of Object.entries(parametres)) {
    adresse.searchParams.set(nom, valeur);
  }
  const options = {};
  if (cle.startsWith("eyJ")) {
    options.headers = { Authorization: `Bearer ${cle}` };
  } else {
    adresse.searchParams.set("api_key", cle);
  }
  const reponse = await fetch(adresse, options);
  if (!reponse.ok) {
    const erreur = new Error(`TMDB a répondu ${reponse.status}`);
    erreur.statut = reponse.status;
    throw erreur;
  }
  return reponse.json();
}

// Jeux vidéo : IGDB, interrogé par le relais (jamais depuis l'app : les
// codes IGDB restent secrets chez Cloudflare). Le relais abandonne au bout
// de 8 secondes ; l'app attend un peu plus, puis abandonne aussi. Toute
// réponse autre que 200 est un échec (la saisie manuelle prend le relais).
const DELAI_RELAIS_JEUX = 10000;
// Jaquettes IGDB acceptées (adresse exacte, format t_cover_big)
const MOTIF_JAQUETTE_IGDB = /^https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_cover_big\/[a-z0-9]+\.jpg$/i;
async function appelerRelaisJeux(chemin, parametres = {}) {
  const adresse = new URL(lireCle(CLE_RELAIS));
  adresse.pathname = adresse.pathname.replace(/\/+$/, "") + chemin;
  for (const [nom, valeur] of Object.entries(parametres)) {
    adresse.searchParams.set(nom, valeur);
  }
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI_RELAIS_JEUX);
  try {
    const reponse = await fetch(adresse, { signal: controle.signal, credentials: "omit", cache: "no-store" });
    if (reponse.status !== 200) {
      const erreur = new Error(`Le relais a répondu ${reponse.status}`);
      erreur.statut = reponse.status;
      throw erreur;
    }
    return await reponse.json();
  } finally {
    clearTimeout(minuteur);
  }
}

// Une clé refusée : TMDB répond 401
const cleRefusee = (erreur) => erreur.statut === 401 || erreur.statut === 403;

// Branche un formulaire de clé de la section « Réglages » (TMDB) :
// - nom : "TMDB" (pour les messages)
// - prefixe : fin des id HTML ("cle" → formulaire-cle, champ-cle…)
// - verifier(cle) : petit appel qui échoue si la clé est refusée
function brancherCle(nom, nomStockage, prefixe, verifier) {
  const formulaire = document.getElementById(`formulaire-${prefixe}`);
  const champ = document.getElementById(`champ-${prefixe}`);
  const etat = document.getElementById(`etat-${prefixe}`);
  const message = document.getElementById(`message-${prefixe}`);
  const boutonEffacer = document.getElementById(`bouton-effacer-${prefixe}`);

  function afficherEtat() {
    const presente = lireCle(nomStockage) !== "";
    etat.textContent = presente
      ? `✅ Une clé ${nom} est enregistrée sur cet appareil.`
      : `Aucune clé ${nom} enregistrée sur cet appareil : la recherche est désactivée.`;
    boutonEffacer.hidden = !presente;
  }

  function enregistrer(cle) {
    localStorage.setItem(nomStockage, cle);
    champ.value = "";
    afficherEtat();
  }

  // Enregistrer : on teste d'abord la clé auprès du service
  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const cle = champ.value.trim();
    if (cle === "") {
      afficherMessage("Colle d'abord ta clé dans le champ.", false, message);
      return;
    }
    try {
      await verifier(cle);
    } catch (erreur) {
      if (cleRefusee(erreur)) {
        afficherMessage(`${nom} refuse cette clé. Vérifie que tu l'as copiée en entier. Rien n'a été enregistré.`, false, message);
        return;
      }
      // Pas de connexion : on enregistre quand même, on testera plus tard
      enregistrer(cle);
      afficherMessage("Clé enregistrée, mais impossible de la vérifier (pas de connexion ?).", false, message);
      return;
    }
    enregistrer(cle);
    afficherMessage("Clé vérifiée et enregistrée. La recherche est activée.", true, message);
  });

  boutonEffacer.addEventListener("click", () => {
    localStorage.removeItem(nomStockage);
    afficherEtat();
    afficherMessage("Clé effacée de cet appareil.", true, message);
  });

  afficherEtat();
}

brancherCle("TMDB", CLE_TMDB, "cle", (cle) => appelerTmdb("/authentication", {}, cle));

// --- 7 ter. L'adresse du relais (recherche de jeux) ----------
// Gardée uniquement sur l'appareil (localStorage), comme les clés.
// Ce n'est pas un secret : on la réaffiche dans le champ pour la vérifier.
{
  const formulaireRelais = document.getElementById("formulaire-relais");
  const champRelais = document.getElementById("champ-relais");
  const etatRelais = document.getElementById("etat-relais");
  const messageRelais = document.getElementById("message-relais");
  const boutonEffacerRelais = document.getElementById("bouton-effacer-relais");

  const afficherEtatRelais = () => {
    const adresse = lireCle(CLE_RELAIS);
    etatRelais.textContent = adresse
      ? "✅ Un relais est enregistré sur cet appareil : la recherche de jeux est activée."
      : "Aucun relais enregistré sur cet appareil : la recherche de jeux est désactivée (l'ajout à la main reste possible).";
    champRelais.value = adresse;
    boutonEffacerRelais.hidden = !adresse;
  };

  formulaireRelais.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    let adresse = null;
    try {
      adresse = new URL(champRelais.value.trim());
    } catch {
      // pas une adresse
    }
    if (!adresse || adresse.protocol !== "https:") {
      afficherMessage("L'adresse doit commencer par https:// (exemple : https://mes-listes-relais.ton-pseudo.workers.dev).", false, messageRelais);
      return;
    }
    // On ne garde que le site et le chemin (pas de « ?… » ni de « #… »)
    localStorage.setItem(CLE_RELAIS, adresse.origin + adresse.pathname);
    afficherEtatRelais();
    afficherMessage("Adresse enregistrée. La recherche de jeux est activée.", true, messageRelais);
  });

  boutonEffacerRelais.addEventListener("click", () => {
    localStorage.removeItem(CLE_RELAIS);
    afficherEtatRelais();
    afficherMessage("Adresse effacée de cet appareil.", true, messageRelais);
  });

  afficherEtatRelais();
}

// --- 7 ter bis. Le prénom de l'accueil ---------------------------
// Gardé uniquement sur l'appareil (localStorage), pas dans les exports.
{
  const formulairePrenom = document.getElementById("formulaire-prenom");
  const champPrenom = document.getElementById("champ-prenom");
  const messagePrenom = document.getElementById("message-prenom");
  const boutonEffacerPrenom = document.getElementById("bouton-effacer-prenom");

  const afficherPrenom = () => {
    champPrenom.value = lirePrenom();
    // « Remettre Womack » n'a de sens que si le prénom a été changé
    boutonEffacerPrenom.hidden = lirePrenom() === PRENOM_PAR_DEFAUT;
    if (pageActive === "accueil") enteteSalut();
  };

  formulairePrenom.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    const prenom = champPrenom.value.trim();
    if (!prenom) {
      afficherMessage("Écris un prénom avant d'enregistrer.", false, messagePrenom);
      return;
    }
    localStorage.setItem(CLE_PRENOM, prenom);
    afficherPrenom();
    afficherMessage(`Prénom enregistré : « Bonjour ${prenom} ».`, true, messagePrenom);
  });

  boutonEffacerPrenom.addEventListener("click", () => {
    localStorage.removeItem(CLE_PRENOM);
    afficherPrenom();
    afficherMessage(`Prénom remis à « ${PRENOM_PAR_DEFAUT} ».`, true, messagePrenom);
  });

  afficherPrenom();
}

// --- 7 bis. Les liens IMDb des films et séries ----------------
// La recherche TMDB ne donne pas l'identifiant IMDb (ex : "tt1375666").
// On le demande à TMDB à part, une fois, puis on le garde avec l'élément.

// Éléments pour lesquels TMDB a déjà répondu pendant cette ouverture de l'app
// (même sans identifiant IMDb) : on ne redemande pas à chaque fois.
const imdbDejaDemandes = new Set();
let completionEnCours = false;

async function completerImdb(el) {
  const { id, idTmdb, type } = el;
  if (lireCleTmdb() === "" || !navigator.onLine) return;
  const chemin = `/${type === "film" ? "movie" : "tv"}/${idTmdb}/external_ids`;
  let donnees;
  try {
    donnees = await appelerTmdb(chemin);
  } catch {
    return; // pas de connexion ou clé refusée : on réessaiera plus tard
  }
  imdbDejaDemandes.add(id);
  const idImdb = donnees.imdb_id;
  if (typeof idImdb !== "string" || !/^tt\d{1,12}$/.test(idImdb)) return; // pas sur IMDb

  // Pendant l'attente, l'élément a pu être supprimé, changé de type ou
  // remplacé par un import : on vérifie qu'il est toujours là, identique
  const actuel = elements.find((e) => e.id === id && e.idTmdb === idTmdb);
  if (!actuel) return;
  actuel.idImdb = idImdb;
  sauvegarder();
  // (la modification se fait dans le panneau d'actions : réafficher la liste
  // n'efface rien de ce qui est en train d'être tapé)
  afficher();
}

// Complète, un par un, les films et séries TMDB qui n'ont pas encore de lien IMDb
// (ceux ajoutés avant la v12, ou ajoutés hors ligne)
async function completerImdbManquants() {
  if (completionEnCours) return;
  completionEnCours = true;
  try {
    const manquants = elements.filter((e) => e.idTmdb && !e.idImdb && !imdbDejaDemandes.has(e.id));
    for (const el of manquants) await completerImdb(el);
  } finally {
    completionEnCours = false;
  }
}

// --- 8. La recherche : films et séries (TMDB), jeux (IGDB) ----
const etatRecherche = document.getElementById("etat-recherche");
const resultatsRecherche = document.getElementById("resultats-recherche");

let minuteurRecherche = null;
// Numéro de la dernière recherche lancée : si une ancienne réponse arrive
// après une plus récente, on l'ignore
let numeroRecherche = 0;

function masquerRecherche() {
  clearTimeout(minuteurRecherche);
  numeroRecherche++; // les réponses encore en route seront ignorées
  resultatsRecherche.hidden = true;
  resultatsRecherche.innerHTML = "";
  etatRecherche.hidden = true;
  majTelQuel();
}

function afficherEtatRecherche(texte) {
  resultatsRecherche.hidden = true;
  resultatsRecherche.innerHTML = "";
  etatRecherche.textContent = texte;
  etatRecherche.hidden = false;
  majTelQuel();
}

// Transforme un résultat TMDB en { titre, type, annee, affiche, idTmdb }
// (on ne garde que ça : pas de synopsis, de note, de saisons…)
function convertirResultatTmdb(r) {
  const date = r.release_date || r.first_air_date || "";
  const annee = parseInt(date.slice(0, 4), 10);
  return {
    titre: r.title || r.name,
    type: r.media_type === "movie" ? "film" : "serie",
    annee: Number.isInteger(annee) ? annee : null,
    affiche: r.poster_path ? ADRESSE_AFFICHES + r.poster_path : null,
    idTmdb: r.id,
  };
}

// Transforme un résultat IGDB (renvoyé par le relais) en
// { titre, type, annee, affiche, idIgdb } — même forme que pour TMDB.
// Les plateformes ne servent qu'à l'affichage dans la liste de résultats.
function convertirResultatIgdb(r) {
  const affiche = typeof r.jaquette === "string" && MOTIF_JAQUETTE_IGDB.test(r.jaquette) ? r.jaquette : null;
  return {
    titre: typeof r.nom === "string" ? r.nom.trim().slice(0, 200) : "",
    type: "jeu",
    annee: Number.isInteger(r.annee) && r.annee >= 1800 && r.annee <= 2200 ? r.annee : null,
    affiche,
    idIgdb: Number.isInteger(r.id) && r.id > 0 ? r.id : null,
    plateformes: Array.isArray(r.plateformes)
      ? r.plateformes.filter((p) => typeof p === "string").slice(0, 3).map((p) => p.slice(0, 40))
      : [],
  };
}

// Livres : Open Library (gratuit, sans clé, appelé directement depuis l'app).
// On ne garde que : titre, premier auteur, année de 1re parution, couverture
// et identifiant de l'œuvre (« OL45804W »).
const DELAI_OPEN_LIBRARY = 10000; // Open Library est parfois lent : 10 s au plus
const MOTIF_ID_OPEN_LIBRARY = /^OL\d{1,12}W$/;
const MOTIF_COUVERTURE_OPEN_LIBRARY = /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d{1,12}-M\.jpg$/;
const LONGUEUR_MAX_AUTEUR = 200;

async function appelerOpenLibrary(texte) {
  const adresse = new URL("https://openlibrary.org/search.json");
  adresse.searchParams.set("q", texte);
  adresse.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i");
  adresse.searchParams.set("limit", "20");
  adresse.searchParams.set("lang", "fr"); // éditions françaises en priorité quand elles existent
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI_OPEN_LIBRARY);
  try {
    const reponse = await fetch(adresse, { signal: controle.signal, credentials: "omit" });
    if (!reponse.ok) throw new Error(`Open Library a répondu ${reponse.status}`);
    const donnees = await reponse.json();
    if (!donnees || !Array.isArray(donnees.docs)) throw new Error("réponse illisible");
    return donnees.docs;
  } finally {
    clearTimeout(minuteur);
  }
}

// Transforme un résultat Open Library en { titre, type, annee, affiche,
// auteur, idOpenLibrary } — même forme que pour TMDB et IGDB
function convertirResultatOpenLibrary(r) {
  const id = typeof r.key === "string" ? r.key.replace(/^\/works\//, "") : "";
  const auteur = Array.isArray(r.author_name) && typeof r.author_name[0] === "string" ? r.author_name[0].trim() : "";
  return {
    titre: typeof r.title === "string" ? r.title.trim().slice(0, 200) : "",
    type: "livre",
    annee: Number.isInteger(r.first_publish_year) && r.first_publish_year >= -3000 && r.first_publish_year <= 2200 ? r.first_publish_year : null,
    affiche: Number.isInteger(r.cover_i) && r.cover_i > 0 ? `https://covers.openlibrary.org/b/id/${r.cover_i}-M.jpg` : null,
    auteur: auteur.slice(0, LONGUEUR_MAX_AUTEUR),
    idOpenLibrary: MOTIF_ID_OPEN_LIBRARY.test(id) ? id : null,
  };
}

// Ce qui change d'un service à l'autre pour la recherche
const SOURCES = {
  tmdb: {
    nom: "TMDB",
    lireCle: lireCleTmdb,
    // search/multi renvoie films, séries et personnes ensemble : les 20
    // plus pertinents, qu'on range du plus récent au plus ancien
    // (sans date à la fin), avant de garder les 10 premiers
    chercher: async (texte) => {
      const donnees = await appelerTmdb("/search/multi", {
        query: texte,
        language: "fr-FR",
        include_adult: "false",
      });
      const dateSortie = (r) => r.release_date || r.first_air_date || ""; // « AAAA-MM-JJ »
      return donnees.results
        .filter((r) => r.media_type === "movie" || r.media_type === "tv") // sans les personnes
        .sort((a, b) => dateSortie(b).localeCompare(dateSortie(a)))
        .slice(0, RESULTATS_AFFICHES)
        .map(convertirResultatTmdb);
    },
  },
  igdb: {
    nom: "IGDB",
    // Pas de clé dans l'app : il faut seulement l'adresse du relais
    lireCle: () => lireCle(CLE_RELAIS),
    // Titres d'IGDB, souvent en anglais (IGDB ne propose pas le français)
    // Le relais renvoie les jeux qui ont un mot commençant par le texte
    // tapé, déjà rangés du plus récent au plus ancien. On range quand même
    // par année ici (sans année à la fin) au cas où le relais n'a pas
    // encore été mis à jour sur Cloudflare.
    chercher: async (texte) => {
      const donnees = await appelerRelaisJeux("/igdb/recherche", { q: texte });
      if (!Array.isArray(donnees)) throw new Error("réponse illisible");
      return donnees.map(convertirResultatIgdb).filter((r) => r.titre && r.idIgdb)
        .sort((a, b) => (b.annee || 0) - (a.annee || 0))
        .slice(0, RESULTATS_AFFICHES);
    },
  },
  openLibrary: {
    nom: "Open Library",
    sansCle: true, // rien à régler : la recherche marche tout de suite
    // Gardés dans l'ordre de pertinence d'Open Library (pas par date : un
    // même livre existe souvent en plusieurs éditions et traductions, et
    // l'œuvre connue doit rester en tête). Un seul résultat par titre et
    // auteur (les éditions en double sont retirées).
    chercher: async (texte) => {
      const vus = new Set();
      return (await appelerOpenLibrary(texte))
        .map(convertirResultatOpenLibrary)
        .filter((r) => {
          if (!r.titre || !r.idOpenLibrary) return false;
          const cle = `${r.titre.toLowerCase()}|${r.auteur.toLowerCase()}`;
          if (vus.has(cle)) return false;
          vus.add(cle);
          return true;
        })
        .slice(0, RESULTATS_AFFICHES);
    },
  },
};
// Nombre de propositions affichées sous le champ titre
const RESULTATS_AFFICHES = 10;

// Quel service interroger selon le type choisi (aucun pour « autre »)
function sourcePourType(type) {
  if (type === "film" || type === "serie") return SOURCES.tmdb;
  if (type === "jeu") return SOURCES.igdb;
  if (type === "livre") return SOURCES.openLibrary;
  return null;
}


// Fabrique la vignette d'un élément : l'affiche, ou un carré bleu marine
// avec l'icône orange du type s'il n'y a pas d'affiche ou si elle ne se
// charge pas (hors ligne)
function creerVignette(affiche, type) {
  const vide = document.createElement("span");
  vide.className = "vignette vignette-vide";
  vide.append(creerIcone(ICONES_TYPES[type]));
  if (!affiche) return vide;

  const image = document.createElement("img");
  image.className = "vignette";
  image.alt = "";
  image.loading = "lazy";
  // Le site de la photo ne sait pas qu'elle est affichée dans l'app
  // (certains sites refusent aussi leurs photos quand on l'indique)
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => image.replaceWith(vide));
  image.src = affiche;
  return image;
}

// Recherche de jeux impossible (relais absent, IGDB en panne, trop lent,
// hors ligne) : message simple, sans détail technique, et le calque passe
// en saisie manuelle (bouton orange « Ajouter », la touche Entrée ajoute).
// Le jeu sera créé avec le titre tapé, sans infos IGDB.
// On ne réessaie plus avant la prochaine ouverture du calque.
const MESSAGE_JEUX_INDISPONIBLE = "Recherche de jeux indisponible pour le moment. Vous pouvez ajouter le jeu manuellement.";
function passerJeuxEnManuel(relaisAbsent) {
  rechercheJeuxIndisponible = true;
  clearTimeout(minuteurRecherche);
  numeroRecherche++; // une réponse encore en route sera ignorée
  afficherEtatRecherche(MESSAGE_JEUX_INDISPONIBLE);
  if (relaisAbsent) {
    const indication = document.createElement("span");
    indication.className = "indication";
    indication.textContent = "Adresse du relais à renseigner dans Réglages → Relais (jeux).";
    etatRecherche.append(indication);
  }
  ajoutDirect.hidden = false;
  champTitre.enterKeyHint = "done"; // la touche du clavier devient « OK »
}

async function rechercher() {
  const texte = champTitre.value.trim();
  const type = categorieChoisie();

  // Jeux en saisie manuelle : on garde le message, plus d'appel au relais
  if (type === "jeu" && rechercheJeuxIndisponible) return;

  // La recherche concerne les films, séries, jeux et livres, à partir de 2 lettres
  const source = sourcePourType(type);
  if (!source || texte.length < 2) {
    masquerRecherche();
    return;
  }
  // Jeux : relais absent ou hors ligne → saisie manuelle
  if (source === SOURCES.igdb && source.lireCle() === "") {
    passerJeuxEnManuel(true);
    return;
  }
  if (source === SOURCES.igdb && !navigator.onLine) {
    passerJeuxEnManuel(false);
    return;
  }
  if (!source.sansCle && source.lireCle() === "") {
    afficherEtatRecherche(`Recherche ${source.nom} désactivée : ajoute ta clé dans Réglages → Clés API. Tu peux aussi ajouter le titre à la main.`);
    return;
  }
  if (!navigator.onLine) {
    afficherEtatRecherche("Hors ligne : recherche impossible. Tu peux ajouter le titre à la main.");
    return;
  }

  const numero = ++numeroRecherche;
  etatRecherche.textContent = "Recherche…";
  etatRecherche.hidden = false;

  let resultats;
  try {
    resultats = await source.chercher(texte);
  } catch (erreur) {
    if (numero !== numeroRecherche) return;
    // Jeux : relais ou IGDB en panne, délai dépassé, réponse illisible…
    if (source === SOURCES.igdb) {
      passerJeuxEnManuel(false);
      return;
    }
    afficherEtatRecherche(
      !source.sansCle && cleRefusee(erreur)
        ? `${source.nom} refuse ta clé. Vérifie-la dans Réglages → Clés API. Tu peux ajouter le titre à la main.`
        : "Recherche impossible (connexion ?). Tu peux ajouter le titre à la main."
    );
    return;
  }
  if (numero !== numeroRecherche) return; // une recherche plus récente a été lancée

  if (resultats.length === 0) {
    afficherEtatRecherche(`Aucun résultat sur ${source.nom}. Tu peux l'ajouter tel quel.`);
    return;
  }

  etatRecherche.hidden = true;
  resultatsRecherche.innerHTML = "";
  for (const res of resultats) {
    // Chaque ligne : affiche 52 × 76, titre, type et année, « Ajouter » orange.
    // Toute la ligne est appuyable (plus facile au doigt) ; le mot « Ajouter »
    // a l'air d'un bouton pour qu'on comprenne ce qui va se passer.
    const li = document.createElement("li");
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "resultat";
    bouton.setAttribute("aria-label", `Ajouter ${res.titre}${res.annee ? ` (${res.annee})` : ""}`);

    const titre = document.createElement("span");
    titre.className = "titre";
    titre.textContent = res.titre;

    const details = document.createElement("span");
    details.className = "details";
    // « Jeu · 2015 · PC, PlayStation 4 » (plateformes : jeux seulement) ;
    // « Livre · 2004 · Alain Damasio » (auteur : livres seulement)
    details.textContent = [NOMS_SIMPLES[res.type], res.annee, res.auteur, (res.plateformes || []).join(", ")]
      .filter(Boolean).join(" · ");

    const textes = document.createElement("span");
    textes.className = "textes";
    textes.append(titre, details);

    const pastille = document.createElement("span");
    pastille.className = "pastille-ajouter";
    pastille.textContent = "Ajouter";

    bouton.append(creerVignette(res.affiche, res.type), textes, pastille);
    bouton.addEventListener("click", () => {
      ajouter(res.titre, res.type, res);
      fermerAjout();
    });
    li.append(bouton);
    resultatsRecherche.append(li);
  }
  resultatsRecherche.hidden = false;
  majTelQuel();
}

// On attend une petite pause dans la frappe avant de chercher
// (sinon une recherche partirait à chaque lettre)
function programmerRecherche() {
  clearTimeout(minuteurRecherche);
  minuteurRecherche = setTimeout(rechercher, 400);
}
champTitre.addEventListener("input", () => {
  majTelQuel(); // la ligne « Ajouter … tel quel » suit ce qui est tapé
  programmerRecherche();
});

// --- 9. Démarrage --------------------------------------------
// La section « Terminés » est fermée à chaque ouverture
// de l'app (c'est le comportement par défaut de <details>).
localStorage.removeItem("mes-listes-section-ouverte"); // ancien réglage, devenu inutile
document.getElementById("version").textContent = VERSION;
allerA("accueil");
// On demande au navigateur de ne pas effacer la mémoire de l'app
// (liste, notes) quand le téléphone manque de place
try {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
} catch {
  // pas grave
}
completerImdbManquants();
// Revenu en ligne (métro, avion…) : on complète ce qui manque encore
window.addEventListener("online", completerImdbManquants);

// Enregistre le service worker (permet le fonctionnement hors ligne)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .catch((erreur) => console.error("Service worker non enregistré :", erreur));
}
