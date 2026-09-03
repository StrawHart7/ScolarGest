import { ClipboardList, Users2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listMesAffectations } from '@/services/affectation';
import { getResultatsClasse, type ResultatEleve } from '@/services/resultats-classe';
import type { Periode } from '@/services/evaluation';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { BarreListe } from '@/components/ui/barre-liste';
import { PaginationListe, TriColonne } from '@/components/ui/liste-toolbar';
import { lireParametresListe, preparerListe } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';
import { ResultatsFiltres } from './ResultatsFiltres';

const APPRECIATION_BADGE: Record<string, { variant: 'success' | 'primary' | 'warning' | 'error' }> = {
  Excellent: { variant: 'success' },
  'Très Bien': { variant: 'success' },
  Bien: { variant: 'primary' },
  'Assez Bien': { variant: 'primary' },
  Passable: { variant: 'warning' },
  Insuffisant: { variant: 'warning' },
  'Très Insuffisant': { variant: 'error' },
  'Très Mal': { variant: 'error' },
  Médiocre: { variant: 'error' },
};

function formatMoyenne(v: number | null): string {
  return v === null ? '—' : v.toFixed(2);
}

export default async function ResultatsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [ctx, annees] = await Promise.all([getTenantContext(), listAnneesScolaires()]);

  const lireUnique = (cle: string): string | undefined => {
    const brut = searchParams[cle];
    const valeur = Array.isArray(brut) ? brut[0] : brut;
    return valeur && valeur.length > 0 ? valeur : undefined;
  };

  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = lireUnique('anneeScolaireId') || anneeActive?.id || annees[0]?.id;
  const periode = (lireUnique('periode') as Periode | undefined) ?? 'TRIMESTRE_1';

  const classeOptions =
    ctx.role === 'ENSEIGNANT'
      ? Array.from(
          new Map(
            anneeScolaireId
              ? (await listMesAffectations(anneeScolaireId)).map((a) => [a.classeId, a.classe.nom])
              : [],
          ).entries(),
        ).map(([id, nom]) => ({ id, nom }))
      : anneeScolaireId
        ? (await listClasses(anneeScolaireId)).map((c) => ({ id: c.id, nom: c.nom }))
        : [];

  const classeId = lireUnique('classeId') || classeOptions[0]?.id;

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-4 md:space-y-6">
        <LienRetour href="/etablissement/notes">Retour aux notes et résultats</LienRetour>

        <div className="hidden md:block">
          <PageHeader
            title="Moyennes & classement"
            description="Consultation des moyennes par matière, moyennes trimestrielles, appréciations et rangs calculés par le moteur académique."
          />
        </div>
        <h1 className="text-display-sm text-text-primary md:hidden">Moyennes &amp; classement</h1>

        <BarreListe
          placeholderRecherche="Rechercher un élève…"
          filtresLibres={
            <ResultatsFiltres
              annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
              classes={classeOptions}
              defaultAnneeScolaireId={anneeScolaireId ?? ''}
              defaultClasseId={classeId ?? ''}
              defaultPeriode={periode}
            />
          }
          nombreFiltresLibresActifs={classeId ? 1 : 0}
          className="mb-4 md:mb-6"
        />

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">

          {!anneeScolaireId || !classeId ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Users2 className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">
                {classeOptions.length === 0
                  ? 'Aucune classe accessible pour cette année scolaire.'
                  : 'Sélectionnez une classe pour afficher les résultats.'}
              </p>
            </CardContent>
          ) : (
            <ResultatsTable
              classeId={classeId}
              periode={periode}
              anneeScolaireId={anneeScolaireId}
              searchParams={searchParams}
            />
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

async function ResultatsTable({
  classeId,
  periode,
  anneeScolaireId,
  searchParams,
}: {
  classeId: string;
  periode: Periode;
  anneeScolaireId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  let resultats;
  try {
    // Une seule lecture groupée pour toute la classe (voir `resultats-classe.ts`).
    resultats = await getResultatsClasse(classeId, periode, anneeScolaireId);
  } catch (erreur) {
    return (
      <CardContent className="py-12 text-center">
        <p className="text-body-sm text-error">
          {erreur instanceof Error ? erreur.message : 'Erreur lors du calcul des résultats.'}
        </p>
      </CardContent>
    );
  }

  if (resultats.eleves.length === 0) {
    return (
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <ClipboardList className="h-10 w-10 text-text-secondary/50" aria-hidden />
        <p className="text-body-sm text-text-secondary">
          Aucun élève inscrit (statut ACTIF) dans cette classe pour cette année scolaire.
        </p>
      </CardContent>
    );
  }

  const parametres = lireParametresListe(searchParams, { tri: 'rang' });
  const page = preparerListe<ResultatEleve>(resultats.eleves, parametres, {
    champsRecherche: (e) => [e.nom, e.prenoms],
    valeursTri: {
      rang: (e) => e.rang,
      eleve: (e) => `${e.nom} ${e.prenoms}`,
      moyenne: (e) => e.moyenneTrimestrielle,
    },
  });

  return (
    <>
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-surface-border bg-surface-container-low px-4 py-2 text-body-sm text-text-secondary">
        <span>
          Moyenne générale de la classe :{' '}
          <strong className="text-text-primary">{formatMoyenne(resultats.moyenneGenerale)}</strong>
        </span>
        <span>
          Moyenne la plus forte :{' '}
          <strong className="text-text-primary">
            {formatMoyenne(resultats.moyenneLaPlusForte)}
          </strong>
        </span>
        <span>
          Moyenne la plus faible :{' '}
          <strong className="text-text-primary">
            {formatMoyenne(resultats.moyenneLaPlusFaible)}
          </strong>
        </span>
      </div>

      {page.lignes.length === 0 ? (
        <CardContent className="py-10 text-center">
          <span className="text-body-sm text-text-secondary">
            Aucun élève ne correspond à la recherche.
          </span>
        </CardContent>
      ) : (
        <>
          {/* Desktop : la grille dense élèves × matières, dans un conteneur qui
              défile horizontalement plutôt que de rogner les colonnes. */}
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TriColonne cle="eleve">Nom &amp; Prénoms</TriColonne>
                  {resultats.matieres.map((m) => (
                    <TableHead key={m.matiereId} className="text-right">
                      {m.matiereNom}
                    </TableHead>
                  ))}
                  <TriColonne cle="moyenne" numerique>
                    Moyenne
                  </TriColonne>
                  <TableHead>Appréciation</TableHead>
                  <TriColonne cle="rang" numerique>
                    Rang
                  </TriColonne>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.lignes.map((eleve) => {
                  const appr = eleve.appreciation;
                  const badge = appr ? APPRECIATION_BADGE[appr] : undefined;
                  const moyenneParMatiere = new Map(
                    eleve.matieres.map((m) => [m.matiereId, m.moyenne]),
                  );

                  return (
                    <TableRow key={eleve.eleveId}>
                      <TableCell className="font-medium">
                        {eleve.nom} {eleve.prenoms}
                      </TableCell>
                      {resultats.matieres.map((m) => (
                        <TableCell key={m.matiereId} data-mono className="text-right">
                          {formatMoyenne(moyenneParMatiere.get(m.matiereId) ?? null)}
                        </TableCell>
                      ))}
                      <TableCell data-mono className="text-right font-semibold">
                        {formatMoyenne(eleve.moyenneTrimestrielle)}
                      </TableCell>
                      <TableCell>
                        {appr ? (
                          <Badge variant={badge?.variant ?? 'neutral'} shape="pill">
                            {appr}
                          </Badge>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </TableCell>
                      <TableCell data-mono className="text-right">
                        {eleve.rang ?? '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile : une carte par élève — identité, moyenne, rang et
              appréciation en tête, puis les moyennes par matière en clé/valeur
              (nombre de matières variable selon la classe). */}
          <ul className="flex flex-col divide-y divide-surface-border md:hidden">
            {page.lignes.map((eleve) => {
              const appr = eleve.appreciation;
              const badge = appr ? APPRECIATION_BADGE[appr] : undefined;
              const moyenneParMatiere = new Map(
                eleve.matieres.map((m) => [m.matiereId, m.moyenne]),
              );

              return (
                <li key={eleve.eleveId} className="px-1 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-bold text-text-primary">
                        {eleve.nom} {eleve.prenoms}
                      </p>
                      {appr && (
                        <Badge variant={badge?.variant ?? 'neutral'} shape="pill" className="mt-1">
                          {appr}
                        </Badge>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-headline-sm font-bold text-text-primary">
                        {formatMoyenne(eleve.moyenneTrimestrielle)}
                      </p>
                      <p className="text-[11px] text-on-surface-variant">Rang {eleve.rang ?? '—'}</p>
                    </div>
                  </div>
                  {resultats.matieres.length > 0 && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                      {resultats.matieres.map((m) => (
                        <div key={m.matiereId} className="flex items-baseline justify-between gap-2">
                          <dt className="truncate text-[11px] text-on-surface-variant">
                            {m.matiereNom}
                          </dt>
                          <dd className="shrink-0 font-mono text-[11px] text-text-primary">
                            {formatMoyenne(moyenneParMatiere.get(m.matiereId) ?? null)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <PaginationListe
        page={page.page}
        nombrePages={page.nombrePages}
        debut={page.debut}
        fin={page.fin}
        total={page.total}
        libelle="élève(s)"
      />
    </>
  );
}
