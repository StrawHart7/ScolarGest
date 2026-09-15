import { getTenantContext } from '@/services/tenant';
import { peutEcrire } from '@/services/abonnement';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarreSection } from '@/components/layout/BarreSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { ImportPaiementsForm } from './ImportForm';
import { etatDomaine } from '@/services/configuration';
import { PageVerrouillee } from '@/components/configuration/PageVerrouillee';

export default async function ImportPaiementsPage() {
  const ctx = await getTenantContext();

  // Le verrou avant les lectures : afficher une liste vide sans dire
  // pourquoi est le defaut qu'on repare, et les requetes qui la
  // remplissent n'ont rien a ramener tant que la section n'est pas prete.
  const verrou = await etatDomaine('FINANCES');
  if (!verrou.ouvert) {
    return (
      <PageVerrouillee
        domaine="FINANCES"
        titre="Import de versements"
        retour={{ href: '/dashboard', libelle: 'Retour au tableau de bord' }}
        manques={verrou.manques}
      />
    );
  }
  const canWrite =
    (ctx.role === 'DIRECTEUR' ||
      ctx.role === 'SECRETAIRE' ||
      ctx.role === 'COMPTABLE' ||
      ctx.role === 'SUPER_ADMIN') &&
    (await peutEcrire());
  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <BarreSection chemin="/etablissement/finances" role={ctx.role} actif="/etablissement/finances/import" />

        <div>
          <h1 className="text-display-sm text-text-primary">
            Import Excel — historique financier
          </h1>
          <p className="text-body-sm text-text-secondary">
            {anneeActive ? `Année cible : ${anneeActive.libelle}` : 'Aucune année active'}
          </p>
        </div>

        {!canWrite ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-text-secondary">
                L&apos;import de versements est réservé au Comptable et au Directeur.
              </p>
            </CardContent>
          </Card>
        ) : !anneeActive ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-text-secondary">
                Aucune année scolaire n&apos;est ouverte. Un import se rattache à une année :
                il en faut une active.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Fichier à importer</CardTitle>
            </CardHeader>
            <CardContent>
              <ImportPaiementsForm anneeScolaireId={anneeActive.id} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
