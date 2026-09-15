import { redirect } from 'next/navigation';

/**
 * « Finances » ouvre le suivi des paiements, pas un menu.
 *
 * Cette page était une grille de cinq blocs qui nommaient cinq écrans : le
 * Directeur cliquait « Finances » et n'avait toujours pas vu un chiffre. La
 * question qu'il pose en ouvrant ce domaine est « qui a payé, qui doit
 * encore » — c'est le suivi des paiements, et c'est aussi le plus consulté des
 * cinq.
 *
 * Les quatre autres ne disparaissent pas : `BarreSection` les porte en tête du
 * suivi, à un niveau visuel inférieur. Rien n'est retiré, tout est hiérarchisé.
 *
 * Le chemin reste déclaré dans `SECTIONS` et dans la barre latérale — c'est lui
 * que vise la navigation, et la redirection est transparente pour `BottomNav`
 * comme pour les `LienRetour` qui pointent ici.
 */
export default function FinancesPage() {
  redirect('/etablissement/finances/factures');
}
