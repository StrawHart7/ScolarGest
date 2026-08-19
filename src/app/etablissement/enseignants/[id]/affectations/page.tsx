import Link from 'next/link';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getEnseignant } from '@/services/enseignant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listMatieres } from '@/services/matiere';
import { listAffectationsEnseignant } from '@/services/affectation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { AffectationForm, SupprimerAffectationButton } from './AffectationForm';
import { supprimerAffectationAction } from './actions';

export default async function AffectationsEnseignantPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const enseignant = await getEnseignant(params.id);
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
        <Link
          href={`/etablissement/enseignants/${enseignant.id}`}
          className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la fiche enseignant
        </Link>

        <div>
          <h1 className="text-display-sm text-text-primary">
            Affectations — {enseignant.nom} {enseignant.prenoms}
          </h1>
          <p className="text-body-sm text-text-secondary" data-mono>
            Matricule : {enseignant.matricule}
          </p>
        </div>

        {!anneeActive ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <ClipboardList className="h-8 w-8 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">
                Aucune année scolaire active. Activez une année scolaire avant de créer des affectations.
              </p>
            </CardContent>
          </Card>
        ) : (
          <AffectationsEnseignantContent
            enseignantId={enseignant.id}
            anneeScolaireId={anneeActive.id}
          />
        )}
      </div>
    </AppLayout>
  );
}

async function AffectationsEnseignantContent({
  enseignantId,
  anneeScolaireId,
}: {
  enseignantId: string;
  anneeScolaireId: string;
}) {
  const [classes, matieres, affectations] = await Promise.all([
    listClasses(anneeScolaireId),
    listMatieres(),
    listAffectationsEnseignant(enseignantId, anneeScolaireId),
  ]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle affectation</CardTitle>
        </CardHeader>
        <CardContent>
          <AffectationForm
            enseignantId={enseignantId}
            anneeScolaireId={anneeScolaireId}
            classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
            matieres={matieres.map((m) => ({ id: m.id, nom: m.nom }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Affectations en cours</CardTitle>
        </CardHeader>
        {affectations.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <ClipboardList className="h-8 w-8 text-text-secondary/50" aria-hidden />
            <p className="text-body-sm text-text-secondary">Aucune affectation pour cette année scolaire.</p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classe</TableHead>
                <TableHead>Matière</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affectations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.classe.nom}</TableCell>
                  <TableCell>{a.matiere.nom}</TableCell>
                  <TableCell>
                    <SupprimerAffectationButton
                      enseignantId={enseignantId}
                      affectationId={a.id}
                      action={supprimerAffectationAction}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
