import { getTenantContext } from '@/services/tenant';
import { getEtatFacturation } from '@/services/abonnement';
import { cyclesFactures } from '@/services/paiement-fedapay';
import { paiementEnLigneActif } from '@/services/activation-plateforme';
import { evaluerAcces } from '@/services/abonnement-acces';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { prixPourCycles, nomFormule } from '@/lib/abonnement-formule';
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

  const [etat, cycles] = await Promise.all([
    getEtatFacturation(ctx.etablissementId),
    // `cyclesFactures` et non `listCyclesActifs` : seuls les cycles encore au
    // catalogue sont facturables. Une école entrée avant le recentrage sur le
    // secondaire garde ses classes de primaire, mais on ne lui vend pas un
    // cycle qu'on ne propose plus.
    cyclesFactures(),
  ]);
  const abonnement = etat.abonnement;

  const acces = evaluerAcces(etat);

  // Le nombre de cycles est recalculé côté serveur au moment du paiement :
  // celui-ci n'est qu'un affichage, il ne fait pas foi.
  const nombreCycles = Math.max(cycles.length, 1);
  const formule = nomFormule(cycles);

  return (
    <AppLayout items={items} schoolName="ScolarGest" role={ctx.role} userName={ctx.email}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <LienRetour href="/abonnement" className="mb-3">Retour à mon abonnement</LienRetour>
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
          prixMensuel={prixPourCycles(nombreCycles, 'MOIS')}
          prixAnnuel={prixPourCycles(nombreCycles, 'AN')}
          nomFormule={formule}
          paiementEnLigne={paiementEnLigneActif()}
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
