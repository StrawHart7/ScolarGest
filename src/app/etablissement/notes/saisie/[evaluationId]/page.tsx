import Link from 'next/link';
import { ArrowLeft, GraduationCap, ShieldAlert } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listMesAffectations } from '@/services/affectation';
import { listElevesInscritsClasse } from '@/services/eleve';
import { listNotesEvaluation } from '@/services/note';
import { getEvaluationDetail } from '@/services/evaluation-detail';
import type { Periode, TypeEvaluation } from '@/services/evaluation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { SaisieNotesForm } from './SaisieNotesForm';

const PERIODE_LABEL: Record<Periode, string> = {
  TRIMESTRE_1: '1er trimestre',
  TRIMESTRE_2: '2e trimestre',
  TRIMESTRE_3: '3e trimestre',
};

const TYPE_LABEL: Record<TypeEvaluation, string> = {
  INTERROGATION: 'Interrogation',
  DEVOIR: 'Devoir',
  COMPOSITION: 'Composition',
};

function ErrorCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <ShieldAlert className="h-10 w-10 text-text-secondary/50" aria-hidden />
        <p className="text-body-sm text-text-primary">{message}</p>
        <Link href="/etablissement/notes/saisie" className="text-body-sm text-primary-container hover:underline">
          Retour à la saisie des notes
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function SaisieEvaluationPage({
  params,
}: {
  params: { evaluationId: string };
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
        <Link
          href="/etablissement/notes/saisie"
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-primary-container"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la saisie des notes
        </Link>

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
          <EvaluationContent evaluationId={params.evaluationId} userId={ctx.userId} />
        )}
      </div>
    </AppLayout>
  );
}

async function EvaluationContent({
  evaluationId,
  userId,
}: {
  evaluationId: string;
  userId: string;
}) {
  let evaluation;
  try {
    // getEvaluationDetail applique déjà le contrôle de périmètre (affectation
    // active pour classe/matière/année) et lève une erreur explicite sinon.
    evaluation = await getEvaluationDetail(evaluationId);
  } catch (e) {
    return <ErrorCard message={e instanceof Error ? e.message : 'Évaluation introuvable.'} />;
  }

  // Second contrôle de périmètre, côté page : la combinaison classe/matière
  // de l'évaluation doit correspondre à une affectation active de
  // l'enseignant connecté pour cette année scolaire (défense en profondeur,
  // en plus de la garde déjà appliquée par le service ci-dessus).
  const affectations = await listMesAffectations(evaluation.anneeScolaireId);
  const affectation = affectations.find(
    (a) => a.classeId === evaluation.classeId && a.matiereId === evaluation.matiereId,
  );
  if (!affectation) {
    return (
      <ErrorCard message="Vous n'êtes pas affecté à cette classe pour cette matière : accès refusé." />
    );
  }

  const [eleves, notes] = await Promise.all([
    listElevesInscritsClasse(evaluation.classeId, evaluation.anneeScolaireId),
    listNotesEvaluation(evaluationId),
  ]);

  const verrouille = notes.some((n) => n.statut !== 'BROUILLON');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 border-b border-surface-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-text-secondary">
            <span className="text-label-md">{affectation.classe.nom}</span>
            <span aria-hidden>/</span>
            <span className="text-label-md">{PERIODE_LABEL[evaluation.periode]}</span>
          </div>
          <h1 className="text-display-sm text-text-primary">
            {TYPE_LABEL[evaluation.type]} {evaluation.numero} — {affectation.matiere.nom}
          </h1>
        </div>
      </div>

      {eleves.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <GraduationCap className="h-10 w-10 text-text-secondary/50" aria-hidden />
            <p className="text-body-sm text-text-secondary">
              Aucun élève inscrit (statut ACTIVE) dans cette classe pour cette année scolaire.
            </p>
          </CardContent>
        </Card>
      ) : (
        <SaisieNotesForm
          evaluationId={evaluationId}
          userId={userId}
          eleves={eleves}
          notes={notes}
          verrouille={verrouille}
        />
      )}
    </div>
  );
}
