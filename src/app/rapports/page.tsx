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
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { BarreListe } from '@/components/ui/barre-liste';
import { getSidebarItems } from '@/lib/navigation';
import { RapportsFiltres } from './RapportsFiltres';

/** Au-delà, l'aperçu devient illisible et coûteux : l'export prend le relais. */
const MAX_LIGNES_APERCU = 100;

/**
 * Sur téléphone, chaque ligne devient une carte de paires libellé/valeur : une
 * ligne de tableau de 40px en occupe alors une douzaine. Le relevé du
 * 2026-09-04 mesurait cette page à **25 105 px** — trente écrans à faire
 * défiler pour un aperçu. Dix lignes suffisent à juger de la forme du rapport ;
 * c'est l'export qui sert à le lire en entier, et il n'est pas tronqué.
 */
const MAX_LIGNES_APERCU_MOBILE = 10;

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: {
    type?: string;
    anneeScolaireId?: string;
    classeId?: string;
    periode?: string;
    q?: string;
  };
}) {
  const [ctx, annees] = await Promise.all([getTenantContext(), listAnneesScolaires()]);
  const disponibles = rapportsAutorises(ctx.role);

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

  const recherche = (searchParams.q ?? '').trim().toLowerCase();
  const typeDemande = searchParams.type as TypeRapport | undefined;
  const type: TypeRapport | undefined =
    typeDemande && disponibles.some((r) => r.type === typeDemande)
      ? typeDemande
      : disponibles[0]?.type;

  const definition = type ? definitionRapport(type) : null;
  const classeId = searchParams.classeId || (definition?.exigeClasse ? classes[0]?.id : undefined);
  const periode = (searchParams.periode as Periode | undefined) ?? 'TRIMESTRE_1';

  const parametresComplets = Boolean(anneeScolaireId && (!definition?.exigeClasse || classeId));

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

  /**
   * Recherche libre dans l'aperçu.
   *
   * Un rapport n'a pas de colonne « nom » garantie : ses colonnes changent avec
   * son type. On compare donc la valeur de **chaque** cellule, sans supposer
   * laquelle porte l'identité. C'est plus large qu'une recherche par nom, et
   * c'est ce qu'on veut ici — retrouver une ligne par sa classe, son matricule
   * ou son montant est aussi légitime que par son nom.
   *
   * Le filtre porte sur l'aperçu, **pas sur l'export** : celui-ci reste complet.
   * Un export tronqué par une recherche oubliée dans l'URL serait un piège.
   */
  const lignesAffichees =
    rapport && recherche
      ? rapport.lignes.filter((ligne) =>
          rapport!.colonnes.some((colonne) =>
            String(ligne[colonne.cle] ?? '')
              .toLowerCase()
              .includes(recherche),
          ),
        )
      : (rapport?.lignes ?? []);

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
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Rapports et exports</h1>
          <p className="text-body-sm text-text-secondary md:text-body-md">
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
          <>
            <BarreListe
              placeholderRecherche="Rechercher dans le rapport…"
              filtresLibres={
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
              }
              nombreFiltresLibresActifs={classeId ? 1 : 0}
              className="mb-4 md:mb-6"
              actions={
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
              }
            />

            <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
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
              ) : lignesAffichees.length === 0 ? (
                <CardContent className="py-16 text-center">
                  {/* « Aucune donnée » et « aucun résultat » ne demandent pas le
                      même geste : le second se répare en effaçant la recherche. */}
                  <p className="text-body-md text-text-primary">
                    {rapport.lignes.length === 0
                      ? 'Aucune donnée pour cette sélection.'
                      : `Aucune ligne ne contient « ${searchParams.q} ».`}
                  </p>
                  {rapport.lignes.length > 0 && (
                    <p className="mt-1 text-body-sm text-text-secondary">
                      Le rapport compte {rapport.lignes.length} ligne
                      {rapport.lignes.length > 1 ? 's' : ''} : effacez la recherche pour toutes les
                      voir.
                    </p>
                  )}
                </CardContent>
              ) : (
                <>
                  {/* Desktop : le tableau dense, dans un conteneur qui défile
                    horizontalement plutôt que de rogner les colonnes. */}
                  <div className="hidden overflow-x-auto md:block">
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
                        {lignesAffichees.slice(0, MAX_LIGNES_APERCU).map((ligne, index) => (
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
                        {rapport.totaux && !recherche && (
                          <TableRow>
                            {rapport.colonnes.map((colonne) => (
                              <TableCell
                                key={colonne.cle}
                                className={`font-semibold ${colonne.numerique ? 'text-right' : ''}`}
                                data-mono={colonne.numerique || undefined}
                              >
                                {formaterCellule(
                                  rapport!.totaux![colonne.cle] ?? null,
                                  colonne.numerique,
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile : un rapport a un nombre de colonnes variable (2 à une
                    douzaine). Plutôt qu'un tableau qui déborde, chaque ligne
                    devient une carte clé/valeur — titre = première colonne, le
                    reste en paires libellé/valeur. Générique, quel que soit le
                    rapport. */}
                  <ul className="flex flex-col divide-y divide-surface-border md:hidden">
                    {lignesAffichees.slice(0, MAX_LIGNES_APERCU_MOBILE).map((ligne, index) => {
                      const [premiere, ...reste] = rapport!.colonnes;
                      if (!premiere) return null;
                      return (
                        // eslint-disable-next-line react/no-array-index-key -- lignes de rapport sans identifiant propre
                        <li key={index} className="px-1 py-3">
                          <p
                            className={cn(
                              'text-body-md font-bold text-text-primary',
                              premiere.numerique && 'font-mono',
                            )}
                          >
                            {formaterCellule(ligne[premiere.cle] ?? null, premiere.numerique)}
                          </p>
                          {reste.length > 0 && (
                            <dl className="mt-1.5 flex flex-col gap-1">
                              {reste.map((colonne) => (
                                <div
                                  key={colonne.cle}
                                  className="flex items-baseline justify-between gap-3"
                                >
                                  <dt className="shrink-0 text-[11px] uppercase tracking-wide text-on-surface-variant">
                                    {colonne.libelle}
                                  </dt>
                                  <dd
                                    className={cn(
                                      'min-w-0 truncate text-right text-body-sm text-text-primary',
                                      colonne.numerique && 'font-mono',
                                    )}
                                  >
                                    {formaterCellule(ligne[colonne.cle] ?? null, colonne.numerique)}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </li>
                      );
                    })}
                    {rapport.totaux && !recherche && (
                      <li className="bg-surface-container-low px-1 py-3">
                        <dl className="flex flex-col gap-1">
                          {rapport.colonnes.map((colonne) => {
                            const valeur = formaterCellule(
                              rapport!.totaux![colonne.cle] ?? null,
                              colonne.numerique,
                            );
                            if (!valeur) return null;
                            return (
                              <div
                                key={colonne.cle}
                                className="flex items-baseline justify-between gap-3"
                              >
                                <dt className="shrink-0 text-[11px] uppercase tracking-wide text-on-surface-variant">
                                  {colonne.libelle}
                                </dt>
                                <dd
                                  className={cn(
                                    'min-w-0 truncate text-right text-body-sm font-semibold text-text-primary',
                                    colonne.numerique && 'font-mono',
                                  )}
                                >
                                  {valeur}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      </li>
                    )}
                  </ul>

                  <div className="border-t border-surface-border p-3 text-body-sm text-text-secondary">
                    {recherche
                      ? `${lignesAffichees.length} ligne(s) sur ${rapport.lignes.length}`
                      : `${rapport.lignes.length} ligne(s)`}
                    {lignesAffichees.length > MAX_LIGNES_APERCU_MOBILE
                      ? ` — aperçu limité aux ${MAX_LIGNES_APERCU_MOBILE} premières sur téléphone et aux ${MAX_LIGNES_APERCU} premières sur écran large, l’export contient tout.`
                      : ''}
                  </div>
                </>
              )}
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
