// ============================================================
// migration.js : passage des noms « mes-listes… » aux noms « wodo… »
//
// Depuis la v1.30, les données de l'appareil (localStorage) sont rangées
// sous des noms qui commencent par « wodo ». Au démarrage, ce fichier
// recopie les anciennes données sous leur nouveau nom, puis efface
// l'ancienne copie. Il ne fait rien si c'est déjà fait.
// Les photos (IndexedDB) sont déplacées par photos.js.
// Chargé en tout premier (voir index.html), avant les autres fichiers.
// ============================================================

{
  const RENOMMAGES = [
    ["mes-listes", "wodo"],                             // la liste
    ["mes-listes-notes", "wodo-notes"],                 // les notes
    ["mes-listes-prenom", "wodo-prenom"],               // le prénom de l'accueil
    ["mes-listes-relais", "wodo-relais"],               // l'adresse du relais
    ["mes-listes-cle-tmdb", "wodo-cle-tmdb"],           // la clé TMDB
    ["mes-listes-cle-gemini", "wodo-cle-gemini"],       // la clé Gemini
    ["mes-listes-modele-gemini", "wodo-modele-gemini"], // le modèle Gemini
  ];
  try {
    for (const [ancien, nouveau] of RENOMMAGES) {
      const valeur = localStorage.getItem(ancien);
      // Rien à déplacer, ou déjà déplacé : on garde tout tel quel
      if (valeur === null || localStorage.getItem(nouveau) !== null) continue;
      // On efface d'abord l'ancienne copie pour libérer la place (la
      // mémoire est limitée), puis on écrit la nouvelle. Si l'écriture
      // échoue, on remet l'ancienne : rien n'est perdu.
      localStorage.removeItem(ancien);
      try {
        localStorage.setItem(nouveau, valeur);
      } catch {
        localStorage.setItem(ancien, valeur);
      }
    }
  } catch (erreur) {
    console.error("Migration des données impossible :", erreur);
  }
}
