import type { Role } from '@/services/tenant';

/**
 * Extraction statique de la matrice des permissions.
 *
 * Le risque, sur ce projet, n'est pas l'absence de garde : c'est qu'une garde
 * ne dise pas ce qu'on croit. La Phase 5 a livré un `getEtablissement` gardé
 * par `requireRole()` — donc SUPER_ADMIN seul — qui cassait toute génération de
 * bulletin pour le Directeur, la Secrétaire et le Comptable. Aucun test ne l'a
 * vu, parce que les appelants mockaient le service.
 *
 * On lit donc le code source lui-même plutôt que le comportement : chaque
 * fonction exportée d'un service est rattachée aux rôles de son `requireRole`.
 * Analyse purement lexicale, sans exécution ni accès à la base — c'est ce qui
 * la rend utilisable dans un test unitaire.
 */

export const ROLES: Role[] = [
  'SUPER_ADMIN',
  'DIRECTEUR',
  'SECRETAIRE',
  'COMPTABLE',
  'ENSEIGNANT',
];

/**
 * Nature de la garde trouvée en tête d'une fonction exportée.
 *
 * - `roles`   : `requireRole('DIRECTEUR', ...)` — liste explicite. Quand un
 *   corps en contient plusieurs (`inviteUtilisateur` exige SUPER_ADMIN pour
 *   créer un Directeur, mais accepte un Directeur pour les autres rôles), on
 *   retient l'**union** et on marque la garde conditionnelle : n'annoncer que
 *   la première branche sous-estimerait les droits réellement ouverts.
 * - `dynamique` : les rôles viennent d'une variable (`requireRole(...roles)`),
 *   l'analyse statique ne peut pas les résoudre ; à revoir à la main.
 * - `authentifie` : pas de `requireRole`, mais un `getTenantContext()` — donc
 *   une session est exigée, sans restriction de rôle.
 * - `deleguee` : pas de garde propre, mais la fonction appelle une autre
 *   fonction de service qui, elle, en a une. C'est le cas de
 *   `getUrlTelechargementDocument`, qui s'appuie sur `getDocument`, ou de
 *   `approuverModification`, qui passe par `exigerPin`. Les compter comme non
 *   gardées noierait les vrais oublis sous le bruit.
 * - `aucune`  : ni l'un ni l'autre. Presque toujours une fonction utilitaire,
 *   parfois un oubli — c'est justement ce qu'on veut voir apparaître.
 */
export type Garde =
  | { type: 'roles'; roles: Role[]; conditionnel?: boolean }
  | { type: 'dynamique' }
  | { type: 'authentifie' }
  | { type: 'deleguee'; vers: string }
  | { type: 'aucune' };

export interface EntreeMatrice {
  service: string;
  fonction: string;
  garde: Garde;
  /**
   * La fonction ouvre-t-elle un client Supabase ?
   *
   * C'est ce qui sépare un calcul pur — légitimement sans garde — d'une lecture
   * ou d'une écriture qui, elle, doit en avoir une. Calculé pendant
   * l'extraction, là où le corps de la fonction est correctement délimité.
   */
  accedeDonnees: boolean;
}

export interface FichierService {
  /** Nom du service, sans chemin ni extension (ex. « eleve »). */
  nom: string;
  contenu: string;
}

/**
 * Repère les fonctions exportées, sous les quatre formes réellement présentes
 * dans `src/services/` :
 *
 *   export async function nom(          — le cas courant
 *   export function nom(
 *   export const nom = memoiserParRequete(async function nom(
 *   export const nom = async (
 */
