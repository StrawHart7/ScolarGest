import Link from 'next/link';
import { Clock } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getAbonnementCourant, getEssaiFinLe } from '@/services/abonnement';
import { evaluerAcces } from '@/services/abonnement-acces';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSidebarItems } from '@/lib/navigation';

export const metadata = { title: 'Retour de paiement' };

/**
 * Page d'arrivée après un paiement (`callback_url` de FedaPay).
 *
 * Elle **n'active rien** et ne doit rien activer. Le webhook signé est la
 * seule source de vérité : cette page est atteinte par une redirection de
 * navigateur, que n'importe qui peut fabriquer en tapant l'URL. Y ouvrir un
 * abonnement offrirait le produit à qui connaît l'adresse.
 *
 * Elle se contente donc de relire l'état réel et de le raconter. Le décalage
 * est normal — quelques secondes entre la confirmation sur le combiné et la
 * livraison du webhook — d'où un message d'attente plutôt qu'un échec quand
 * l'abonnement n'est pas encore là.
 */
export default async function RetourPaiementPage() {
  const ctx = await getTenantContext();
  const [abonnement, essaiFinLe] = await Promise.all([
    getAbonnementCourant(ctx.etablissementId),
    getEssaiFinLe(ctx.etablissementId),
  ]);

  const acces = evaluerAcces({
    abonnement: abonnement ? { statut: abonnement.statut, dateFin: abonnement.dateFin } : null,
    essaiFinLe,
  });
  const actif = acces.niveau === 'OK' || acces.niveau === 'AVERTISSEMENT';

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            {actif ? (
              <>
                <h1 className="text-display-sm text-text-primary">Votre abonnement est actif</h1>
                <p className="max-w-md text-body-md text-text-secondary">
                  Le règlement a bien été enregistré. Votre espace est de nouveau pleinement
                  modifiable
                  {abonnement
                    ? `, jusqu’au ${new Date(abonnement.dateFin).toLocaleDateString('fr-FR')}.`
                    : '.'}
                </p>
                <Button asChild>
                  <Link href="/dashboard">Retour au tableau de bord</Link>
                </Button>
              </>
            ) : (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container">
                  <Clock className="h-7 w-7 text-text-secondary" aria-hidden />
                </span>
                <h1 className="text-display-sm text-text-primary">Paiement en cours de contrôle</h1>
                <p className="max-w-md text-body-md text-text-secondary">
                  Nous n’avons pas encore reçu la confirmation de votre opérateur. Cela prend
                  généralement quelques secondes. Votre abonnement s’activera automatiquement, sans
                  que vous ayez à repayer.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button asChild>
                    <Link href="/abonnement">Voir l’état de mon abonnement</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/dashboard">Tableau de bord</Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
