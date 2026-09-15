/**
 * Se connecter sans adresse email.
 *
 * ## Le problème, tel qu'il se pose au Togo
 *
 * Beaucoup d'enseignants — et une partie des secrétaires — n'ont pas d'adresse
 * email, ou en ont une qu'ils ne consultent jamais. Or l'invitation partait par
 * courrier électronique : le compte ne s'ouvrait qu'en cliquant un lien reçu
 * dans une boîte que la personne ne sait pas ouvrir. Le directeur restait donc
 * seul sur la plateforme, à saisir pour tout le monde.
 *
 * ## Pourquoi aucune colonne, et aucune migration
 *
 * Le premier réflexe était d'ajouter `utilisateur.identifiant` et de rendre
 * `email` nullable. Inutile : **l'identifiant est l'adresse**, privée de son
 * domaine. Un compte « kossi.adjovi » porte l'email interne
 * `kossi.adjovi@comptes.scolargest.com`, jamais envoyée nulle part, et
 * l'identifiant s'en déduit par un simple retrait de suffixe.
 *
 * Trois conséquences qui valent la peine :
 *
 * - **Aucune migration sur une base partagée avec la production.** Le schéma
 *   ne bouge pas, `email` reste `NOT NULL`.
 * - **L'unicité est déjà tenue**, et par la bonne autorité : `auth.users.email`
 *   est unique globalement. Pas d'index à poser, pas de course entre deux
 *   créations simultanées à arbitrer.
 * - Le domaine est un sous-domaine de `scolargest.com`, que nous possédons :
 *   personne ne peut recevoir le courrier d'un de ces comptes, même par
 *   accident.
 *
 * La contrepartie est assumée : un compte a **soit** une vraie adresse, **soit**
 * un identifiant, jamais les deux. C'est acceptable — ces comptes existent
 * précisément parce qu'il n'y a pas d'adresse.
 *
 * ## Ce que ça coûte, et qu'il faut avoir en tête
 *
 * Sans adresse, il n'y a plus de « mot de passe oublié » en libre-service :
 * **le directeur devient le mécanisme de réinitialisation**. C'est tenable dans
 * une école, mais ça veut dire qu'un directeur qui perd son propre accès dépend
 * du support. L'adresse email reste donc proposée en premier quand la personne
 * en a une : elle est plus autonome.
 */

/** Sous-domaine réservé aux comptes sans adresse. Ne reçoit aucun courrier. */
export const DOMAINE_INTERNE = 'comptes.scolargest.com';

const SUFFIXE = `@${DOMAINE_INTERNE}`;

/**
 * Ramène une saisie à la forme d'un identifiant : minuscules, sans accent,
 * points et tirets conservés, le reste remplacé.
 *
 * Les accents sont retirés et non refusés : « Koffi Ayélé » doit produire un
 * identifiant utilisable, et quelqu'un qui tape « ayele » doit retrouver son
 * compte. Un identifiant qu'on ne sait pas retaper ne sert à rien.
 */
export function normaliserIdentifiant(brut: string): string {
  return brut
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.\-]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.\-]+|[.\-]+$/g, '');
}

/** L'adresse interne d'un identifiant. */
export function emailDepuisIdentifiant(identifiant: string): string {
  return `${normaliserIdentifiant(identifiant)}${SUFFIXE}`;
}

/** Vrai quand ce compte se connecte par identifiant et n'a pas d'adresse. */
export function estCompteSansEmail(email: string): boolean {
  return email.toLowerCase().endsWith(SUFFIXE);
}

/**
 * Ce qu'on montre à l'écran : l'identifiant pour un compte sans adresse,
 * l'adresse telle quelle sinon.
 *
 * Afficher « kossi.adjovi@comptes.scolargest.com » dans la liste des
 * utilisateurs ferait croire à une vraie boîte, et quelqu'un finirait par y
 * écrire.
 */
export function identifiantAffiche(email: string): string {
  return estCompteSansEmail(email) ? email.slice(0, -SUFFIXE.length) : email;
}

/**
 * Ce que l'écran de connexion envoie à Supabase.
 *
 * Une saisie sans `@` est un identifiant : on la complète. C'est ce qui permet
 * au même champ de servir les deux publics sans leur demander de choisir un
 * mode — personne ne devrait avoir à savoir de quel type de compte il dispose.
 */
export function identifiantOuEmail(saisie: string): string {
  const valeur = saisie.trim();
  return valeur.includes('@') ? valeur : emailDepuisIdentifiant(valeur);
}

/**
 * Identifiant proposé à partir de l'état civil : « prenom.nom ».
 *
 * Ce sens-là et pas l'autre : c'est l'ordre dans lequel on se présente, et
 * l'identifiant doit se dicter au téléphone sans hésitation.
 */
export function proposerIdentifiant(nom: string, prenoms: string): string {
  const premierPrenom = prenoms.trim().split(/\s+/)[0] ?? '';
  return normaliserIdentifiant(`${premierPrenom}.${nom}`);
}

/**
 * Un identifiant utilisable : au moins trois caractères, et pas seulement des
 * séparateurs. En dessous, il devient impossible à distinguer d'un autre au
 * sein d'une école.
 */
export function identifiantValide(identifiant: string): boolean {
  const propre = normaliserIdentifiant(identifiant);
  return propre.length >= 3 && /[a-z0-9]/.test(propre);
}

/**
 * Alphabet du mot de passe provisoire.
 *
 * Ni `I`, ni `l`, ni `1`, ni `O`, ni `0` : ce mot de passe est **recopié à la
 * main sur un bout de papier** puis retapé par quelqu'un qui n'a peut-être
 * jamais utilisé de clavier. Deux caractères qui se ressemblent, et c'est un
 * appel au directeur.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Un mot de passe provisoire de douze caractères.
 *
 * `crypto.getRandomValues` et non `Math.random` : c'est le seul secret qui
 * protège un compte jusqu'à son premier changement, et il est distribué sur
 * papier. Le tirage est **rejeté puis recommencé** au-delà du plus grand
 * multiple de la taille de l'alphabet, sinon un simple modulo rendrait les
 * premiers caractères plus probables que les derniers.
 */
export function motDePasseProvisoire(longueur = 12): string {
  const octets = new Uint8Array(longueur * 2);
  let sortie = '';
  while (sortie.length < longueur) {
    crypto.getRandomValues(octets);
    for (const octet of octets) {
      if (sortie.length >= longueur) break;
      const plafond = 256 - (256 % ALPHABET.length);
      if (octet >= plafond) continue;
      sortie += ALPHABET[octet % ALPHABET.length];
    }
  }
  return sortie;
}