const DEBUT_EXPORT =
  /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*[(<]|^export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:[A-Za-z0-9_]+\()?\s*async\b/gm;

/** Un littéral de rôle entre quotes, à l'intérieur des parenthèses de `requireRole`. */
const ROLE_LITTERAL = /'(SUPER_ADMIN|DIRECTEUR|SECRETAIRE|COMPTABLE|ENSEIGNANT)'/g;

/**
 * Arguments de chaque `requireRole(...)` du corps.
 *
 * On s'arrête à la première parenthèse fermante : aucun appel `requireRole` du
 * dépôt n'imbrique d'appel dans ses arguments, et une analyse à balancement
 * complet coûterait bien plus qu'elle ne rapporte ici.
 */
function tousLesRequireRole(corps: string): string[] {
  const appels: string[] = [];
  let depuis = 0;

  for (;;) {
    const index = corps.indexOf('requireRole(', depuis);
    if (index === -1) return appels;
    const debut = index + 'requireRole('.length;
    const fin = corps.indexOf(')', debut);
    if (fin === -1) return appels;
    appels.push(corps.slice(debut, fin));
    depuis = fin + 1;
  }
}

function lireGarde(corps: string): Garde {
  const appels = tousLesRequireRole(corps);

  if (appels.length === 0) {
    return corps.includes('getTenantContext(') ? { type: 'authentifie' } : { type: 'aucune' };
  }

  const cumul = new Set<Role>();

  for (const appel of appels) {
    const nu = appel.trim();

    // `requireRole()` sans argument ne veut pas dire « n'importe quel
    // utilisateur authentifié » : la garde ne laisse alors passer que le
    // SUPER_ADMIN, par le court-circuit de `requireRole`. Piège documenté dans
    // CLAUDE.md, rendu visible ici plutôt que laissé à la lecture.
    if (nu.length === 0) {
      cumul.add('SUPER_ADMIN');
      continue;
    }

    const trouves = [...nu.matchAll(ROLE_LITTERAL)].map((m) => m[1] as Role);
    if (trouves.length === 0) return { type: 'dynamique' };
    for (const role of trouves) cumul.add(role);
  }

  // Le SUPER_ADMIN passe toujours (court-circuit de `requireRole`) : l'ajouter
  // ici évite une matrice qui laisserait croire le contraire.
  const roles = ROLES.filter((role) => role === 'SUPER_ADMIN' || cumul.has(role));
  return appels.length > 1
    ? { type: 'roles', roles, conditionnel: true }
    : { type: 'roles', roles };
}

/**
 * Alias local qui porte lui-même une garde, du type
 * `const verifierPin = (pin: string) => exigerPin(pin, 'SECRETAIRE');`.
 */
const ALIAS_GARDE = /const\s+([A-Za-z0-9_]+)\s*=[^;]*?\b(?:requireRole|exigerPin)\s*\(/g;

/** Découpe un fichier en corps de fonctions exportées. */
function decouper(contenu: string): { fonction: string; corps: string }[] {
  const bornes: { fonction: string; debut: number }[] = [];

  DEBUT_EXPORT.lastIndex = 0;
  let trouve: RegExpExecArray | null;
  while ((trouve = DEBUT_EXPORT.exec(contenu)) !== null) {
    const nom = trouve[1] ?? trouve[2];
    if (nom) bornes.push({ fonction: nom, debut: trouve.index });
  }

  return bornes.map((borne, i) => ({
    fonction: borne.fonction,
    corps: contenu.slice(borne.debut, bornes[i + 1]?.debut ?? contenu.length),
  }));
}

export function extraireMatrice(fichiers: FichierService[]): EntreeMatrice[] {
  const entrees: EntreeMatrice[] = [];
  const corpsParEntree = new Map<EntreeMatrice, string>();

  for (const fichier of fichiers) {
    for (const { fonction, corps } of decouper(fichier.contenu)) {
      const entree: EntreeMatrice = {
        service: fichier.nom,
        fonction,
        garde: lireGarde(corps),
        accedeDonnees: corps.includes('createClient()') || corps.includes('createAdminClient()'),
      };
      entrees.push(entree);
      corpsParEntree.set(entree, corps);
    }
  }

  // Deuxième passe : une fonction sans garde propre qui en appelle une gardée
  // est protégée par elle. Sans cette passe, la matrice signalerait comme
  // « aucune garde » des fonctions parfaitement sûres, et le bruit finirait par
  // faire ignorer les vraies alertes.
  const gardees = new Set(
    entrees
      .filter((e) => e.garde.type === 'roles' || e.garde.type === 'dynamique')
      .map((e) => e.fonction),
  );

  // Les alias locaux comptent aussi. `note.ts` définit
  // `const verifierPin = (pin) => exigerPin(pin, 'SECRETAIRE')` : la garde est
  // bien là, simplement derrière un nom qui n'est pas exporté.
  for (const fichier of fichiers) {
    for (const alias of fichier.contenu.matchAll(ALIAS_GARDE)) {
      if (alias[1]) gardees.add(alias[1]);
    }
  }

  for (const entree of entrees) {
    if (entree.garde.type !== 'aucune') continue;
    const corps = corpsParEntree.get(entree) ?? '';
    const appelee = [...gardees].find(
      (nom) => nom !== entree.fonction && new RegExp('\\b' + nom + '\\s*\\(').test(corps),
    );
    if (appelee) entree.garde = { type: 'deleguee', vers: appelee };
  }

  return entrees.sort(
    (a, b) => a.service.localeCompare(b.service) || a.fonction.localeCompare(b.fonction),
  );
}

/** Forme compacte et stable, pour comparer une matrice à un instantané versionné. */
export function signature(entree: EntreeMatrice): string {
  const garde =
    entree.garde.type === 'roles'
      ? entree.garde.roles.join('+') + (entree.garde.conditionnel ? ' (conditionnel)' : '')
      : entree.garde.type === 'deleguee'
        ? `DELEGUEE:${entree.garde.vers}`
        : entree.garde.type.toUpperCase();
  return `${entree.service}.${entree.fonction} = ${garde}`;
}

/** Rendu Markdown : une ligne par fonction, une colonne par rôle. */
export function versMarkdown(entrees: EntreeMatrice[]): string {
  const lignes: string[] = [];

  lignes.push('# Matrice des permissions');
  lignes.push('');
  lignes.push(
    '> Généré par `npx tsx scripts/matrice-permissions.ts` à partir des gardes',
    "> `requireRole(...)` de `src/services/`. Ne pas modifier à la main : c'est le code",
    '> qui fait foi, et `matrice-permissions.test.ts` compare les deux.',
  );
  lignes.push('');
  lignes.push('Légende : `X` autorisé, `·` refusé.');
  lignes.push('');
  lignes.push(`| Service | Fonction | ${ROLES.join(' | ')} |`);
  lignes.push(`|---|---|${ROLES.map(() => '---').join('|')}|`);

  for (const entree of entrees) {
    const cellules = ROLES.map((role) => {
      if (entree.garde.type === 'roles') return entree.garde.roles.includes(role) ? 'X' : '·';
      return '?';
    });
    const note =
      entree.garde.type === 'roles'
        ? entree.garde.conditionnel
          ? ' _(garde conditionnelle — union des branches)_'
          : ''
        : entree.garde.type === 'authentifie'
          ? ' _(session requise, tous rôles)_'
          : entree.garde.type === 'deleguee'
            ? ` _(garde héritée de \`${entree.garde.vers}\`)_`
            : entree.garde.type === 'dynamique'
              ? ' _(rôles dynamiques — à revoir)_'
              : ' _(aucune garde)_';
    lignes.push(
      `| \`${entree.service}\` | \`${entree.fonction}\`${note} | ${cellules.join(' | ')} |`,
    );
  }

  lignes.push('');
  return lignes.join('\n');
}
