/**
 * Vocabulaire de la télémétrie envoyée à la Régie.
 *
 * **Ce module ne dépend de rien** — même raison que `src/lib/emploi-du-temps.ts`
 * ou `src/lib/support.ts` : il doit être importable d'un composant client sans
 * y faire entrer `next/headers`. Les fonctions gardées vivent dans
 * `src/services/telemetrie.ts`.
 *
 * ## La règle que ce fichier sert
 *
 * Un événement dit **qu'il s'est passé quelque chose**, jamais **quoi**. Pas de
 * nom d'élève, pas de montant, pas de note, pas de texte libre. C'est la
 * promesse de confidentialité du produit : la console fondateur compte, elle ne
 * consulte pas.
 *
 * La règle est tenue par la base — `controle.meta_sans_contenu`, appelée par
 * une contrainte `CHECK` — et non par ce fichier, qui peut être contourné. Ce
 * qui est ici sert à **échouer tôt et lisiblement**, en développement, plutôt
 * qu'à recevoir un `23514` illisible en production.
 *
 * `src/lib/__tests__/telemetrie.test.ts` lit la migration réelle et compare les
 * deux vocabulaires : les recopier à deux endroits sans ce test les ferait
 * diverger au premier ajout, et la divergence ne se verrait qu'à l'écriture.
 */

/**
 * Les types d'événements émis par le produit.
 *
 * Une union fermée plutôt qu'une chaîne libre : une faute de frappe devient
 * une erreur de compilation au lieu d'une famille d'événements fantôme que
 * personne ne remarque avant d'essayer de compter dessus.
 *
 * Le format est contraint en base (`^[a-z][a-z0-9_.]{2,48}$`) : un point
 * sépare le domaine du fait, pour que le cockpit puisse regrouper par préfixe.
 */
export type TypeEvenement =
  | 'session.ouverte'
  | 'ecole.configuree'
  | 'classe.creee'
  | 'eleve.importe'
  | 'bulletin.genere'
  | 'paiement.enregistre'
  | 'abonnement.souscrit'
  | 'referentiel.projete'
  | 'support.demande';

/**
 * Les seules clés qu'un événement peut porter.
 *
 * Miroir exact de la liste inscrite dans `controle.meta_sans_contenu`.
 * Élargir cette liste est une décision de confidentialité : chaque clé est une
 * porte, et une porte nommée « entite » finit par transporter un nom si
 * personne ne la borne.
 */
export const CLES_META = [
  'route',
  'action',
  'entite',
  'code',
  'statut',
  'origine',
  'resultat',
  'cycle',
  'niveau',
  'serie',
  'periode',
  'role',
  'version',
  'canal',
  'duree_ms',
  'nombre',
  'taille',
  'source',
] as const;

export type CleMeta = (typeof CLES_META)[number];

/** Longueur maximale d'une valeur textuelle. Identique à la contrainte en base. */
export const LONGUEUR_MAX_VALEUR = 64;

export type MetaEvenement = Partial<Record<CleMeta, string | number | boolean>>;

export interface MetaNettoyee {
  meta: Record<string, string | number | boolean>;
  /** Ce qui a été écarté, et pourquoi. Vide en fonctionnement normal. */
  rejets: string[];
}

/**
 * Retire d'un `meta` tout ce que la base refuserait.
 *
 * **Nettoyer plutôt que lever.** Une télémétrie qui fait échouer l'action
 * qu'elle observe est une régression : perdre un événement est sans
 * conséquence, perdre un encaissement n'en est pas une. Les rejets sont rendus
 * pour que l'appelant les signale une fois, pas pour qu'il s'arrête.
 *
 * Trois motifs de rejet, dans l'ordre où ils se produisent en pratique :
 * une clé hors vocabulaire, une valeur non scalaire (un objet glissé « pour
 * déboguer »), une chaîne trop longue — c'est celle-là qui transporterait un
 * nom complet.
 */
