'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SkipForward, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RailEtapes } from './RailEtapes';
import { EcranFinal } from './EcranFinal';
import { EtapePin } from './etapes/EtapePin';
import { EtapeAnnee } from './etapes/EtapeAnnee';
import { EtapeCycles } from './etapes/EtapeCycles';
import { EtapeClasses, type NiveauAvecCycle, type SerieCycle } from './etapes/EtapeClasses';
import { EtapeEnseignants } from './etapes/EtapeEnseignants';
import { EtapeUtilisateurs } from './etapes/EtapeUtilisateurs';
import { EtapeTypesFrais } from './etapes/EtapeTypesFrais';
import {
  EtapeTarifs,
  type ClasseTarifable,
  type TypeFraisTarifable,
} from './etapes/EtapeTarifs';
import { ignorerEtapeAction, terminerOnboardingAction } from './actions';
import { appelerAction } from './appel-action';
import type { DefinitionEtape, IdEtape } from '@/lib/onboarding/etapes';
import type { ProgressionOnboarding, BilanOnboarding } from '@/services/onboarding';
import type { FormuleProposee } from '@/lib/abonnement-formule';
import type { Cycle } from '@/services/structure';

export interface DonneesDemarrage {
  cycles: Cycle[];
  cyclesActifs: string[];
  cyclesActifsNoms: string[];
  niveaux: NiveauAvecCycle[];
  /** Niveaux portant au moins une classe : le périmètre réel de l'école. */
  niveauxUtilises: NiveauAvecCycle[];
  /** Filières réellement ouvertes : « Seconde C » et non « Seconde ». */
  /** Codes du barème national par filière, pour le pré-cochage du programme. */
  series: SerieCycle[];
  seriesParId: Record<string, string>;
  /**
   * Catalogue officiel des cycles activés, chargé côté serveur. Remplace la
   * liste en dur : les matières proposées sont celles du programme national,
   * et `parDefaut` distingue celles qui portent un coefficient ministériel.
   */
  /** Le programme existe, même si plus rien n'y reste à coefficienter. */
  classes: ClasseTarifable[];
  typesFrais: TypeFraisTarifable[];
  anneeScolaireId: string | null;
  etablissementId: string | null;
  resumes: Partial<Record<IdEtape, string>>;
}

/**
 * Carte de démarrage : une étape à la fois, dans un panneau flottant à deux
 * colonnes — rail de progression à gauche, étape en cours à droite.
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
  bilan,
  essaiFinLe,
  formules,
}: {
  definitions: DefinitionEtape[];
  progression: ProgressionOnboarding;
  donnees: DonneesDemarrage;
  bilan: BilanOnboarding;
  essaiFinLe: string | null;
  formules: FormuleProposee[];
}) {
  const router = useRouter();
  const [enCours, setEnCours] = React.useState(false);
  const [erreurPilotage, setErreurPilotage] = React.useState<string | null>(null);

  const etatParEtape = React.useMemo(
    () => new Map(progression.etapes.map((e) => [e.id, e])),
    [progression.etapes],
  );

  function avancer() {
    router.refresh();
  }

  async function sauter(etape: IdEtape) {
    setEnCours(true);
    const resultat = await appelerAction(() => ignorerEtapeAction(etape));
    setEnCours(false);
    if (!resultat.ok) {
      setErreurPilotage(resultat.message);
      return;
    }
    router.refresh();
  }

  async function terminer() {
    setEnCours(true);
    const resultat = await appelerAction(() => terminerOnboardingAction());
    setEnCours(false);
    if (!resultat.ok) {
      setErreurPilotage(resultat.message);
      return;
    }
    router.push('/dashboard');
  }

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

  const definitionCourante = definitions.find((d) => d.id === progression.etapeCourante) ?? null;

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-container-lowest shadow-premium">
      <div className="grid md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        {/* Colonne de contexte. Masquée sous `md` : sur un téléphone, elle
            repousserait l'étape en cours hors du premier écran. */}
        <aside className="hidden border-r border-surface-border bg-surface-container-low p-6 md:block">
          <p className="mb-5 text-label-md uppercase text-text-secondary">Votre configuration</p>
          <RailEtapes
            definitions={definitions}
            etats={etatParEtape}
            etapeCourante={progression.etapeCourante}
            resumes={donnees.resumes}
          />
        </aside>

        <section className="min-w-0 p-5 sm:p-8">
          {progression.complete || !definitionCourante ? (
            <EcranFinal
              bilan={bilan}
              onTerminer={terminer}
              enCours={enCours}
              essaiFinLe={essaiFinLe}
              formules={formules}
            />
          ) : (
            <div key={definitionCourante.id} className="animate-slide-up">
              <p className="text-label-md uppercase tracking-wide text-primary-container">
                Étape {definitions.indexOf(definitionCourante) + 1} sur {definitions.length}
              </p>
              <h2 className="mt-2 text-display-sm text-text-primary">
                {definitionCourante.question}
              </h2>
              {definitionCourante.aide && (
                <p className="mt-2 text-body-md text-text-secondary">{definitionCourante.aide}</p>
              )}
              {definitionCourante.irreversible && (
                <p className="mt-4 flex items-start gap-2 rounded border border-warning/30 bg-warning/10 p-2 text-body-sm text-warning-on-container">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{definitionCourante.irreversible}</span>
                </p>
              )}

              {rendreEtape(definitionCourante)}

              {definitionCourante.facultative && (
                <div className="mt-4 flex justify-end border-t border-surface-border pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={enCours}
                    onClick={() => sauter(definitionCourante.id)}
                    className="gap-2"
                  >
                    <SkipForward className="h-4 w-4" aria-hidden />
                    Passer cette étape
                  </Button>
                </div>
              )}
            </div>
          )}

          {erreurPilotage && <p className="mt-4 text-body-sm text-error">{erreurPilotage}</p>}
        </section>
      </div>
    </div>
  );
}
