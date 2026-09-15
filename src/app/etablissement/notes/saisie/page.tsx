import { ClipboardList, GraduationCap } from 'lucide-react';
import { getTenantContext, type Role } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listMesAffectations } from '@/services/affectation';
import { listEvaluations, type Periode } from '@/services/evaluation';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarreSection } from '@/components/layout/BarreSection';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EtatVide } from '@/components/ui/etat-vide';
import { getSidebarItems } from '@/lib/navigation';
import { DeclarationEnseignant } from './DeclarationEnseignant';
import { SaisieFiltres } from './SaisieFiltres';
import { EvaluationsList } from './EvaluationsList';
import { NouvelleEvaluationForm } from './NouvelleEvaluationForm';
import { etatDomaine } from '@/services/configuration';
import { PageVerrouillee } from '@/components/configuration/PageVerrouillee';
import { periodesDuRegime, regimeDuCycle } from '@/lib/periodes';
import { getContexteRegime } from '@/services/regime-periodes';

export default async function SaisieNotesPage({
  searchParams,
}: {
  searchParams: { classeId?: string; matiereId?: string; periode?: Periode };
}) {
  const ctx = await getTenantContext();

  // Le verrou avant les lectures : afficher une liste vide sans dire
  // pourquoi est le defaut qu'on repare, et les requetes qui la
  // remplissent n'ont rien a ramener tant que la section n'est pas prete.
  const verrou = await etatDomaine('NOTES');
  if (!verrou.ouvert) {
    return (
      <PageVerrouillee
        domaine="NOTES"
        titre="Saisie des notes"
        retour={{ href: '/dashboard', libelle: 'Retour au tableau de bord' }}
        manques={verrou.manques}
      />
    );
  }

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <BarreSection chemin="/etablissement/notes" role={ctx.role} actif="/etablissement/notes/saisie" />

        <div>
          <h1 className="text-display-sm text-text-primary">Saisie des notes</h1>
          <p className="text-body-sm text-text-secondary">
            Créez des évaluations et saisissez les notes pour vos classes et matières affectées,
            pour l&apos;année scolaire active.
          </p>
        </div>

        {/*
          Le DIRECTEUR passe ici depuis le 2026-09-15. Beaucoup de directeurs
          d'écoles privées togolaises enseignent une matière ; la version
          précédente leur imposait un second compte, avec un second mot de
          passe, pour saisir leurs propres notes. Ce n'est pas le rôle qui
          ouvre la saisie — c'est l'affectation, vérifiée en dessous et à
          nouveau dans `saisirNote`.
        */}
        {ctx.role !== 'ENSEIGNANT' && ctx.role !== 'DIRECTEUR' ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <GraduationCap className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">
                Seul un enseignant saisit des notes, pour les matières qui lui sont attribuées.
              </p>
            </CardContent>
          </Card>
        ) : (
          <SaisieContent searchParams={searchParams} role={ctx.role} />
        )}
      </div>
    </AppLayout>
  );
}

async function SaisieContent({
  searchParams,
  role,
}: {
  searchParams: { classeId?: string; matiereId?: string; periode?: Periode };
  role: Role;
}) {
  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');

  if (!anneeActive) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <GraduationCap className="h-10 w-10 text-text-secondary/50" aria-hidden />
          <p className="text-body-sm text-text-secondary">Aucune année scolaire n’est ouverte. La direction doit en activer une.</p>
        </CardContent>
      </Card>
    );
  }

  const affectations = await listMesAffectations(anneeActive.id);

  if (affectations.length === 0) {
    // Le directeur, lui, peut s'en sortir tout seul : c'est lui qui attribue
    // les matières. Lui servir « contactez votre établissement » serait lui
    // dire de s'écrire à lui-même.
    return (
      <Card>
        <CardContent>
          {role === 'DIRECTEUR' ? (
            <EtatVide
              icone={GraduationCap}
              titre="Vous n’enseignez aucune matière cette année."
              explication="Si vous êtes aussi professeur, déclarez-le : votre fiche enseignant sera rattachée à ce compte, et vous pourrez saisir les notes des matières que vous vous attribuerez — celles-là uniquement."
              action={<DeclarationEnseignant />}
            />
          ) : (
            <EtatVide
              icone={GraduationCap}
              titre="Vous n’avez pas encore de classe ni de matière attribuée."
              explication="C’est ce qui ouvre la saisie des notes, et la direction s’en charge. Contactez votre établissement si vous pensez qu’il s’agit d’une erreur."
            />
          )}
        </CardContent>
      </Card>
    );
  }

  // Le cycle voyage avec le nom : c'est lui qui décide si la classe se découpe
  // en trimestres ou en semestres, et il arrive déjà dans la même requête.
  const classes = Array.from(new Map(affectations.map((a) => [a.classeId, a.classe])).entries()).map(
    ([id, classe]) => ({ id, nom: classe.nom, cycle: classe.niveau?.cycle?.nom ?? null }),
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

  // Les périodes réellement offertes à **cette** classe. Une adresse portant
  // `periode=TRIMESTRE_3` sur une classe de lycée au semestre est ramenée à la
  // première période plutôt que d'ouvrir une saisie que l'écran ne propose pas
  // et dont les notes n'entreraient dans aucun bulletin.
  const cycleClasse = classes.find((c) => c.id === classeId)?.cycle ?? null;
  const periodesOffertes = periodesDuRegime(regimeDuCycle(cycleClasse, (await getContexteRegime()).regimeLycee));
  const periode: Periode =
    searchParams.periode && periodesOffertes.includes(searchParams.periode)
      ? searchParams.periode
      : 'TRIMESTRE_1';

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
