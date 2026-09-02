import type { Role } from '@/services/tenant';

/**
 * Vocabulaire du contact support : types, catégories, statuts, libellés.
 *
 * **Ce module ne dépend de rien**, délibérément — même raison que
 * `src/lib/emploi-du-temps.ts`. Les composants clients (formulaire de dépôt,
 * carte de réponse) ont besoin de la liste des catégories et des libellés de
 * statut ; les laisser dans `src/services/support.ts` faisait remonter
 * `next/headers` dans un bundle client et **cassait le build** :
 *
 *     You're importing a component that needs next/headers.
 *     ./src/lib/supabase/server.ts → ./src/services/support.ts
 *                                  → ./src/app/profil/support/FormulaireSupport.tsx
 *
 * `tsc` et ESLint n'ont rien vu : ni l'un ni l'autre ne connaît cette
 * frontière. Ne jamais importer de service ici.
 */

export type CategorieSupport =
  | 'COMPTE_ACCES'
  | 'NOTES_BULLETINS'
  | 'FINANCES'
  | 'ABONNEMENT_PAIEMENT'
  | 'ANOMALIE'
  | 'AUTRE';

export type StatutSupport = 'NOUVELLE' | 'EN_COURS' | 'RESOLUE' | 'FERMEE';

export const CATEGORIES_SUPPORT: { valeur: CategorieSupport; libelle: string }[] = [
  { valeur: 'COMPTE_ACCES', libelle: 'Compte et accès' },
  { valeur: 'NOTES_BULLETINS', libelle: 'Notes et bulletins' },
  { valeur: 'FINANCES', libelle: 'Factures et paiements' },
  { valeur: 'ABONNEMENT_PAIEMENT', libelle: 'Abonnement ScolarGest' },
  { valeur: 'ANOMALIE', libelle: 'Anomalie ou comportement inattendu' },
  { valeur: 'AUTRE', libelle: 'Autre' },
];

export const STATUTS_SUPPORT: StatutSupport[] = ['NOUVELLE', 'EN_COURS', 'RESOLUE', 'FERMEE'];

export const LIBELLES_STATUT_SUPPORT: Record<StatutSupport, string> = {
  NOUVELLE: 'Nouvelle',
  EN_COURS: 'En cours',
  RESOLUE: 'Résolue',
  FERMEE: 'Fermée',
};

export function libelleCategorie(categorie: CategorieSupport): string {
  return CATEGORIES_SUPPORT.find((c) => c.valeur === categorie)?.libelle ?? categorie;
}

export interface DemandeSupport {
  id: string;
  etablissementId: string;
  auteurNom: string;
  auteurEmail: string;
  auteurRole: Role;
  categorie: CategorieSupport;
  sujet: string;
  message: string;
  pageOrigine: string | null;
  statut: StatutSupport;
  reponseSupport: string | null;
  repondueLe: string | null;
  /** Chemin dans le bucket `support`. Null si aucune pièce jointe. */
  fichierChemin: string | null;
  /** Nom d'origine du fichier : le chemin de stockage est randomisé. */
  fichierNom: string | null;
  createdAt: string;
}

/** Une demande vue par la plateforme, avec le nom de l'école qui l'a envoyée. */
export interface DemandeSupportPlateforme extends DemandeSupport {
  etablissementNom: string;
}

export interface NouvelleDemandeSupport {
  categorie: CategorieSupport;
  sujet: string;
  message: string;
  pageOrigine?: string | null;
}

/**
 * Une pièce jointe en attente d'envoi.
 *
 * Le contenu transite en mémoire plutôt que par un chemin de fichier : la
 * Server Action reçoit un `File` du navigateur, elle n'a pas de disque à
 * partager avec lui.
 */
export interface PieceJointeSupport {
  nom: string;
  type: string;
  contenu: ArrayBuffer;
}

/**
 * Types acceptés en pièce jointe, et taille maximale.
 *
 * Restreint aux classeurs, PDF et images : c'est ce qu'une école a sous la
 * main pour illustrer un problème. Accepter n'importe quoi ferait du bucket un
 * dépôt de fichiers arbitraires, alimenté par des comptes que la plateforme ne
 * choisit pas.
 */
export const TYPES_PIECE_JOINTE = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const TAILLE_MAX_PIECE_JOINTE = 10 * 1024 * 1024;

export const EXTENSIONS_PIECE_JOINTE = '.xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp';
