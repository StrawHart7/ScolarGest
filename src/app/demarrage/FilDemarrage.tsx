'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BulleAssistant, BulleReponse, QuestionEtape } from './Bulles';
import { EtapePin } from './etapes/EtapePin';
import { EtapeAnnee } from './etapes/EtapeAnnee';
import { EtapeCycles } from './etapes/EtapeCycles';
import { EtapeClasses, type NiveauAvecCycle, type SerieCycle } from './etapes/EtapeClasses';
import { EtapeMatieres } from './etapes/EtapeMatieres';
import { EtapeProgramme, type MatiereChoisissable } from './etapes/EtapeProgramme';
import { EtapeCoefficients, type LigneProgrammeNiveau } from './etapes/EtapeCoefficients';
import { EtapeEnseignants } from './etapes/EtapeEnseignants';
import { EtapeUtilisateurs } from './etapes/EtapeUtilisateurs';
import { EtapeTypesFrais } from './etapes/EtapeTypesFrais';
import {
  EtapeTarifs,
  type ClasseTarifable,
  type TypeFraisTarifable,
} from './etapes/EtapeTarifs';
import { ignorerEtapeAction, terminerOnboardingAction } from './actions';
import type { DefinitionEtape, IdEtape } from '@/lib/onboarding/etapes';
import type { ProgressionOnboarding } from '@/services/onboarding';
import type { Cycle } from '@/services/structure';

export interface DonneesDemarrage {
  cycles: Cycle[];
  cyclesActifs: string[];
  cyclesActifsNoms: string[];
  niveaux: NiveauAvecCycle[];
  /** Niveaux portant au moins une classe : le périmètre réel de l'école. */
  niveauxUtilises: NiveauAvecCycle[];
  series: SerieCycle[];
  seriesParId: Record<string, string>;
  matieres: MatiereChoisissable[];
  lignesProgramme: LigneProgrammeNiveau[];
  classes: ClasseTarifable[];
  typesFrais: TypeFraisTarifable[];
  anneeScolaireId: string | null;
  etablissementId: string | null;
  resumes: Partial<Record<IdEtape, string>>;
}

/**
 * Fil conversationnel du questionnaire de démarrage.
 *
 * Après chaque étape, `router.refresh()` relance le Server Component parent :
 * la progression et les catalogues sont recalculés côté serveur à partir des
 * données réelles. C'est ce qui permet aux étapes suivantes de voir
 * immédiatement ce que la précédente vient de créer (les niveaux d'un cycle
 * fraîchement activé, par exemple) sans dupliquer l'état côté client.
 */
