/**
 * Opérateurs Mobile Money proposés au paiement.
 *
 * Module distinct de `client.ts`, qui est `server-only` et charge le SDK
 * FedaPay : une page qui a seulement besoin de la liste des opérateurs n'a
 * aucune raison d'embarquer axios et la configuration des clés.
 *
 * La liste est volontairement courte. L'API de paiement mobile direct de
 * FedaPay ne documente que `mtn`, `moov`, `mtn_ci` et `moov_tg` — au Togo,
 * cela signifie **Moov (Flooz), pas T-Money**. Une école qui n'a que du
 * T-Money doit passer par la page hébergée ou par le virement, d'où le second
 * moyen de paiement proposé à l'écran.
 */

export type Operateur = 'moov_tg' | 'mtn' | 'moov' | 'mtn_ci';

export const OPERATEURS: { code: Operateur; libelle: string; pays: string }[] = [
  { code: 'moov_tg', libelle: 'Moov Africa Togo (Flooz)', pays: 'tg' },
];
