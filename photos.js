// ============================================================
// photos.js : la mémoire des photos des fiches (IndexedDB)
//
// Pourquoi ? La mémoire simple de l'app (localStorage) est limitée à
// environ 5 Mo pour tout. IndexedDB, l'autre mémoire du navigateur, est
// faite pour les gros volumes (des centaines de Mo sur iPhone). Les
// photos y sont rangées comme de vraies images (Blob), plus légères que
// du texte base64. Les listes, les notes et les réglages restent dans
// localStorage.
//
// Une fiche ne garde que l'identifiant de sa photo : { photoId: "p-…" }.
// Pour l'afficher, on écrit « idb:p-… » comme adresse ; poserSource()
// sait la lire.
// Chargé avant app.js (voir index.html).
// ============================================================

const BASE_PHOTOS = "wodo-photos";
// Nom de la base avant la v1.30 : ses photos sont recopiées dans la
// nouvelle base au premier lancement, puis elle est effacée
const ANCIENNE_BASE_PHOTOS = "mes-listes-photos";
const MAGASIN_PHOTOS = "photos";
const PREFIXE_PHOTO_LOCALE = "idb:";

// Ouvre une base. creer = false : ne la crée pas si elle n'existe pas
// (renvoie alors null)
function ouvrirBase(nom, creer) {
  return new Promise((ok, echec) => {
    let absente = false;
    const demande = indexedDB.open(nom, 1);
    demande.onupgradeneeded = () => {
      if (creer) {
        demande.result.createObjectStore(MAGASIN_PHOTOS);
      } else {
        absente = true;
        demande.transaction.abort(); // la base n'existait pas : on ne la crée pas
      }
    };
    demande.onsuccess = () => ok(demande.result);
    demande.onerror = () => (absente ? ok(null) : echec(demande.error || new Error("ouverture impossible")));
    demande.onblocked = () => echec(new Error("base bloquée"));
  });
}

// Recopie une à une les photos de l'ancienne base dans la nouvelle, puis
// efface l'ancienne. En cas d'erreur, l'ancienne base est gardée intacte.
async function migrerAnciennesPhotos(base) {
  const ancienne = await ouvrirBase(ANCIENNE_BASE_PHOTOS, false);
  if (!ancienne) return; // rien à recopier
  try {
    const ids = (await operationSur(ancienne, "readonly", (magasin) => magasin.getAllKeys())) || [];
    for (const id of ids) {
      const photo = await operationSur(ancienne, "readonly", (magasin) => magasin.get(id));
      if (photo) await operationSur(base, "readwrite", (magasin) => magasin.put(photo, id));
    }
  } finally {
    ancienne.close();
  }
  indexedDB.deleteDatabase(ANCIENNE_BASE_PHOTOS);
}

// Ouverture de la base (une seule fois), après le déplacement des photos.
// Si le déplacement échoue, on continue avec l'ancienne base pour cette
// fois : il sera retenté au prochain lancement.
let promesseBasePhotos = null;
function ouvrirBasePhotos() {
  if (!promesseBasePhotos) {
    promesseBasePhotos = (async () => {
      if (!window.indexedDB) throw new Error("IndexedDB indisponible");
      const base = await ouvrirBase(BASE_PHOTOS, true);
      try {
        await migrerAnciennesPhotos(base);
        return base;
      } catch (erreur) {
        console.error("Déplacement des photos impossible :", erreur);
        const ancienne = await ouvrirBase(ANCIENNE_BASE_PHOTOS, false);
        if (!ancienne) return base;
        base.close();
        return ancienne;
      }
    })().catch((erreur) => {
      promesseBasePhotos = null; // on pourra réessayer plus tard
      throw erreur;
    });
  }
  return promesseBasePhotos;
}

// Une opération sur les photos ; renvoie son résultat une fois bien écrite
async function operationPhotos(mode, action) {
  return operationSur(await ouvrirBasePhotos(), mode, action);
}

