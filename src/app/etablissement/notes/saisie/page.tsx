import { ClipboardList, GraduationCap } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listMesAffectations } from '@/services/affectation';
import { listEvaluations, type Periode } from '@/services/evaluation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSidebarItems } from '@/lib/navigation';
import { SaisieFiltres } from './SaisieFiltres';
import { EvaluationsList } from './EvaluationsList';
import { NouvelleEvaluationForm } from './NouvelleEvaluationForm';

const PERIODES: Periode[] = ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'];

export default async function SaisieNotesPage({
  searchParams,
}: {
  searchParams: { classeId?: string; matiereId?: string; periode?: Periode };
}) {
  const ctx = await getTenantContext();

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Saisie des notes</h1>
          <p className="text-body-sm text-text-secondary">
            Créez des évaluations et saisissez les notes pour vos classes et matières affectées,
            pour l&apos;année scolaire active.
          </p>
        </div>

        {ctx.role !== 'ENSEIGNANT' ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <GraduationCap className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">
                Cette page est réservée aux comptes enseignants.
              </p>
            </CardContent>
          </Card>
        ) : (
          <SaisieContent searchParams={searchParams} />
        )}
      </div>
    </AppLayout>
  );
}

async function SaisieContent({
  searchParams,
}: {
  searchParams: { classeId?: string; matiereId?: string; periode?: Periode };
}) {
  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');

  if (!anneeActive) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <GraduationCap className="h-10 w-10 text-text-secondary/50" aria-hidden />
          <p className="text-body-sm text-text-secondary">Aucune année scolaire active.</p>
        </CardContent>
      </Card>
    );
  }

  const affectations = await listMesAffectations(anneeActive.id);

  if (affectations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <GraduationCap className="h-10 w-10 text-text-secondary/50" aria-hidden />
          <p className="text-body-sm text-text-primary">Aucune affectation pour le moment.</p>
          <p className="text-body-sm text-text-secondary">
            Contactez votre établissement si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
          </p>
        </CardContent>
      </Card>
    );
  }

  const classes = Array.from(new Map(affectations.map((a) => [a.classeId, a.classe.nom])).entries()).map(
    ([id, nom]) => ({ id, nom }),
  );

  const classeId = searchParams.classeId && classes.some((c) => c.id === searchParams.classeId)
    ? searchParams.classeId
    : classes[0]?.id;

  const matieresPourClasse = Array.from(
    new Map(
      affectations.filter((a) => a.classeId === classeId).map((a) => [a.matiereId, a.matiere.nom]),
    ).entries(),
  ).map(([id, nom]) => ({ id, nom }));

  const matiereId =
    searchParams.matiereId && matieresPourClasse.some((m) => m.id === searchParams.matiereId)
      ? searchParams.matiereId
      : matieresPourClasse[0]?.id;

  const periode: Periode =
    searchParams.periode && PERIODES.includes(searchParams.periode) ? searchParams.periode : 'TRIMESTRE_1';

  // Vérification de périmètre côté page, en plus de la garde déjà présente
  // dans evaluation.ts/note.ts : la combinaison classe/matière demandée doit
  // correspondre à une affectation active de l'enseignant connecté.
  const autorise =
    !!classeId && !!matiereId && affectations.some((a) => a.classeId === classeId && a.matiereId === matiereId);

  return (
    <>
      <Card>
        <div className="border-b border-surface-border p-4">
          <SaisieFiltres classes={classes} matieres={matieresPourClasse} defaultClasseId={classeId ?? ''} defaultMatiereId={matiereId ?? ''} defaultPeriode={periode} />
        </div>

        {!autorise ? (
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList className="h-10 w-10 text-text-secondary/50" aria-hidden />
            <p className="text-body-sm text-text-secondary">
              Sélectionnez une classe et une matière parmi vos affectations pour afficher les
              évaluations.
            </p>
          </CardContent>
        ) : (
          <EvaluationsForContext
            classeId={classeId as string}
            matiereId={matiereId as string}
            periode={periode}
            classeNom={classes.find((c) => c.id === classeId)?.nom ?? ''}
            matiereNom={matieresPourClasse.find((m) => m.id === matiereId)?.nom ?? ''}
          />
        )}
      </Card>

      {autorise && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="primary" shape="pill">Nouvelle évaluation</Badge>
            </div>
            <NouvelleEvaluationForm
              anneeScolaireId={anneeActive.id}
              classeId={classeId as string}
              matiereId={matiereId as string}
              periode={periode}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}

async function EvaluationsForContext({
  classeId,
  matiereId,
  periode,
  classeNom,
  matiereNom,
}: {
  classeId: string;
  matiereId: string;
  periode: Periode;
  classeNom: string;
  matiereNom: string;
}) {
  const evaluations = await listEvaluations(classeId, matiereId, periode);
  return (
    <EvaluationsList evaluations={evaluations} classeNom={classeNom} matiereNom={matiereNom} />
  );
}
