import { annoncesDuRendu } from './annonces-du-rendu';
import { CarteAnnonce } from './CarteAnnonce';

/**
 * Les annonces de la plateforme, **rendu du téléphone**.
 *
 * À partir de `md`, l'annonce vit dans la barre latérale (`AnnoncesSidebar`) :
 * elle y reste sous les yeux pendant toute sa fenêtre sans se mettre en travers
 * du travail. Sous `md`, il n'y a pas de barre latérale — la barre basse
 * d'onglets la remplace, et elle n'a de place pour rien d'autre. Le bandeau
 * dans le flux reste donc le seul rendu possible du téléphone.
 *
 * Ce n'est pas une duplication : ce sont deux endroits différents pour deux
 * formes d'écran différentes, nourris par la même lecture (`annoncesDuRendu`,
 * mémoïsée par requête).
 *
 * ## Pas de bouton pour fermer, et c'est une décision
 *
 * Le réflexe serait d'en ajouter un, avec un `localStorage` pour s'en souvenir.
 * Trois raisons de s'en passer :
 *
 * - **L'annonce se ferme toute seule.** Elle porte une fenêtre (`debuteLe`,
 *   `finitLe`) décidée par la Régie, qui peut la raccourcir à tout moment. Le
 *   mécanisme de fermeture existe déjà, du bon côté. La date de fin est
 *   d'ailleurs écrite sur la carte, pour que ça se voie.
 * - **C'est le motif du produit.** Ni `AbonnementBanner` ni `RappelFinEssai` ne
 *   se ferment. Introduire ici un troisième comportement pour un objet de même
 *   nature rendrait la bande d'écran illisible.
 * - **Une mémoire par navigateur ment.** Fermé sur le téléphone, l'annonce
 *   reviendrait sur le poste de la Secrétaire, et l'école conclurait que le
 *   bouton ne marche pas.
 *
 * N'échoue jamais bruyamment : un bandeau manquant est moins grave qu'une
 * application inaccessible.
 */
export async function BandeauAnnonce() {
  const annonces = await annoncesDuRendu();
  if (annonces.length === 0) return null;

  return (
    // `data-bandeau` est lu par `PanneauConseil`, dont la bannière mobile se
    // pose en `fixed` sous l'en-tête et recouvrirait ceci. Une information
    // venue de la plateforme prime sur une suggestion.
    //
    // Le repère est posé **ici** et pas sur la carte de la barre latérale,
    // délibérément : la garde de `PanneauConseil` ne vaut que sous 768px, et
    // marquer un élément que le téléphone ne montre jamais ferait taire la
    // bannière de conseil au profit d'une annonce invisible. Ne pas déplacer
    // cet attribut sans relire `PanneauConseil`.
    //
    // Ne rien rendre quand la liste est vide relève du même soin : un
    // conteneur vide mais présent suffirait à faire taire le conseil.
    <div role="status" data-bandeau="annonce" className="md:hidden">
      <CarteAnnonce annonces={annonces} variante="bandeau" />
    </div>
  );
}
