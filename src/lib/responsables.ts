import type { TypeResponsable } from '@/services/eleve';

/**
 * Le lien de parenté se déduit du type. Il ne se demande plus.
 *
 * Le formulaire d'inscription posait **deux** questions pour une seule idée :
 * un menu « Type » — Père, Mère, Tuteur, Autre — puis un champ libre « Lien de
 * parenté », qu'on remplissait avec « Père ». Deux champs, la même réponse, et
 * une ligne de plus dans un formulaire déjà long.
 *
 * La colonne `eleve_responsable."lienParente"` est `not null` depuis `0001` et
 * **reste** : elle porte l'historique de toutes les fiches déjà saisies, et les
 * écrans la lisent. Elle est simplement remplie à partir du type.
 *
 * `AUTRE` est le seul cas où le type ne dit rien de précis. On écrit « Autre »
 * plutôt qu'une chaîne vide : la fiche d'un élève affiche cette valeur, et un
 * tiret à cet endroit se lit comme une donnée perdue.
 *
 * Module sans dépendance — seul un `import type`, effacé à la compilation —
 * pour rester chargeable depuis les formulaires, qui sont des composants
 * clients.
 */
export const LIEN_PARENTE_PAR_TYPE: Record<TypeResponsable, string> = {
  PERE: 'Père',
  MERE: 'Mère',
  TUTEUR: 'Tuteur',
  AUTRE: 'Autre',
};

export function lienParenteDepuisType(type: TypeResponsable | string | undefined): string {
  return LIEN_PARENTE_PAR_TYPE[(type ?? 'AUTRE') as TypeResponsable] ?? 'Autre';
}
