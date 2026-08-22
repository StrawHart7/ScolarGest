import Link from 'next/link';
import { BookOpenCheck, Calculator, Layers } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listCyclesActifs, listNiveauxParCycle } from '@/services/structure';
import { listMatieres } from '@/services/matiere';
import { listProgramme } from '@/services/programme';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
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
      <div className="space-y-4 md:space-y-6">
        {/* Sur mobile, le titre descend dans EnteteListe au-dessus de la liste ;
            la gestion des coefficients reste accessible dans la barre du
            sélecteur de niveau. */}
        <div className="hidden md:block">
          <PageHeader
            title="Programme par niveau"
            description="Matières enseignées à chaque niveau, obligatoires ou facultatives."
            actions={
              // La gestion des coefficients était un lien texte discret alors
              // qu'elle conditionne tout le calcul des moyennes.
              <Button asChild variant="secondary" size="sm">
                <Link href="/etablissement/programme/coefficients">
                  <Calculator className="h-4 w-4" aria-hidden />
                  Gérer les coefficients
                </Link>
              </Button>
            }
          />
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
            <Card>
              <div className="flex flex-wrap items-center gap-3 border-b border-surface-border p-4 md:gap-4">
                <NiveauSelector
                  niveaux={niveaux}
                  value={niveauId ?? ''}
                  basePath="/etablissement/programme"
                />
                {/* Accès aux coefficients sur mobile : le PageHeader qui le
                    portait est desktop-only. */}
                <Button asChild variant="secondary" size="sm" className="md:hidden">
                  <Link href="/etablissement/programme/coefficients">
                    <Calculator className="h-4 w-4" aria-hidden />
                    Coefficients
                  </Link>
                </Button>
                {canWrite && niveauId && (
                  <div className="md:ml-auto">
                    <AjoutMatiereForm
                      niveauId={niveauId}
                      niveauNom={niveaux.find((n) => n.id === niveauId)?.nom ?? ''}
                      matieresDisponibles={matieresDisponibles}
                      prochainOrdre={prochainOrdre}
                    />
                  </div>
                )}
              </div>

              <EnteteListe
                titre="Programme"
                compte={`${programme.length} matière${programme.length > 1 ? 's' : ''}`}
              />

              {programme.length === 0 ? (
                <CardContent className="py-10 text-center text-body-md text-text-secondary">
                  Aucune matière rattachée à ce niveau pour le moment.
                </CardContent>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matière</TableHead>
                          <TableHead>Statut</TableHead>
                          {canWrite && <TableHead>Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {programme.map((p) => (
                          <TableRow key={p.id}>
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
                  </div>

                  <CarteListeMobile>
                    {programme.map((p) => (
                      <LigneCarteMobile
                        key={p.id}
                        icone={BookOpenCheck}
                        titre={p.matiere.nom}
                        reference={p.matiere.code ?? undefined}
                        statut={{
                          libelle: p.obligatoire ? 'Obligatoire' : 'Facultative',
                          ton: p.obligatoire ? 'info' : 'neutre',
                        }}
                        actions={canWrite && <RetirerButton id={p.id} />}
                      />
                    ))}
                  </CarteListeMobile>
                </>
              )}
            </Card>
        )}
      </div>
    </AppLayout>
  );
}
