import Link from 'next/link';
import { Layers } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listCyclesActifs, listNiveauxParCycle } from '@/services/structure';
import { listMatieres } from '@/services/matiere';
import { listProgramme } from '@/services/programme';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { NiveauSelector, type NiveauOption } from './NiveauSelector';
import { AjoutMatiereForm } from './AjoutMatiereForm';
import { RetirerButton } from './RetirerButton';

export default async function ProgrammePage({
  searchParams,
}: {
  searchParams: { niveauId?: string };
}) {
  const ctx = await getTenantContext();
  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';

  const cyclesActifs = await listCyclesActifs();
  const niveaux: NiveauOption[] = (
    await Promise.all(
      cyclesActifs.map(async (ce) => {
        const niveauxCycle = await listNiveauxParCycle(ce.cycleId);
        return niveauxCycle.map((n) => ({ id: n.id, nom: n.nom, cycleNom: ce.cycle.nom }));
      }),
    )
  ).flat();

  const niveauId = searchParams.niveauId ?? niveaux[0]?.id;

  const [programme, matieres] = niveauId
    ? await Promise.all([listProgramme(niveauId), listMatieres()])
    : [[], []];

  const matieresDisponibles = matieres.filter(
    (m) => m.statut === 'ACTIF' && !programme.some((p) => p.matiereId === m.id),
  );
  const prochainOrdre =
    programme.length === 0 ? 0 : Math.max(...programme.map((p) => p.ordreAffichage)) + 1;

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-display-sm text-text-primary">Programme par niveau</h1>
            <p className="text-body-md text-text-secondary">
              Matières enseignées à chaque niveau, obligatoires ou facultatives.
            </p>
          </div>
          <Link
            href="/etablissement/programme/coefficients"
            className="text-body-sm font-medium text-primary hover:underline"
          >
            Gérer les coefficients →
          </Link>
        </div>

        {niveaux.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Layers className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">
                Aucun niveau disponible — activez un cycle dans Cycles.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <NiveauSelector niveaux={niveaux} value={niveauId ?? ''} basePath="/etablissement/programme" />

            {canWrite && (
              <Card>
                <CardHeader>
                  <CardTitle>Ajouter une matière au programme</CardTitle>
                </CardHeader>
                <CardContent>
                  <AjoutMatiereForm
                    niveauId={niveauId!}
                    matieresDisponibles={matieresDisponibles}
                    prochainOrdre={prochainOrdre}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Matières du programme</CardTitle>
              </CardHeader>
              {programme.length === 0 ? (
                <CardContent className="py-10 text-center text-body-md text-text-secondary">
                  Aucune matière rattachée à ce niveau pour le moment.
                </CardContent>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ordre</TableHead>
                      <TableHead>Matière</TableHead>
                      <TableHead>Statut</TableHead>
                      {canWrite && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {programme.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell data-mono>{p.ordreAffichage}</TableCell>
                        <TableCell className="font-medium">
                          {p.matiere.nom}
                          {p.matiere.code ? ` (${p.matiere.code})` : ''}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.obligatoire ? 'primary' : 'neutral'} shape="pill">
                            {p.obligatoire ? 'Obligatoire' : 'Facultative'}
                          </Badge>
                        </TableCell>
                        {canWrite && (
                          <TableCell>
                            <RetirerButton id={p.id} />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
