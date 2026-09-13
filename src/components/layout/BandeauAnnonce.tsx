import { GraduationCap, Megaphone, Wrench } from 'lucide-react';
import { listAnnoncesEnCours } from '@/services/annonce';
import type { TypeAnnonce } from '@/lib/annonce';

/**
 * Les annonces de la plateforme aux écoles, en haut de l'espace applicatif.
 *
 * Posé dans le layout et non sur une page : une annonce qu'il faudrait aller
 * chercher n'est pas une annonce. Même raisonnement que `AbonnementBanner`,
 * juste au-dessus, et même forme — dans le flux, avec une bordure basse, jamais
 * en `fixed`. Un bandeau flottant recouvrirait l'en-tête au moment précis où
 * l'on voudrait s'en servir.
 *
 * ## Pas de bouton pour fermer, et c'est une décision
 *
 * Le réflexe serait d'en ajouter un, avec un `localStorage` pour s'en souvenir.
 * Trois raisons de s'en passer :
 *
 * - **L'annonce se ferme toute seule.** Elle porte une fenêtre (`debuteLe`,
 *   `finitLe`) décidée par la Régie, qui peut la raccourcir à tout moment. Le
 *   mécanisme de fermeture existe déjà, du bon côté.
 * - **C'est le motif du produit.** Ni `AbonnementBanner` ni `RappelFinEssai` ne
 *   se ferment. Introduire ici un troisième comportement pour un objet de même
 *   nature rendrait la bande d'écran illisible.
 * - **Une mémoire par navigateur ment.** Fermé sur le téléphone, l'annonce
 *   reviendrait sur le poste de la Secrétaire, et l'école conclurait que le
 *   bouton ne marche pas.
 *
 * Si une annonce s'avère trop longue à l'usage, la réponse est de raccourcir
 * sa fenêtre depuis la Régie — pas d'apprendre aux écoles à la faire
 * disparaître.
 *
 * N'échoue jamais bruyamment : un bandeau manquant est moins grave qu'une
 * application inaccessible.
 */

const PRESENTATION: Record<
  TypeAnnonce,
  { cadre: string; texte: string; icone: typeof Megaphone; teinte: string }
> = {
  // Une session d'examen est une échéance institutionnelle, pas une alerte :
  // elle se dit dans le ton du produit, pas dans celui d'une panne.
  EXAMEN_NATIONAL: {
    cadre: 'border-primary-container/20 bg-primary-fixed/40',
    texte: 'text-primary-container',
    teinte: 'text-primary-container',
    icone: GraduationCap,
  },
  ANNONCE: {
    cadre: 'border-surface-border bg-surface-container-lowest',
    texte: 'text-text-primary',
    teinte: 'text-text-secondary',
    icone: Megaphone,
  },
  // `warning` et non `error` : une interruption annoncée n'est la faute de
  // personne, et le rouge inquiéterait sans rien proposer. Voir la règle
  // « une couleur d'alarme ne dit pas un état subi » dans `CLAUDE.md`.
  MAINTENANCE: {
    cadre: 'border-warning/30 bg-warning/10',
    texte: 'text-warning-on-container',
    teinte: 'text-warning-on-container',
    icone: Wrench,
  },
};

export async function BandeauAnnonce() {
  let annonces;
  try {
    annonces = await listAnnoncesEnCours();
  } catch {
    return null;
  }

  if (annonces.length === 0) return null;

  return (
    <>
      {annonces.map((annonce) => {
        const presentation = PRESENTATION[annonce.type] ?? PRESENTATION.ANNONCE;
        const Icone = presentation.icone;
        return (
          // `data-bandeau` est lu par `PanneauConseil`, dont la bannière mobile
          // se pose en `fixed` sous l'en-tête et recouvrirait ceci. Une
          // information venue de la plateforme prime sur une suggestion.
          // Ne pas retirer ce repère sans corriger `PanneauConseil`.
          <div
            key={annonce.id}
            role="status"
            data-bandeau="annonce"
            className={`flex flex-wrap items-start gap-x-4 gap-y-1 border-b px-container-pad py-3 ${presentation.cadre}`}
          >
            <Icone className={`mt-0.5 h-5 w-5 shrink-0 ${presentation.teinte}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className={`text-body-sm font-medium ${presentation.texte}`}>{annonce.titre}</p>
              <p className="text-body-sm text-text-secondary">{annonce.message}</p>
            </div>
          </div>
        );
      })}
    </>
  );
}
