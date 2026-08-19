import { ClipboardList, Users2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listMesAffectations } from '@/services/affectation';
import { listElevesInscritsClasse } from '@/services/eleve';
import { getMoyennesEleve, getClassementClasse, type MoyennesEleveResult } from '@/services/note';
import type { Periode } from '@/services/evaluation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
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
  searchParams: { classeId?: string; periode?: Periode; anneeScolaireId?: string };
}) {
  const ctx = await getTenantContext();

  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = searchParams.anneeScolaireId || anneeActive?.id || annees[0]?.id;
  const periode: Periode = searchParams.periode ?? 'TRIMESTRE_1';

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

  const classeId = searchParams.classeId || classeOptions[0]?.id;

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Moyennes &amp; classement</h1>
          <p className="text-body-sm text-text-secondary">
            Consultation des moyennes par matière, moyennes trimestrielles, appréciations et rangs
            calculés par le moteur académique.
          </p>
        </div>

        <Card>
          <div className="border-b border-surface-border p-4">
            <ResultatsFiltres
              annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
              classes={classeOptions}
              defaultAnneeScolaireId={anneeScolaireId ?? ''}
              defaultClasseId={classeId ?? ''}
              defaultPeriode={periode}
            />
          </div>

          {!anneeScolaireId || !classeId ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Users2 className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">
                {classeOptions.length === 0
                  ? "Aucune classe accessible pour cette année scolaire."
                  : 'Sélectionnez une classe pour afficher les résultats.'}
              </p>
            </CardContent>
          ) : (
            <ResultatsTable classeId={classeId} periode={periode} anneeScolaireId={anneeScolaireId} />
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
}: {
  classeId: string;
  periode: Periode;
  anneeScolaireId: string;
}) {
  const [eleves, classement] = await Promise.all([
    listElevesInscritsClasse(classeId, anneeScolaireId),
    getClassementClasse(classeId, periode, anneeScolaireId),
  ]);

  if (eleves.length === 0) {
    return (
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <ClipboardList className="h-10 w-10 text-text-secondary/50" aria-hidden />
        <p className="text-body-sm text-text-secondary">
          Aucun élève inscrit (statut ACTIF) dans cette classe pour cette année scolaire.
        </p>
      </CardContent>
    );
  }

  const rangById = new Map(classement.map((c) => [c.eleveId, c.rang]));

  const resultats: MoyennesEleveResult[] = await Promise.all(
    eleves.map((e) => getMoyennesEleve(e.id, classeId, periode, anneeScolaireId)),
  );
  const resultatById = new Map(resultats.map((r) => [r.eleveId, r]));

  // Le programme (donc la liste des matières-colonnes) est celui du niveau
  // de la classe : identique pour tous les élèves de la classe, on prend
  // la première liste non vide comme en-têtes.
  const matieres = resultats.find((r) => r.matieres.length > 0)?.matieres ?? [];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Matricule</TableHead>
          <TableHead>Nom &amp; Prénoms</TableHead>
          {matieres.map((m) => (
            <TableHead key={m.matiereId} className="text-right">
              {m.matiereNom}
            </TableHead>
          ))}
          <TableHead className="text-right">Moyenne</TableHead>
          <TableHead>Appréciation</TableHead>
          <TableHead className="text-right">Rang</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {eleves.map((eleve) => {
          const resultat = resultatById.get(eleve.id);
          const rang = rangById.get(eleve.id) ?? null;
          const appr = resultat?.appreciation ?? null;
          const badge = appr ? APPRECIATION_BADGE[appr] : undefined;

          return (
            <TableRow key={eleve.id}>
              <TableCell data-mono>{eleve.matricule}</TableCell>
              <TableCell className="font-medium">
                {eleve.nom} {eleve.prenoms}
              </TableCell>
              {(resultat?.matieres ?? matieres).map((m) => (
                <TableCell key={m.matiereId} data-mono className="text-right">
                  {formatMoyenne(m.moyenne)}
                </TableCell>
              ))}
              <TableCell data-mono className="text-right font-semibold">
                {formatMoyenne(resultat?.moyenneTrimestrielle ?? null)}
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
                {rang ?? '—'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
