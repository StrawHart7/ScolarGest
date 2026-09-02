import { ClipboardList } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getClasse } from '@/services/classe';
import { listEnseignants } from '@/services/enseignant';
import { listAffectationsClasse } from '@/services/affectation';
import { getTitulaire } from '@/services/titularite';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { TitulariteControls } from './TitulariteControls';

export default async function AffectationsClassePage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const classe = await getClasse(params.id);
  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';

  const [affectations, titulaire, enseignants] = await Promise.all([
    listAffectationsClasse(classe.id, classe.anneeScolaireId),
    getTitulaire(classe.id, classe.anneeScolaireId),
    canWrite ? listEnseignants({ statut: 'ACTIF' }) : Promise.resolve([]),
  ]);

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <LienRetour href={`/etablissement/classes/${classe.id}`}>Retour à la classe</LienRetour>

        <div>
          <h1 className="text-display-sm text-text-primary">Affectations — {classe.nom}</h1>
          <p className="text-body-sm text-text-secondary">
            {classe.niveau.nom}
            {classe.serie ? ` — Série ${classe.serie.nom}` : ''}
          </p>
        </div>

        {canWrite && (
          <Card>
            <CardHeader>
              <CardTitle>Titulaire de la classe</CardTitle>
            </CardHeader>
            <CardContent>
              <TitulariteControls
                classeId={classe.id}
                anneeScolaireId={classe.anneeScolaireId}
                enseignants={enseignants.map((e) => ({ id: e.id, nom: e.nom, prenoms: e.prenoms }))}
                titulaire={titulaire}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Qui enseigne quoi dans cette classe</CardTitle>
          </CardHeader>
          {affectations.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <ClipboardList className="h-8 w-8 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">Aucune affectation pour cette classe.</p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matière</TableHead>
                  <TableHead>Enseignant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affectations.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.matiere.nom}</TableCell>
                    <TableCell>
                      {a.enseignant ? `${a.enseignant.nom} ${a.enseignant.prenoms}` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
