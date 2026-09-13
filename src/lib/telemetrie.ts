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
  | 'support.demande'
  | 'erreur.applicative';

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