// Une opération sur une base donnée
function operationSur(base, mode, action) {
  return new Promise((ok, echec) => {
    const transaction = base.transaction(MAGASIN_PHOTOS, mode);
    const demande = action(transaction.objectStore(MAGASIN_PHOTOS));
    let resultat;
    if (demande) demande.onsuccess = () => { resultat = demande.result; };
    transaction.oncomplete = () => ok(resultat);
    transaction.onerror = () => echec(transaction.error || new Error("erreur"));
    transaction.onabort = () => echec(transaction.error || new Error("annulée")); // ex. : mémoire pleine
  });
}

const nouvelIdPhoto = () => "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const idPhotoValide = (id) => typeof id === "string" && /^p-[a-z0-9]{6,40}$/.test(id);

// Enregistre une image (Blob) ; renvoie son identifiant
async function enregistrerPhoto(fichier, id = nouvelIdPhoto()) {
  await operationPhotos("readwrite", (magasin) => magasin.put(fichier, id));
  return id;
}

async function lirePhoto(id) {
  return (await operationPhotos("readonly", (magasin) => magasin.get(id))) || null;
}

async function supprimerPhoto(id) {
  oublierAdressePhoto(id);
  await operationPhotos("readwrite", (magasin) => magasin.delete(id));
}

async function idsDesPhotos() {
  return (await operationPhotos("readonly", (magasin) => magasin.getAllKeys())) || [];
}

// --- Afficher ---
// Une adresse temporaire (blob:…) par photo, gardée tant que l'app est ouverte
const adressesPhotos = new Map();      // id → adresse (déjà prête)
const adressesEnCours = new Map();     // id → promesse d'adresse

function adressePhoto(id) {
  if (adressesPhotos.has(id)) return Promise.resolve(adressesPhotos.get(id));
  if (!adressesEnCours.has(id)) {
    adressesEnCours.set(id, lirePhoto(id).then((fichier) => {
      adressesEnCours.delete(id);
      if (!fichier) return null;
      const adresse = URL.createObjectURL(fichier);
      adressesPhotos.set(id, adresse);
      return adresse;
    }).catch(() => {
      adressesEnCours.delete(id);
      return null;
    }));
  }
  return adressesEnCours.get(id);
}

function oublierAdressePhoto(id) {
  const adresse = adressesPhotos.get(id);
  if (adresse) URL.revokeObjectURL(adresse);
  adressesPhotos.delete(id);
}

// Adresse « idb:p-… » à afficher pour la photo d'une fiche (ou null)
const adressePhotoFiche = (el) => (el.photoId ? PREFIXE_PHOTO_LOCALE + el.photoId : el.photoPerso || null);

// Met une image dans une balise <img> : adresse web ou data:, posée tout
// de suite ; photo « idb:… », posée dès qu'elle est lue dans la mémoire.
// siAbsente() est appelée si la photo n'existe plus.
function poserSource(image, adresse, siAbsente = () => {}) {
  if (typeof adresse !== "string" || !adresse.startsWith(PREFIXE_PHOTO_LOCALE)) {
    image.src = adresse;
    return;
  }
  const id = adresse.slice(PREFIXE_PHOTO_LOCALE.length);
  const prete = adressesPhotos.get(id);
  if (prete) {
    image.src = prete;
    return;
  }
  adressePhoto(id).then((trouvee) => {
    if (trouvee) image.src = trouvee;
    else siAbsente();
  });
}

// --- Conversions (sauvegarde, anciennes photos) ---
function photoEnTexte(fichier) {
  return new Promise((ok, echec) => {
    const lecteur = new FileReader();
    lecteur.onload = () => ok(String(lecteur.result));
    lecteur.onerror = () => echec(lecteur.error || new Error("lecture impossible"));
    lecteur.readAsDataURL(fichier);
  });
}

// « data:image/jpeg;base64,… » → Blob (null si le texte n'est pas une image JPEG)
function texteEnPhoto(texte) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/.exec(texte || "");
  if (!m) return null;
  const octets = atob(m[1]);
  const tableau = new Uint8Array(octets.length);
  for (let i = 0; i < octets.length; i++) tableau[i] = octets.charCodeAt(i);
  return new Blob([tableau], { type: "image/jpeg" });
}

// Demande au navigateur de garder ces données même s'il manque de place
// (aucune fenêtre ne s'affiche sur iPhone ni dans Chrome)
function demanderConservation() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch {
    // pas grave
  }
}
