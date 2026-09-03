import { getAccesAbonnementCourant } from '@/services/abonnement';
import { getTenantContext } from '@/services/tenant';
import { cyclesFactures } from '@/services/paiement-fedapay';
import { formulesPour } from '@/lib/abonnement-formule';
import { ModaleFinEssai } from './ModaleFinEssai';

/**
 * Rappel des tarifs dans les derniers jours de l'essai.
 *
 * Le bandeau seul ne suffit pas : il se lit une fois puis devient du décor.
 * Aux trois derniers paliers (7, 3 et 1 jour), l'école revoit sa formule et
 * son prix, une fois par jour, à sa première page. C'est le moment où la
 * décision se prend, et le seul où insister se justifie.
 *
 * **Refermable, et sans piège.** Le refus est mémorisé pour la journée, pas
 * définitivement : refermer le rappel de J-7 ne fait pas sauter celui de J-1.
 * Une école qui a déjà souscrit ne le voit jamais — le niveau d'accès passe
 * alors à OK ou AVERTISSEMENT, plus à ESSAI.
 *
 * N'échoue jamais bruyamment : un rappel commercial manquant est sans
 * conséquence, une application inaccessible ne l'est pas.
 */
export async function RappelFinEssai() {
  try {
    const acces = await getAccesAbonnementCourant();
    if (acces.niveau !== 'ESSAI') return null;
    if (acces.joursRestants === null || acces.joursRestants > 7) return null;

    // Souscrire engage une dépense : même périmètre que la page de paiement.
    // Montrer un rappel de règlement à une Secrétaire la met en position de
    // relayer un message qu'elle ne peut pas traiter.
    const { role } = await getTenantContext();
    if (role !== 'DIRECTEUR' && role !== 'COMPTABLE') return null;

    // Lu seulement dans la fenêtre des sept derniers jours : sur toutes les
    // autres pages de l'application, cette requête n'a pas lieu.
    const formules = formulesPour(await cyclesFactures());

    return <ModaleFinEssai joursRestants={acces.joursRestants} formules={formules} />;
  } catch {
    return null;
  }
}
