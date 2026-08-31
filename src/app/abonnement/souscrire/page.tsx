import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getAbonnementCourant, getEssaiFinLe } from '@/services/abonnement';
import { listCyclesActifs } from '@/services/structure';
import { evaluerAcces } from '@/services/abonnement-acces';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { PRIX_MENSUEL_PAR_CYCLE, PRIX_ANNUEL_PAR_CYCLE } from '@/lib/tarifs';
import { operateursDisponibles } from '@/lib/fedapay/operateurs';
import { PAYS_FEDAPAY } from '@/lib/fedapay/pays';
import { FormulaireSouscription } from './FormulaireSouscription';

export const metadata = { title: 'Souscrire' };

/**
 * Page de paiement.
 *
 * Elle vit sous `/abonnement/` et ce n'est pas un détail de rangement :
 * `PATHS_TOUJOURS_ACCESSIBLES` (`src/lib/supabase/middleware.ts`) y laisse
 * passer les écritures même quand l'accès est en lecture seule. Ailleurs, la
 * Server Action de paiement serait refusée par la garde d'abonnement — le
 * paywall bloquerait exactement les écoles venues payer.
 *
 * Réservée au Directeur et au Comptable : engager une dépense n'est pas un
 * geste de secrétariat.
 */
export default async function SouscrirePage() {
  const ctx = await getTenantContext();
  const items = getSidebarItems(ctx.role);

  if (ctx.role !== 'DIRECTEUR' && ctx.role !== 'COMPTABLE') {
    return (
      <AppLayout items={items} schoolName="ScolarGest" role={ctx.role} userName={ctx.email}>
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-body-sm text-text-secondary">
              Seuls le Directeur et le Comptable peuvent souscrire un abonnement.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const [abonnement, essaiFinLe, cyclesActifs] = await Promise.all([
    getAbonnementCourant(ctx.etablissementId),
    getEssaiFinLe(ctx.etablissementId),
    listCyclesActifs(),
  ]);

  const acces = evaluerAcces({
    abonnement: abonnement ? { statut: abonnement.statut, dateFin: abonnement.dateFin } : null,
    essaiFinLe,
  });

  // Le nombre de cycles est calculé de nouveau côté serveur au moment du
  // paiement : celui-ci n'est qu'un affichage, il ne fait pas foi.
  const nombreCycles = Math.max(cyclesActifs.length, 1);

  return (
    <AppLayout items={items} schoolName="ScolarGest" role={ctx.role} userName={ctx.email}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href="/abonnement"
            className="mb-3 inline-flex items-center gap-1.5 text-body-sm text-text-secondary transition-colors hover:text-primary-container"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Retour à mon abonnement
          </Link>
          <h1 className="text-display-sm text-text-primary">
            {abonnement ? 'Renouveler mon abonnement' : 'Activer mon abonnement'}
          </h1>
          <p className="mt-1 text-body-md text-text-secondary">
            {acces.niveau === 'ESSAI' && acces.joursRestants !== null
              ? `Il vous reste ${acces.joursRestants} jour${acces.joursRestants > 1 ? 's' : ''} d’essai. Souscrire maintenant ne les fait pas perdre : la période payée démarre à la fin de l’essai en cours.`
              : acces.niveau === 'LECTURE_SEULE'
                ? 'Votre espace est en lecture seule. Vos données sont intactes et redeviennent modifiables dès le règlement.'
                : 'Réglez votre abonnement en Mobile Money, sans quitter ScolarGest.'}
          </p>
        </div>

        <FormulaireSouscription
          prixMensuel={PRIX_MENSUEL_PAR_CYCLE * nombreCycles}
          prixAnnuel={PRIX_ANNUEL_PAR_CYCLE * nombreCycles}
          nombreCycles={nombreCycles}
          // `FEDAPAY_ENVIRONMENT` n'a pas de préfixe NEXT_PUBLIC_ : elle n'est
          // lisible que côté serveur, d'où la résolution ici plutôt que dans le
          // composant client. On envoie les opérateurs de tous les pays, le
          // formulaire filtrant selon celui qui est choisi — un aller-retour
          // serveur à chaque changement de pays serait absurde pour une liste
          // de quatre entrées.
          operateurs={PAYS_FEDAPAY.flatMap((p) =>
            operateursDisponibles(p.code, process.env.FEDAPAY_ENVIRONMENT).map((o) => ({
              code: o.code,
              libelle: o.libelle,
              pays: o.pays,
              aide: o.aide ?? null,
            })),
          )}
          pays={PAYS_FEDAPAY.map((p) => ({
            code: p.code,
            nom: p.nom,
            indicatif: p.indicatif,
            exemple: p.exemple,
          }))}
          renouvellement={Boolean(abonnement)}
        />
      </div>
    </AppLayout>
  );
}
