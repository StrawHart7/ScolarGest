'use client';

/**
 * Derniere identite connue sur cet appareil.
 *
 * ## Pourquoi ce detour
 *
 * La file d'ecritures differees est rangee par `userId`, et
 * `SynchronisationProvider` fournit cet identifiant a tous les ecrans. Mais il
 * est monte par `AppLayout`, **a l'interieur** des pages : sur `error.tsx`, qui
 * remplace la page en panne, le fournisseur n'existe pas. La page d'erreur est
 * pourtant exactement celle qui a besoin de mettre une demande en file — une
 * panne survient souvent *parce que* le reseau est mauvais.
 *
 * D'ou cette memoire minuscule, ecrite par le fournisseur quand tout va bien et
 * relue par la page d'erreur quand plus rien ne va.
 *
 * ## Ce que ce n'est pas
 *
 * **Ce n'est pas une identite de confiance, et rien ne repose dessus.** Elle
 * sert a choisir le casier local ou deposer l'operation, rien d'autre :
 *
 * - l'auteur reel de la demande est fige cote serveur a l'envoi, et la policy
 *   `support_demande_insert_tenant` impose `auteurId = auth.uid()` — une
 *   valeur perimee ici ne peut pas signer une demande du nom de quelqu'un
 *   d'autre ;
 * - le vidage de la file ne traite que le casier du compte connecte
 *   (`listerFile(userId)`), donc une operation deposee sous un ancien compte
 *   attend son proprietaire au lieu d'etre attribuee au suivant ;
 * - la deconnexion efface la file **et** cette memoire (`effacerToutLeLocal`),
 *   ce qui referme le cas du poste partage.
 *
 * `localStorage` et non IndexedDB : la lecture doit etre synchrone, faite au
 * premier rendu d'une page d'erreur, sans attendre l'ouverture d'une base qui
 * peut elle-meme echouer.
 */

const CLE = 'scolargest.identite';

export interface IdentiteLocale {
  userId: string;
  etablissementId: string;
}

export function memoriserIdentite(identite: IdentiteLocale): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(identite));
  } catch {
    // Navigation privee stricte, quota refuse : le signalement hors ligne ne
    // sera pas possible, tout le reste continue. Jamais bloquant.
  }
}

export function lireIdentite(): IdentiteLocale | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const valeur = JSON.parse(brut) as Partial<IdentiteLocale>;
    if (typeof valeur.userId !== 'string' || valeur.userId === '') return null;
    if (typeof valeur.etablissementId !== 'string' || valeur.etablissementId === '') return null;
    return { userId: valeur.userId, etablissementId: valeur.etablissementId };
  } catch {
    // Valeur corrompue par une version anterieure : on l'ignore plutot que de
    // lever dans une page d'erreur.
    return null;
  }
}

export function oublierIdentite(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {
    // Sans consequence : la file qu'elle designait vient d'etre videe.
  }
}
