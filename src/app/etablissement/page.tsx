import { redirect } from 'next/navigation';
import { getTenantContext } from '@/services/tenant';

/**
 * « Établissement » ouvre la configuration.
 *
 * C'était le mur de dix entrées — le cas exact que la note de vision décrit.
 * Or la question derrière ce clic n'est jamais « montre-moi les dix tables de
 * mon école » : c'est « qu'est-ce qu'il me reste à régler ». L'écran qui y
 * répond existe depuis le 2026-09-14, il était simplement rangé comme une
 * entrée parmi dix.
 *
 * Pour la Secrétaire et le Comptable, la configuration est fermée : ils
 * atterrissent sur les classes, la seule entrée de cette section qui leur soit
 * ouverte avec l'abonnement. Les rediriger vers un écran qu'ils ne peuvent pas
 * ouvrir serait la version polie du mur.
 *
 * Les dix entrées restent atteignables depuis la configuration, qui les liste
 * toutes en pied de page.
 */
export default async function EtablissementPage() {
  const ctx = await getTenantContext();
  if (ctx.role === 'DIRECTEUR' || ctx.role === 'SUPER_ADMIN') {
    redirect('/etablissement/configuration');
  }
  redirect('/etablissement/classes');
}
