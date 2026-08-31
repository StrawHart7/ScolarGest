/**
 * Opérateurs Mobile Money proposés au paiement, et leur pays.
 *
 * Module distinct de `client.ts`, qui est `server-only` et charge le SDK
 * FedaPay : une page qui a seulement besoin de cette liste n'a aucune raison
 * d'embarquer axios et la configuration des clés.
 *
 * La liste tient à quatre entrées parce que l'API de paiement mobile direct de
 * FedaPay n'en documente pas davantage. Au Togo, `moov_tg` signifie **Flooz,
 * pas T-Money** : une école qui n'a que du T-Money doit passer par la page
 * hébergée, d'où le second moyen de paiement proposé à l'écran.
 */

export type Operateur = 'moov_tg' | 'mtn' | 'moov' | 'mtn_ci' | 'momo_test';

export interface DefinitionOperateur {
  code: Operateur;
  libelle: string;
  /** Code ISO du pays, tel qu'attendu par FedaPay. */
  pays: string;
  /** Consigne affichée sous le champ de numéro. */
  aide?: string;
}

const REELS: DefinitionOperateur[] = [
  { code: 'moov_tg', libelle: 'Moov Africa (Flooz)', pays: 'tg' },
  { code: 'mtn', libelle: 'MTN MoMo', pays: 'bj' },
  { code: 'moov', libelle: 'Moov Africa (Flooz)', pays: 'bj' },
  { code: 'mtn_ci', libelle: 'MTN MoMo', pays: 'ci' },
];

/**
 * Mode de test du bac à sable.
 *
 * `momo_test` n'est pas un opérateur mais un simulateur : la documentation
 * précise qu'il « ne dépend pas des serveurs de test des opérateurs ».
 * Envoyer `moov_tg` en sandbox sollicite l'infrastructure de test de Moov, qui
 * n'a aucune raison de répondre — c'est le piège dans lequel un premier essai
 * tombe systématiquement.
 *
 * Rattaché au Bénin parce que c'est le pays des numéros de test documentés.
 */
const TEST: DefinitionOperateur = {
  code: 'momo_test',
  libelle: 'Mode test (bac à sable)',
  pays: 'bj',
  aide: 'Numéros acceptés : 64000001 ou 66000001. Tout autre numéro simule un échec.',
};

/** Toutes les définitions connues, pour résoudre un code reçu du client. */
export const OPERATEURS: DefinitionOperateur[] = [TEST, ...REELS];

/**
 * Opérateurs proposables pour un pays et un environnement.
 *
 * En bac à sable, le simulateur passe **en premier** : c'est le seul chemin
 * qui aboutit réellement, et le laisser en second ferait échouer tous les
 * essais avant qu'on pense à le chercher.
 */
export function operateursDisponibles(
  codePays: string,
  environnement: string | undefined,
): DefinitionOperateur[] {
  const reels = REELS.filter((o) => o.pays === codePays);
  if (environnement === 'live') return reels;
  return TEST.pays === codePays ? [TEST, ...reels] : reels;
}
