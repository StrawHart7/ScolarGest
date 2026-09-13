/**
 * Les signalements d'erreur qui n'ont pas pu partir, gardés pour le prochain
 * chargement réussi.
 *
 * **Ce module ne dépend de rien** : il est lu par `src/app/error.tsx`, qui est
 * un composant client.
 *
 * ## Le défaut qu'il répare, constaté en production le 2026-09-13
 *
 * Une erreur est survenue à 12:43:31 sur une fiche de facture, avec pour
 * message « Failed to fetch ». La page d'erreur s'est affichée, l'utilisateur a
 * signalé au support à 12:45, un encaissement est passé à 12:47 — et l'écran
 * « Erreurs » de la Régie est resté à zéro.
 *
 * La cause : `signalerErreurAction` est une Server Action, donc un appel
 * réseau, lancé au moment précis où le réseau venait de tomber. Il a échoué, et
 * il est avalé par conception pour ne pas casser la page d'erreur.
 *
 * **Le pire est que cette famille d'erreurs est la plus intéressante.** Au Togo
 * le courant est coupé trois à six heures ; l'appareil tient, c'est le réseau
 * qui disparaît. Un canal de signalement qui perd systématiquement les pannes
 * réseau ne rapporte que les incidents survenus quand tout allait bien —
 * c'est-à-dire la classe la moins utile.
 *
 * `CLAUDE.md` écrivait déjà la leçon, pour le bouton « Signaler au support » :
 * un signalement qui exige le réseau échoue exactement quand il sert. Celui-là
 * s'en protège par la file hors ligne. Celui-ci ne s'en protégeait pas.
 *
 * ## Pourquoi pas la file d'écritures différées
 *
 * `src/lib/offline/file-attente.ts` existe et fait ce travail. On ne s'en sert
 * **pas** ici, délibérément : cette file transporte des encaissements. Y verser
 * de la télémétrie la ferait concourir avec de l'argent pour la même fenêtre de
 * réseau, et un rejeu bloqué par un signalement serait un très mauvais échange.
 * Perdre un signalement ne coûte rien ; perdre un versement coûte une journée
 * de caisse.
 *
 * D'où ce dépôt minuscule et séparé : quelques entrées en `localStorage`, sans
 * garantie, sans file, sans reprise. Il rattrape le cas courant — le réseau
 * revient dans la même session — et abandonne le reste sans bruit.
 *
 * ## Ce qu'on accepte en échange
 *
 * `controle.erreur."derniereFois"` vaut le moment où le signalement **arrive**,
 * pas celui où l'erreur est survenue : la fonction SQL ne reçoit pas de date,
 * et lui en ajouter une demanderait une migration pour un gain mince. Un
 * signalement rejoué porte donc l'heure du rejeu.
 *
 * C'est supportable parce que la Régie **compte** — combien, combien d'écoles,
 * depuis quand en gros. Ce ne l'est plus au-delà d'une journée, d'où la fenêtre
 * ci-dessous : un signalement plus vieux est jeté plutôt que de faire croire
 * qu'un incident vient de se produire.
 */

/** Au-delà, on jette : un signalement rejoué porte l'heure du rejeu. */
export const FENETRE_REJEU_MS = 12 * 60 * 60 * 1000;

/**
 * Plafond du dépôt.
 *
 * Une page prise dans une boucle de rechargement hors ligne en produirait des
 * centaines. Cinq suffisent à savoir ce qui casse ; au-delà, ce n'est plus de
 * l'information, c'est du volume.
 */
export const MAX_DIFFERES = 5;

const CLE = 'scolargest.signalements-differes';

export interface SignalementDiffere {
  nom: string;
  chemin: string;
  reference: string | null;
  /** Millisecondes epoch, au moment de l'échec d'envoi. */
  quand: number;
}

/**
 * Tous les accès sont gardés.
 *
 * `localStorage` peut lever — navigation privée, données de site bloquées,
 * capture de vignette — et une exception ici tomberait dans la page qui sert
 * justement à afficher une erreur. La règle du dépôt vaut pleinement :
 * ces fonctions avalent leurs échecs.
 */
function lireBrut(): SignalementDiffere[] {
  try {
    const brut = window.localStorage.getItem(CLE);
    if (!brut) return [];
    const valeur: unknown = JSON.parse(brut);
    if (!Array.isArray(valeur)) return [];
    return valeur.filter(estSignalement);
  } catch {
    return [];
  }
}

function estSignalement(valeur: unknown): valeur is SignalementDiffere {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const v = valeur as Record<string, unknown>;
  return (
    typeof v.nom === 'string' &&
    typeof v.chemin === 'string' &&
    typeof v.quand === 'number' &&
    (v.reference === null || typeof v.reference === 'string')
  );
}

function ecrire(liste: SignalementDiffere[]): void {
  try {
    if (liste.length === 0) window.localStorage.removeItem(CLE);
    else window.localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    // Rien à faire, et surtout rien à signaler : on est déjà sur le chemin de
    // repli d'un signalement qui a échoué.
  }
}

/**
 * Dépose un signalement qui n'a pas pu partir.
 *
 * Le doublon est écarté sur (nom, chemin, référence) : réessayer la même page
 * en boucle hors ligne ne doit pas remplir le dépôt d'une seule et même panne.
 */
export function deposer(signalement: SignalementDiffere): void {
  if (typeof window === 'undefined') return;
  const liste = lireBrut();
  const cle = (s: SignalementDiffere) => `${s.nom}|${s.chemin}|${s.reference ?? ''}`;
  if (liste.some((s) => cle(s) === cle(signalement))) return;
  ecrire([...liste, signalement].slice(-MAX_DIFFERES));
}

/**
 * Retire et rend ce qui mérite d'être rejoué.
 *
 * **Le dépôt est vidé en entier**, y compris de ce qui est trop vieux pour
 * partir : garder les périmés les ferait réexaminer à chaque chargement de
 * page, indéfiniment. Et il est vidé **avant** l'envoi, non après — deux
 * onglets qui reviennent en ligne ensemble enverraient sinon deux fois. Perdre
 * un signalement sur une collision vaut mieux que de compter un incident en
 * double sur un écran qui sert à dénombrer.
 */
export function prendreARejouer(maintenant = Date.now()): SignalementDiffere[] {
  if (typeof window === 'undefined') return [];
  const liste = lireBrut();
  if (liste.length === 0) return [];
  ecrire([]);
  return liste.filter((s) => maintenant - s.quand < FENETRE_REJEU_MS);
}