export function FilDemarrage({
  definitions,
  progression,
  donnees,
}: {
  definitions: DefinitionEtape[];
  progression: ProgressionOnboarding;
  donnees: DonneesDemarrage;
}) {
  const router = useRouter();
  const [enCours, setEnCours] = React.useState(false);
  const finDuFil = React.useRef<HTMLDivElement>(null);

  const etatParEtape = React.useMemo(
    () => new Map(progression.etapes.map((e) => [e.id, e])),
    [progression.etapes],
  );

  React.useEffect(() => {
    finDuFil.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [progression.etapeCourante]);

  function avancer() {
    router.refresh();
  }

  async function sauter(etape: IdEtape) {
    setEnCours(true);
    await ignorerEtapeAction(etape);
    setEnCours(false);
    router.refresh();
  }

  async function terminer() {
    setEnCours(true);
    await terminerOnboardingAction();
    setEnCours(false);
    router.push('/dashboard');
  }

  /** Étapes à afficher : toutes celles déjà traitées, plus la courante. */
  const visibles = React.useMemo(() => {
    const index = definitions.findIndex((d) => d.id === progression.etapeCourante);
    return index === -1 ? definitions : definitions.slice(0, index + 1);
  }, [definitions, progression.etapeCourante]);

  function rendreEtape(definition: DefinitionEtape) {
    switch (definition.id) {
      case 'pin':
        return <EtapePin onTermine={avancer} />;
      case 'annee-scolaire':
        return <EtapeAnnee onTermine={avancer} />;
      case 'cycles':
        return (
          <EtapeCycles
            cycles={donnees.cycles}
            cyclesDejaActifs={donnees.cyclesActifs}
            onTermine={avancer}
          />
        );
      case 'classes':
        return donnees.anneeScolaireId ? (
          <EtapeClasses
            anneeScolaireId={donnees.anneeScolaireId}
            niveaux={donnees.niveaux}
            series={donnees.series}
            onTermine={avancer}
          />
        ) : (
          <p className="mt-3 text-body-sm text-error">
            Activez d&apos;abord une année scolaire.
          </p>
        );
      case 'matieres':
        return (
          <EtapeMatieres
            cyclesActifsNoms={donnees.cyclesActifsNoms}
            matieresExistantes={donnees.matieres.map((m) => m.nom)}
            onTermine={avancer}
          />
        );
      case 'programme':
        return donnees.niveauxUtilises.length > 0 ? (
          <EtapeProgramme
            niveaux={donnees.niveauxUtilises}
            matieres={donnees.matieres}
            onTermine={avancer}
          />
        ) : (
          <p className="mt-3 text-body-sm text-error">Créez d&apos;abord vos classes.</p>
        );
      case 'coefficients':
        return donnees.anneeScolaireId && donnees.lignesProgramme.length > 0 ? (
          <EtapeCoefficients
            anneeScolaireId={donnees.anneeScolaireId}
            lignes={donnees.lignesProgramme}
            seriesParId={donnees.seriesParId}
            onTermine={avancer}
          />
        ) : (
          <p className="mt-3 text-body-sm text-error">
            Définissez d&apos;abord le programme de vos niveaux.
          </p>
        );
      case 'enseignants':
        return donnees.anneeScolaireId ? (
          <EtapeEnseignants anneeScolaireId={donnees.anneeScolaireId} onTermine={avancer} />
        ) : (
          <p className="mt-3 text-body-sm text-error">Activez d&apos;abord une année scolaire.</p>
        );
      case 'utilisateurs':
        return donnees.etablissementId ? (
          <EtapeUtilisateurs etablissementId={donnees.etablissementId} onTermine={avancer} />
        ) : null;
      case 'types-frais':
        return (
          <EtapeTypesFrais
            typesExistants={donnees.typesFrais.map((t) => t.nom)}
            onTermine={avancer}
          />
        );
      case 'tarifs':
        return donnees.anneeScolaireId && donnees.classes.length > 0 ? (
          <EtapeTarifs
            anneeScolaireId={donnees.anneeScolaireId}
            classes={donnees.classes}
            typesFrais={donnees.typesFrais}
            onTermine={avancer}
          />
        ) : (
          <p className="mt-3 text-body-sm text-error">
            Aucune classe n&apos;existe encore : le Directeur doit d&apos;abord terminer la
            configuration de la structure.
          </p>
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {visibles.map((definition) => {
        const etat = etatParEtape.get(definition.id);
        const traitee = etat?.faite || etat?.ignoree;
        const courante = definition.id === progression.etapeCourante;

        return (
          <div key={definition.id} className="flex flex-col gap-2">
            <BulleAssistant>
              <QuestionEtape
                question={definition.question}
                aide={definition.aide}
                irreversible={courante ? definition.irreversible : undefined}
              />
              {courante && rendreEtape(definition)}
              {courante && definition.facultative && (
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={enCours}
                    onClick={() => sauter(definition.id)}
                    className="gap-2"
                  >
                    <SkipForward className="h-4 w-4" aria-hidden />
                    Passer cette étape
                  </Button>
                </div>
              )}
            </BulleAssistant>

            {traitee && (
              <BulleReponse
                resume={
                  etat?.ignoree
                    ? 'Étape passée'
                    : (donnees.resumes[definition.id] ?? `${definition.titre} — fait`)
                }
              />
            )}
          </div>
        );
      })}

      {progression.complete && (
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-tertiary/10 text-tertiary">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-headline-md text-text-primary">Configuration terminée</h2>
            <p className="mt-1 text-body-sm text-text-secondary">
              Votre établissement est prêt. Vous pouvez maintenant inscrire vos élèves.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={terminer} disabled={enCours}>
              Aller au tableau de bord
            </Button>
            <Button asChild variant="secondary">
              <Link href="/etablissement/eleves">Inscrire un élève</Link>
            </Button>
          </div>
        </Card>
      )}

      <div ref={finDuFil} />
    </div>
  );
}
