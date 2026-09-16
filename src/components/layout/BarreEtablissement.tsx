import { socleComplet } from '@/services/configuration';
import { getSidebarItems } from '@/lib/navigation';
import type { Role } from '@/services/tenant';
import { BarreSection } from './BarreSection';

/**
 * La rangée d'écrans de la section « Établissement ».
 *
 * ## Pourquoi un composant de plus
 *
 * `BarreSection` est volontairement muette : elle reçoit une section, un rôle,
 * un écran courant, et rend une rangée. C'est ce qui la rend identique sur
 * Finances et sur Notes.
 *
 * Établissement a une règle que les deux autres n'ont pas : **« Configuration »
 * s'efface quand il n'y a plus rien à configurer**. Mettre cette lecture dans
 * `BarreSection` la rendrait asynchrone pour toutes les sections, donc
 * coûteuse là où elle n'a rien à lire. Elle vit donc ici, dans une enveloppe
 * qui ne sert qu'à cette section.
 *
 * ## Ce qu'elle remplace
 *
 * Neuf écrans portaient en tête un lien « Retour à la configuration », posé en
 * dur, sans condition. Une école entièrement configurée y était donc renvoyée
 * depuis chacun de ses écrans — et `/etablissement` ouvrant les classes, c'est
 * la première chose qu'elle voyait en entrant dans sa section. La checklist
 * n'était plus une étape franchie, elle était devenue le décor permanent de
 * l'établissement.
 *
 * Le lien de retour est remplacé par la rangée : elle dit où l'on est, ce qu'il
 * y a d'autre, et — tant que la configuration n'est pas finie — qu'il reste
 * quelque chose à régler.
 *
 * ## Le coût, et ce qu'il deviendra
 *
 * `socleComplet()` délègue à `etatSocle()`, mémoïsé par requête : une page qui
 * lit déjà le socle ne paie rien de plus, les autres paient un diagnostic. Ces
 * sondes sont des comptages parallèles — leur lenteur actuelle vient des
 * politiques RLS qui réévaluent `is_super_admin()` ligne à ligne, pas de leur
 * nombre. Voir le compte rendu du 2026-09-15.
 */
export async function BarreEtablissement({
  role,
  actif,
}: {
  role: Role;
  /** L'écran affiché, tel qu'il est déclaré dans `SECTIONS`. */
  actif: string;
}) {
  // **Seuls les rôles qui ont la section la voient.**
  //
  // `/abonnement` et `/rapports` appartiennent à Établissement, et la rangée
  // les suit désormais jusque-là : en venant de la section, on ne doit pas
  // perdre son repère parce que l'adresse vit à la racine. Mais le Comptable
  // les a au **premier niveau** de sa barre latérale et n'a pas de section
  // Établissement du tout — lui poser cette rangée lui inventerait une section
  // qu'il n'a pas, avec deux entrées, dont l'écran qu'il regarde déjà.
  //
  // Le test se fait sur sa barre latérale plutôt que sur une liste de rôles
  // écrite ici : le jour où un rôle gagne ou perd la section, la rangée suit
  // toute seule.
  //
  // Il est posé **avant** l'appel : `socleComplet()` est un diagnostic d'une
  // quinzaine de comptages, et le Comptable n'a aucune raison de le payer pour
  // un composant qui ne rendra rien.
  const aLaSection = getSidebarItems(role).some((item) => item.href === '/etablissement');
  if (!aLaSection) return null;

  const complet = await socleComplet();

  return (
    <BarreSection
      chemin="/etablissement"
      role={role}
      actif={actif}
      exclure={complet ? ['/etablissement/configuration'] : []}
    />
  );
}
