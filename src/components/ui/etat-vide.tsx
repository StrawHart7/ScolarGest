import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Ce qu'un écran dit quand il n'a rien à montrer.
 *
 * ## Pourquoi un composant
 *
 * Vingt-cinq écrans constataient sans proposer : « Aucune classe pour cette
 * année. », « Aucun tarif défini. », « Aucune matière créée. » Pas un bouton,
 * pas un chemin. C'est pourtant l'écran sur lequel un débutant atterrit le plus
 * souvent — une école neuve n'a rien, donc tout est vide.
 *
 * Deux écrans faisaient exception et montraient la bonne forme. Le motif
 * existait, il n'était appliqué nulle part ailleurs : c'est exactement le genre
 * d'écart qu'un composant supprime et qu'une consigne ne supprime pas.
 *
 * ## Trois règles
 *
 * **L'état vide porte le geste, il ne le nomme pas.** « Créez une classe avant
 * d'inscrire un élève » demande de retrouver l'écran des classes tout seul.
 * `action` reçoit le déclencheur réel — le plus souvent celui que la page a
 * déjà dans sa barre d'outils, `<MatiereForm />` ou un bouton-lien. On ne
 * reconstruit pas un second chemin de création à côté du premier.
 *
 * **Il distingue « rien » de « rien qui corresponde ».** Une école sans élève
 * et une recherche infructueuse ne se réparent pas du même geste. `filtre`
 * masque l'action : on ne propose pas de créer un élève à quelqu'un qui en
 * cherchait un précis.
 *
 * **Ce n'est jamais une erreur.** Ni rouge, ni `error`. Une école qui n'a pas
 * encore de tarifs n'a rien cassé — c'est l'état normal d'une école de trois
 * jours. Même raison que pour la bannière hors-ligne.
 *
 * ## Mobile
 *
 * Tout est centré et en colonne : la forme est la même à toutes les largeurs,
 * il n'y a rien à réarranger sous `md`. `py-14` plutôt que `py-16` — sur un
 * écran de 844px de haut, seize unités de vide poussaient l'action sous la
 * ligne de flottaison quand une barre d'outils la précédait.
 */
export function EtatVide({
  icone: Icone,
  titre,
  explication,
  action,
  filtre = false,
}: {
  icone: LucideIcon;
  /** Ce qui manque, dit simplement. Pas « Aucun X trouvé » quand on n'a pas cherché. */
  titre: string;
  /** Pourquoi ça compte, ou ce qui se débloque ensuite. Facultatif quand c'est évident. */
  explication?: string;
  /** Le geste qui remplit l'écran. Absent quand il n'y a rien à faire — une file vide est une bonne nouvelle. */
  action?: ReactNode;
  /** Vrai quand le vide vient d'une recherche ou d'un filtre, pas de l'absence de données. */
  filtre?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center md:py-14">
      <Icone className="h-10 w-10 text-text-secondary/50" aria-hidden />
      <p className="text-body-md text-text-primary">{titre}</p>
      {explication ? (
        <p className="max-w-prose text-body-sm text-text-secondary">{explication}</p>
      ) : null}
      {action && !filtre ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
