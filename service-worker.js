// ============================================================
// service-worker.js : garde une copie des fichiers de l'app
// pour qu'elle s'ouvre même sans connexion internet.
// ============================================================

// Change ce numéro à chaque modification des fichiers, sinon le
// téléphone continuera d'utiliser l'ancienne copie :
// chaque changement ajoute 1 au second numéro : v2.0 → v2.1 → v2.2…
// ⚠️ Change aussi VERSION en haut de app.js (affichée à côté du logo).
const NOM_CACHE = "wodo-v2.9";

// ⚠️ Si un seul de ces fichiers est introuvable, rien n'est mis en cache
// (l'app ne marchera pas hors ligne) : vérifier chaque chemin.
const FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "migration.js",
  "recettes.js",
  "ia.js",
  "photos.js",
  "app.js",
  "notes.js",
  "manifest.json?v=2",
  // Logo et icônes (dossier icons)
  "icons/logo-w.svg",
  "icons/logo-w-clair.svg",
  "icons/icon.svg",
  "icons/apple-touch-icon.png?v=2", // ?v=2 : force le téléchargement de la nouvelle icône
  "icons/icon-192.png?v=2",
  "icons/icon-512.png?v=2",
  "icons/favicon-32.png?v=2",
  "icons/tmdb.svg",
];

// À l'installation : on met tous les fichiers en cache.
// cache: "reload" : chaque fichier est redemandé au site, jamais pris dans
// la mémoire du navigateur (GitHub Pages la garde 10 min) ; sinon deux
// versions publiées à moins de 10 min d'écart mettaient les anciens
// fichiers dans le nouveau cache (v2.8 restée en v2.7 sur l'iPhone).
self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    caches.open(NOM_CACHE).then((cache) =>
      cache.addAll(FICHIERS.map((fichier) => new Request(fichier, { cache: "reload" })))
    )
  );
  self.skipWaiting();
});

// À l'activation : on supprime les anciens caches de Wodo (v1 quand v2
// arrive, etc.). Seulement ceux de Wodo (« wodo-… », ou « mes-listes-… »
// avant la v1.30) : les autres apps du même site (womack82.github.io)
// gardent les leurs.
const estCacheDeWodo = (nom) => nom.startsWith("wodo-") || nom.startsWith("mes-listes-");
self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => estCacheDeWodo(n) && n !== NOM_CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// À chaque demande de fichier : on sert la copie en cache si elle existe,
// sinon on va la chercher sur internet.
self.addEventListener("fetch", (evenement) => {
  // Les demandes vers d'autres sites (TMDB, RAWG, relais des recettes, photos) ne passent
  // pas par le cache : le navigateur s'en occupe normalement.
  if (new URL(evenement.request.url).origin !== self.location.origin) return;
  evenement.respondWith(
    caches.match(evenement.request).then((reponse) => reponse || fetch(evenement.request))
  );
});
