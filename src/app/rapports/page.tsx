import { Download, FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listMesAffectations } from '@/services/affectation';
import {
  construireRapport,
  definitionRapport,
  rapportsAutorises,
  type TypeRapport,
} from '@/services/rapport';
import type { Periode } from '@/services/evaluation';
import { formaterCellule, type Rapport } from '@/lib/export/rapport';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { RapportsFiltres } from './RapportsFiltres';

/** Au-delà, l'aperçu devient illisible et coûteux : l'export prend le relais. */
const MAX_LIGNES_APERCU = 100;

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: {
    type?: string;
    anneeScolaireId?: string;
    classeId?: string;
    periode?: string;
  };
}) {
  const ctx = await getTenantContext();
  const disponibles = rapportsAutorises(ctx.role);

  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = searchParams.anneeScolaireId || anneeActive?.id || annees[0]?.id;

  // Un enseignant n'a pas accès au catalogue des classes de l'établissement
  // (`listClasses` est réservé aux rôles administratifs) : son sélecteur est
  // construit à partir de ses seules affectations, ce qui est de toute façon
  // le périmètre que le rapport lui autorisera.
  const classes = !anneeScolaireId
    ? []
    : ctx.role === 'ENSEIGNANT'
      ? [
          ...new Map(
            (await listMesAffectations(anneeScolaireId)).map((a) => [
              a.classeId,
              { id: a.classeId, nom: a.classe.nom },
            ]),
          ).values(),
        ]
      : await listClasses(anneeScolaireId);

  const typeDemande = searchParams.type as TypeRapport | undefined;
  const type: TypeRapport | undefined =
    typeDemande && disponibles.some((r) => r.type === typeDemande)
      ? typeDemande
      : disponibles[0]?.type;

  const definition = type ? definitionRapport(type) : null;
  const classeId = searchParams.classeId || (definition?.exigeClasse ? classes[0]?.id : undefined);
  const periode = (searchParams.periode as Periode | undefined) ?? 'TRIMESTRE_1';

  const parametresComplets = Boolean(
    anneeScolaireId && (!definition?.exigeClasse || classeId),
  );

  let rapport: Rapport | null = null;
  let erreur: string | null = null;
  if (type && anneeScolaireId && parametresComplets) {
    try {
      rapport = await construireRapport(type, {
        anneeScolaireId,
        classeId,
        periode: definition?.exigePeriode ? periode : undefined,
      });
    } catch (e) {
      erreur = e instanceof Error ? e.message : 'Erreur lors de la construction du rapport';
    }
  }

  const parametresExport = new URLSearchParams();
  if (type) parametresExport.set('type', type);
  if (anneeScolaireId) parametresExport.set('anneeScolaireId', anneeScolaireId);
  if (classeId) parametresExport.set('classeId', classeId);
  if (definition?.exigePeriode) parametresExport.set('periode', periode);
  const lienExport = (format: string) =>
    `/api/rapports/export?${parametresExport.toString()}&format=${format}`;

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Rapports et exports</h1>
          <p className="text-body-md text-text-secondary">
            {definition?.description ??
              'Sélectionnez un rapport pour l’afficher et l’exporter en Excel, CSV ou PDF.'}
          </p>
        </div>

        {disponibles.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-body-md text-text-primary">
                Aucun rapport n&apos;est accessible à votre rôle.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-border p-4">
              <RapportsFiltres
                rapports={disponibles}
                annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
                classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
                typeCourant={type!}
                anneeScolaireId={anneeScolaireId ?? ''}
                classeId={classeId ?? ''}
                periode={periode}
                exigeClasse={Boolean(definition?.exigeClasse)}
                exigePeriode={Boolean(definition?.exigePeriode)}
              />

              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="secondary" disabled={!rapport}>
                  <a href={lienExport('xlsx')} download>
                    <FileSpreadsheet className="h-4 w-4" aria-hidden />
                    Excel
                  </a>
                </Button>
                <Button asChild size="sm" variant="secondary" disabled={!rapport}>
                  <a href={lienExport('csv')} download>
                    <Table2 className="h-4 w-4" aria-hidden />
                    CSV
                  </a>
                </Button>
                <Button asChild size="sm" variant="secondary" disabled={!rapport}>
                  <a href={lienExport('pdf')} download>
                    <FileText className="h-4 w-4" aria-hidden />
                    PDF
                  </a>
                </Button>
              </div>
            </div>

            {erreur ? (
              <CardContent className="py-12 text-center">
                <p className="text-body-sm text-error">{erreur}</p>
              </CardContent>
            ) : !rapport ? (
              <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
                <Download className="h-10 w-10 text-text-secondary/50" aria-hidden />
                <p className="text-body-sm text-text-secondary">
                  Complétez les filtres pour afficher le rapport.
                </p>
              </CardContent>
            ) : rapport.lignes.length === 0 ? (
              <CardContent className="py-16 text-center">
                <p className="text-body-md text-text-primary">
                  Aucune donnée pour cette sélection.
                </p>
              </CardContent>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {rapport.colonnes.map((colonne) => (
                        <TableHead
                          key={colonne.cle}
                          className={colonne.numerique ? 'text-right' : undefined}
                        >
                          {colonne.libelle}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rapport.lignes.slice(0, MAX_LIGNES_APERCU).map((ligne, index) => (
                      // eslint-disable-next-line react/no-array-index-key -- lignes de rapport sans identifiant propre
                      <TableRow key={index}>
                        {rapport!.colonnes.map((colonne) => (
                          <TableCell
                            key={colonne.cle}
                            className={colonne.numerique ? 'text-right' : undefined}
                            data-mono={colonne.numerique || undefined}
                          >
                            {formaterCellule(ligne[colonne.cle] ?? null, colonne.numerique)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {rapport.totaux && (
                      <TableRow>
                        {rapport.colonnes.map((colonne) => (
                          <TableCell
                            key={colonne.cle}
                            className={`font-semibold ${colonne.numerique ? 'text-right' : ''}`}
                            data-mono={colonne.numerique || undefined}
                          >
                            {formaterCellule(rapport!.totaux![colonne.cle] ?? null, colonne.numerique)}
                          </TableCell>
                        ))}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="border-t border-surface-border p-3 text-body-sm text-text-secondary">
                  {rapport.lignes.length} ligne(s)
                  {rapport.lignes.length > MAX_LIGNES_APERCU
                    ? ` — aperçu limité aux ${MAX_LIGNES_APERCU} premières, l’export contient tout.`
                    : ''}
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
