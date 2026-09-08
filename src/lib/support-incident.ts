/**
 * Contexte technique d'une panne, tel qu'il part au support.
 *
 * **Ce module ne depend de rien**, comme `src/lib/support.ts` : il est lu par
 * la page d'erreur, qui est un composant client. Y importer un service ferait
 * remonter `next/headers` dans le bundle client et casserait le build sans que
 * `tsc` ni ESLint ne le voient (panne du 2026-09-02, voir `CLAUDE.md`).
 *
 * ## Pourquoi le contexte et non une capture d'ecran
 *
 * L'idee d'origine etait de photographier l'ecran en panne. Trois obstacles,
 * instruits avant d'ecrire une ligne :
 *
 * - Un navigateur ne se photographie pas lui-meme. `getDisplayMedia` demande a
 *   l'utilisateur de **choisir une fenetre** et capture tout l'ecran — donc
 *   potentiellement autre chose que ScolarGest. Poser cette question a
 *   quelqu'un qui est deja bloque est le pire moment.
 * - `html2canvas` redessine le DOM : dependance lourde, rendu approximatif, et
 *   sur une page en erreur il ne reste souvent aucun DOM utile a capturer.
 * - Une capture d'un ecran ScolarGest contient des noms d'eleves et parfois des
 *   montants. L'envoyer sort ces donnees de l'ecole.
 *
 * Le contexte, lui, est toujours disponible, il pese quelques centaines
 * d'octets, et il repond aux questions que le support pose de toute facon :
 * quelle page, quand, sur quel appareil, avec quelle reference. La capture
 * reste une option a instruire ; elle n'est pas le mecanisme.
 */

/**
 * Longueurs bornees. Le message d'une demande est plafonne a 4000 caracteres
 * par le schema d'envoi : une pile d'appels ou un `userAgent` exotique ne doit
 * pas manger la place de la phrase ecrite par l'utilisateur.
 */
const MAX_MESSAGE_TECHNIQUE = 500;
const MAX_NAVIGATEUR = 200;
const MAX_CHEMIN = 200;

export interface ContexteIncident {
  /** `digest` de Next : le seul identifiant partage avec les logs serveur. */
  reference: string | null;
  /** Chemin **sans** query string — voir `cheminSansParametres`. */
  chemin: string;
  message: string;
  survenuLe: string;
  horsLigne: boolean;
  /** `1280x800`. Distingue un defaut mobile d'un defaut bureau sans capture. */
  ecran: string | null;
  navigateur: string | null;
  /** Version deployee, quand l'hebergeur l'expose. Sinon absente, pas fausse. */
  version: string | null;
}

/**
 * Retire la query string et le fragment.
 *
 * Ce n'est pas de la coquetterie : sur `/etablissement/eleves`, `?q=` porte la
 * **recherche libre** tapee par l'utilisateur, c'est-a-dire le plus souvent le
 * nom d'un eleve. Le chemin seul identifie l'ecran, ce dont le support a
 * besoin ; la query string est precisement l'endroit ou atterrissent les
 * donnees de l'ecole.
 */
export function cheminSansParametres(url: string): string {
  const coupe = url.split('#')[0]?.split('?')[0] ?? '';
  const chemin = coupe.trim() === '' ? '/' : coupe;
  return chemin.slice(0, MAX_CHEMIN);
}

function borner(valeur: string | null | undefined, max: number): string | null {
  if (typeof valeur !== 'string') return null;
  const propre = valeur.trim();
  if (propre === '') return null;
  return propre.length > max ? `${propre.slice(0, max)}…` : propre;
}

/**
 * Decrit l'incident a partir de ce que le navigateur sait de lui-meme.
 *
 * Les acces au `window` sont tous gardes : cette fonction est appelee depuis un
 * composant client, mais elle est aussi testee sous Node, ou `navigator`
 * n'existe pas. Un champ manquant vaut mieux qu'une exception dans la page qui
 * sert justement a signaler une exception.
 */
export function decrireIncident(erreur: {
  message?: string;
  digest?: string;
}): ContexteIncident {
  const fenetre = typeof window === 'undefined' ? null : window;
  const nav = typeof navigator === 'undefined' ? null : navigator;

  return {
    reference: borner(erreur.digest, 100),
    chemin: cheminSansParametres(fenetre?.location?.pathname ?? ''),
    message: borner(erreur.message, MAX_MESSAGE_TECHNIQUE) ?? 'Message non transmis.',
    survenuLe: new Date().toISOString(),
    // `navigator.onLine` ment quand une interface est active sans acces reel a
    // Internet ; on transmet donc ce qu'il dit, sans en tirer de conclusion.
    horsLigne: nav ? nav.onLine === false : false,
    ecran: fenetre?.innerWidth ? `${fenetre.innerWidth}x${fenetre.innerHeight}` : null,
    navigateur: borner(nav?.userAgent, MAX_NAVIGATEUR),
    // Expose par Vercel quand les variables systeme le sont. Absente en local,
    // et absente plutot qu'inventee : une version fausse enverrait le support
    // relire le mauvais commit.
    version: borner(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA, 12),
  };
}

/**
 * Le bloc exact qui part au support — celui-la meme qu'on montre a
 * l'utilisateur avant l'envoi.
 *
 * Une seule fonction produit le texte affiche **et** le texte envoye. En avoir
 * deux ferait diverger la promesse et le contenu, ce qui est exactement ce
 * qu'on cherche a eviter en montrant le bloc.
 */
export function formaterIncident(contexte: ContexteIncident): string {
  const lignes = [
    `Reference : ${contexte.reference ?? 'aucune'}`,
    `Page : ${contexte.chemin}`,
    `Survenu le : ${contexte.survenuLe}`,
    `Connexion au moment de l'erreur : ${contexte.horsLigne ? 'hors ligne' : 'en ligne'}`,
  ];
  if (contexte.ecran) lignes.push(`Ecran : ${contexte.ecran}`);
  if (contexte.navigateur) lignes.push(`Navigateur : ${contexte.navigateur}`);
  if (contexte.version) lignes.push(`Version : ${contexte.version}`);
  lignes.push(`Message technique : ${contexte.message}`);
  return lignes.join('\n');
}

/**
 * Message complet de la demande : la phrase de l'utilisateur d'abord.
 *
 * Le support lit une file ; ce qu'une personne a pris la peine d'ecrire doit
 * arriver avant le bloc technique, pas apres trente lignes de `userAgent`.
 */
export function messageIncident(contexte: ContexteIncident, description: string): string {
  const propre = description.trim();
  const technique = `--- Contexte technique (envoye automatiquement) ---\n${formaterIncident(contexte)}`;
  if (propre === '') {
    return `Signalement depuis la page d'erreur, sans description.\n\n${technique}`;
  }
  return `${propre}\n\n${technique}`;
}

/**
 * Sujet de la demande. Borne a 150 caracteres par le schema d'envoi.
 *
 * La reference y figure quand elle existe : c'est le seul point commun entre
 * ce que voit l'utilisateur et ce que le support retrouve dans les logs.
 */
export function sujetIncident(contexte: ContexteIncident): string {
  const base = contexte.reference
    ? `Erreur applicative — reference ${contexte.reference}`
    : `Erreur applicative sur ${contexte.chemin}`;
  return base.slice(0, 150);
}
