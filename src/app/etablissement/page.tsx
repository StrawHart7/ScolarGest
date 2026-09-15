import { redirect } from 'next/navigation';
import { getTenantContext } from '@/services/tenant';
import { etatSocle } from '@/services/configuration';

/**
 * « Établissement » ouvre un écran, pas un menu — comme « Finances » ouvre le
 * suivi des paiements et « Notes » la saisie ou les résultats.
 *
 * C'était un mur de dix entrées, le cas exact que décrit la note de vision. La
 * question derrière ce clic n'est jamais « montre-moi les dix tables de mon
 * école ».
 *
 * ## Mais laquelle dépend du moment
 *
 * Tant que la configuration n'est pas finie, la question est « qu'est-ce qu'il
 * me reste à régler » : la checklist.
 *
 * **Une fois tout coché, ce n'est plus la question**, et c'est le défaut
 * constaté en preview le 2026-09-15 : le directeur avait tout fait, y compris
 * le facultatif, et retombait malgré tout sur une liste de cases cochées
 * surmontée d'un bandeau « votre établissement est configuré ». La section
 * Établissement ne redevenait jamais la section Établissement. Elle s'ouvre
 * alors sur **les classes**, le seul écran de la section qu'on regarde toutes
 * les semaines — les cycles, le programme ou le filigrane se règlent une fois
 * l'an.
 *
 * Pour la Secrétaire et le Comptable, la configuration est fermée : ils vont
 * directement aux classes. Les envoyer sur un écran qu'ils ne peuvent pas
 * ouvrir serait la version polie du mur.
 *
 * `etatSocle` ne compte que les entrées **requises** : ne pas avoir posé de
 * filigrane ne doit pas retenir quelqu'un sur la checklist indéfiniment.
 * Et il ne lève pas la page en cas d'erreur de lecture — on préfère montrer
 * les classes qu'un écran d'erreur à l'entrée de la section.
 */
export default async function EtablissementPage() {
  const ctx = await getTenantContext();
  if (ctx.role === 'DIRECTEUR' || ctx.role === 'SUPER_ADMIN') {
    try {
      const socle = await etatSocle();
      if (!socle.complet) redirect('/etablissement/configuration');
    } catch (e) {
      // `redirect()` lève par conception : la relancer telle quelle, sinon la
      // redirection ci-dessus serait avalée par ce `catch` et n'aurait jamais
      // lieu. Piège classique de Next, et silencieux.
      if (e && typeof e === 'object' && 'digest' in e) throw e;
    }
  }
  redirect('/etablissement/classes');
}
