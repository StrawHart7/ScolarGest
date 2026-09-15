import Link from 'next/link';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { EleveForm } from './EleveForm';

export default async function NouvelElevePage() {
  const ctx = await getTenantContext();
  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const classes = anneeActive ? await listClasses(anneeActive.id) : [];

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <LienRetour href="/etablissement/eleves">Retour aux élèves</LienRetour>

        {/* « Nouveau profil élève » et « dossier élève » nomment la fiche, pas
            le geste. Le Directeur, lui, dit « j'inscris un enfant ». */}
        <div>
          <h1 className="text-display-sm text-text-primary">Inscrire un élève</h1>
          <p className="text-body-sm text-text-secondary">
            Sa classe, son identité et ses responsables — puis sa facture est créée toute seule.
          </p>
        </div>

        {!anneeActive ? (
          // Ton neutre : le Directeur n'a rien cassé, il n'a pas encore ouvert
          // son année. Et l'écran porte le geste au lieu de le nommer.
          <Card>
            <CardContent className="flex flex-col items-start gap-3 p-6">
              <p className="text-body-md text-text-primary">Aucune année scolaire n’est ouverte</p>
              <p className="text-body-sm text-text-secondary">
                Le matricule d’un élève est numéroté par année : il en faut une avant d’inscrire.
              </p>
              <Button asChild variant="primary">
                <Link href="/etablissement/annees-scolaires">Ouvrir une année scolaire</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Inscription</CardTitle>
            </CardHeader>
            <CardContent>
              <EleveForm anneeScolaireId={anneeActive.id} classes={classes} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
