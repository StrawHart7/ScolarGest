import type { NomSonde } from './conseils/catalogue';

/**
 * Ce qu'un domaine exige pour fonctionner, et le remède quand ça manque.
 *
 * ## Pourquoi un verrou par domaine, et non un blocage de la plateforme
 *
 * L'option envisagée était d'enfermer le Directeur dans la configuration
 * jusqu'à ce que tout soit fait. Elle a été écartée pour une raison précise :
 * trois des étapes ne dépendent pas de lui. Inviter les enseignants exige leurs
 * adresses email — et Supabase refuse les adresses non délivrables, le SMTP par
 * défaut est fortement limité en débit. Inscrire trois cents élèves exige un
 * fichier qui est souvent resté à l'école. Fixer les tarifs est, dans certaines
 * écoles, une décision du conseil.
 *
 * Un verrou global se serait donc refermé sur des gens et des documents qu'il
 * n'a pas sous la main, pendant que son essai de trente jours brûle. Ce n'est
 * pas un risque d'abandon, c'en est la recette.
 *
 * Le verrou par domaine dit l'inverse : « voilà ce qui manque pour faire
 * **ça**, précisément », à l'instant où il essaie de le faire, avec le fichier
 * ou l'information sous les yeux. Il garde la main sur l'ordre — facturer
 * aujourd'hui, les emplois du temps la semaine prochaine — il ne peut
 * simplement pas se servir d'une chose qu'il n'a pas configurée.
 *
 * ## Le verrou remplace l'écran vide, il ne s'y ajoute pas
 *
 * C'est tout le point. Le défaut constaté le 2026-09-14 était une page de
 * tarifs sans le moindre bouton et sans un mot d'explication : le testeur en a
 * conclu que le produit était cassé. Un panneau qui dit ce qui manque **et
 * porte le lien qui le répare** est moins de produit à l'écran, pas plus.
 *
 * ## Ce module ne dépend de rien
 *
 * Il est lu par un composant client autant que par le service. Importer
 * `src/services/` ici ferait entrer `next/headers` dans un bundle client —
 * la panne du 2026-09-02, que `tsc` accepte et qu'ESLint ignore.
 */

export type Domaine = 'FINANCES' | 'NOTES';

export interface Prerequis {
  /** La sonde du diagnostic qui dit si c'est fait. Un seul vocabulaire pour les trois surfaces. */
  sonde: NomSonde;
  /** Ce qui manque, nommé comme l'utilisateur le nomme. */
  titre: string;
  /** La conséquence, pas la cause : ce qu'il ne peut pas faire tant que ça manque. */
  pourquoi: string;
  /** Le libellé du bouton. Un verbe, à la première personne. */
  action: string;
  /** L'écran réel qui le répare. Jamais un formulaire de substitution. */
  href: string;
}

export const TITRES_DOMAINE: Record<Domaine, string> = {
  FINANCES: 'Les finances ne sont pas encore configurées',
  NOTES: 'Les notes ne sont pas encore configurées',
};

/**
 * L'ordre compte : c'est celui dans lequel il faut s'y prendre.
 *
 * Un tarif se rattache à un type de frais ; une affectation se rattache à un
 * enseignant. Présenter l'inverse enverrait l'utilisateur sur un écran où il ne
 * pourrait rien choisir.
 */
export const PREREQUIS: Record<Domaine, Prerequis[]> = {
  FINANCES: [
    {
      sonde: 'typesFrais',
      titre: 'Vos types de frais',
      pourquoi:
        'Scolarité, inscription, cantine — ce que votre école facture. Une facture se compose de ces lignes.',
      action: 'Déclarer mes frais',
      href: '/etablissement/finances/types-frais',
    },
    {
      sonde: 'tarifs',
      titre: 'Vos tarifs',
      pourquoi:
        'Le montant de chaque frais, par classe et pour cette année scolaire. Sans eux, une facture serait émise à zéro franc.',
      action: 'Fixer mes tarifs',
      href: '/etablissement/finances/tarifs',
    },
  ],
  NOTES: [
    {
      sonde: 'enseignants',
      titre: 'Vos enseignants',
      pourquoi: 'Ce sont eux qui saisissent les notes de leurs matières.',
      action: 'Ajouter mes enseignants',
      href: '/etablissement/enseignants',
    },
    {
      sonde: 'affectations',
      titre: 'Leurs affectations',
      pourquoi:
        'Quel enseignant pour quelle matière, dans quelle classe. Un enseignant sans affectation ne peut ouvrir aucune évaluation.',
      action: 'Affecter mes enseignants',
      href: '/etablissement/classes',
    },
  ],
};