export function nettoyerMeta(brut: MetaEvenement | undefined): MetaNettoyee {
  const meta: Record<string, string | number | boolean> = {};
  const rejets: string[] = [];
  if (!brut) return { meta, rejets };

  for (const [cle, valeur] of Object.entries(brut)) {
    if (valeur === undefined || valeur === null) continue;

    if (!(CLES_META as readonly string[]).includes(cle)) {
      rejets.push(`clé hors vocabulaire : ${cle}`);
      continue;
    }
    const type = typeof valeur;
    if (type !== 'string' && type !== 'number' && type !== 'boolean') {
      rejets.push(`valeur non scalaire : ${cle}`);
      continue;
    }
    if (type === 'number' && !Number.isFinite(valeur as number)) {
      rejets.push(`nombre non fini : ${cle}`);
      continue;
    }
    if (type === 'string' && (valeur as string).length > LONGUEUR_MAX_VALEUR) {
      rejets.push(`valeur trop longue (> ${LONGUEUR_MAX_VALEUR}) : ${cle}`);
      continue;
    }
    meta[cle] = valeur as string | number | boolean;
  }

  return { meta, rejets };
}

/**
 * Longueur maximale d'une route inscrite dans le plan de contrôle.
 *
 * `controle.erreur.route` est tronquée à 160 par la fonction SQL ; on borne
 * plus bas ici pour que la troncature soit une décision de ce fichier, visible
 * et testée, et non un effet de bord invisible côté base.
 */
export const LONGUEUR_MAX_ROUTE = 120;

/**
 * Un segment d'URL qui désigne un **écran** : minuscules et tirets, commençant
 * par une lettre. C'est exactement la forme des routes de ce dépôt — vérifié
 * sur les neuf segments dynamiques existants, tous des identifiants, et sur
 * l'intégralité des segments statiques, dont aucun ne porte de chiffre.
 */
const SEGMENT_ECRAN = /^[a-z][a-z-]{0,39}$/;

/**
 * Réduit un chemin d'URL à ce que la Régie a le droit de voir.
 *
 * ## Pourquoi une liste blanche et non une liste noire
 *
 * Le premier jet masquait ce qui *ressemblait* à un identifiant — un UUID, une
 * suite de chiffres. C'est le mauvais sens : un segment inattendu passait
 * alors tel quel. `/etablissement/eleves/Jean%20Dupont` n'est pas une route de
 * ce produit, mais rien n'empêche une URL tapée à la main d'y ressembler, et
 * le nom serait parti dans le plan de contrôle sans qu'aucune règle écrite ne
 * soit enfreinte — exactement le défaut que `erreurs_regie` ferme en refusant
 * de stocker les messages.
 *
 * Ici l'inconnu est masqué par défaut. Le prix est une route moins précise le
 * jour où une convention de nommage change ; le gain est qu'aucune donnée
 * d'école ne peut sortir par ce chemin, quelle que soit l'URL demandée.
 *
 * ## Le second usage, qui compte autant
 *
 * `controle.erreur` groupe par empreinte, et l'empreinte porte la route. Sans
 * normalisation, un seul défaut sur la fiche élève produirait **une ligne par
 * élève consulté** : la table gonflerait, et l'écran « Erreurs » afficherait
 * trois cents incidents distincts là où il y en a un.
 */
export function normaliserRoute(chemin: string | null | undefined): string {
  if (typeof chemin !== 'string') return '/';

  // La query string est l'endroit où atterrissent les données de l'école : sur
  // une liste, `?q=` porte la recherche libre, donc le plus souvent un nom
  // d'élève. Même raisonnement que `cheminSansParametres` côté support.
  const sansParametres = chemin.split('#')[0]?.split('?')[0] ?? '';
  const propre = sansParametres.trim();
  if (propre === '' || propre === '/') return '/';

  const segments = propre
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => (SEGMENT_ECRAN.test(segment) ? segment : ':id'));

  const route = `/${segments.join('/')}`;
  return route.length > LONGUEUR_MAX_ROUTE ? route.slice(0, LONGUEUR_MAX_ROUTE) : route;
}
