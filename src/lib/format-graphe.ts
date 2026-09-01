/**
 * Formats de valeurs pour les graphes, designes par un **nom** et non par une
 * fonction.
 *
 * Une fonction ne traverse pas la frontiere serveur/client : passer
 * `formater={fcfa}` depuis un composant serveur a un composant client leve a
 * l'execution (« Functions cannot be passed directly to Client Components »).
 * Le build ne l'attrape pas sur une page rendue a la demande — c'est ce qui a
 * fait tomber tout le tableau de bord.
 *
 * On passe donc un nom, serialisable, et le client resout la fonction.
 */

export type FormatValeur = 'fcfa' | 'nombre';

export function formaterValeur(valeur: number, format: FormatValeur): string {
  if (format === 'fcfa') return `${Number(valeur).toLocaleString('fr-FR')} F`;
  return valeur.toLocaleString('fr-FR');
}
