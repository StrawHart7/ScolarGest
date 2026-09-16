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
 * Établissement a une règle de rôle que les deux autres n'ont pas — voir le
 * commentaire dans le corps. Elle vit ici, dans une enveloppe qui ne sert qu'à
 * cette section.
 *
 * ## « Configuration » ne disparaît plus
 *
 * Elle s'effaçait de la rangée dès que les neuf réglages indispensables étaient
 * faits. Décision de l'utilisateur, revue le 2026-09-16 : **elle y reste en
 * permanence, comme les autres entrées.** Deux raisons, et la seconde est la
 * vraie.
 *
 * Une entrée qui va et vient se cherche. On apprend une rangée par sa forme,
 * et une forme qui change selon un état invisible oblige à relire à chaque
 * visite.
 *
 * Surtout, l'écran devient autre chose une fois tout réglé : la page où l'on
 * apprend ce que la plateforme sait faire de neuf. Cacher le seul chemin qui y
 * mène le jour où il n'y a plus rien à régler, c'est le fermer précisément
 * quand il commence à servir.
 *
 * Bénéfice de bord : `socleComplet()` disparaît avec l'exclusion, et avec elle
 * un diagnostic d'une quinzaine de comptages payé à l'ouverture de **chacun**
 * des huit écrans de la section.
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
 */
export function BarreEtablissement({
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
  const aLaSection = getSidebarItems(role).some((item) => item.href === '/etablissement');
  if (!aLaSection) return null;

  return <BarreSection chemin="/etablissement" role={role} actif={actif} />;
}
