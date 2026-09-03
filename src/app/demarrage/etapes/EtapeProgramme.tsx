'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { appelerAction } from '../appel-action';
import { ErreurEtape, PuceChoix } from '../Bulles';
import { definirProgrammeAction } from '../actions';
import type { CombinaisonEnseignee } from '@/lib/filiere';

export interface MatiereChoisissable {
  id: string;
  nom: string;
  /** Code de l'école, qui rattache la matière au barème national. */
  code: string | null;
}

/**
 * Associe les matières à chaque **filière réellement ouverte**, et non au
 * simple niveau.
 *
 * C'était le défaut : l'étape affichait « Seconde » une seule fois et
 * appliquait la même liste aux Seconde A4, C et D. Or ces trois filières
 * n'enseignent ni les mêmes matières ni les mêmes coefficients — c'est
 * précisément ce qui les distingue. Le Directeur devait cocher une liste unique
 * pour trois programmes différents, puis retrouvait sur les bulletins des
 * matières étrangères à la filière de l'élève.
 *
 * Le périmètre proposé vient des classes créées à l'étape précédente : rien
 * d'autre ne matérialise en base ce qu'une école enseigne.
 *
 * **Le pré-cochage suit le barème du ministère** quand il couvre la
 * combinaison. Sur une Seconde C, les matières de la série arrivent cochées et
 * les autres non : le Directeur confirme au lieu de composer. Hors barème
 * (série technique, niveau non couvert), tout est coché — le tronc commun
 * reste la règle, et décocher deux cases est plus rapide que d'en cocher
 * quinze.
 */
export function EtapeProgramme({
  anneeScolaireId,
  combinaisons,
  matieres,
  codesParCombinaison,
  onTermine,
}: {
  anneeScolaireId: string;
  combinaisons: CombinaisonEnseignee[];
  matieres: MatiereChoisissable[];
  /** Codes du barème national, par clé de combinaison. Vide = hors barème. */
  codesParCombinaison: Record<string, string[]>;
  onTermine: () => void;
}) {
  const [parCombinaison, setParCombinaison] = React.useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      combinaisons.map((c) => {
        const codes = codesParCombinaison[c.cle] ?? [];
        if (codes.length === 0) {
          return [c.cle, matieres.map((m) => m.id)];
        }
        const retenus = new Set(codes);
        return [c.cle, matieres.filter((m) => m.code && retenus.has(m.code)).map((m) => m.id)];
      }),
    ),
  );
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  function basculer(cle: string, matiereId: string) {
    setParCombinaison((prec) => {
      const actuelles = prec[cle] ?? [];
      return {
        ...prec,
        [cle]: actuelles.includes(matiereId)
          ? actuelles.filter((id) => id !== matiereId)
          : [...actuelles, matiereId],
      };
    });
  }

  const filiereVide = combinaisons.some((c) => (parCombinaison[c.cle] ?? []).length === 0);

  async function valider() {
    setErreur(null);
    setEnCours(true);
    const resultat = await appelerAction(() =>
      definirProgrammeAction({
        anneeScolaireId,
        affectations: combinaisons.map((c) => ({
          niveauId: c.niveauId,
          serieId: c.serieId,
          matiereIds: parCombinaison[c.cle] ?? [],
        })),
      }),
    );
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {combinaisons.map((combinaison) => {
        const officiel = (codesParCombinaison[combinaison.cle] ?? []).length > 0;
        return (
          <div
            key={combinaison.cle}
            className="rounded-lg border border-surface-border bg-surface-container-low p-3"
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-body-md font-medium text-text-primary">{combinaison.libelle}</p>
              {officiel && (
                <span className="text-body-sm text-text-secondary">
                  pré-rempli d&apos;après le programme national
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {matieres.map((matiere) => (
                <PuceChoix
                  key={matiere.id}
                  selectionne={(parCombinaison[combinaison.cle] ?? []).includes(matiere.id)}
                  onClick={() => basculer(combinaison.cle, matiere.id)}
                >
                  {matiere.nom}
                </PuceChoix>
              ))}
            </div>
          </div>
        );
      })}

      <ErreurEtape message={erreur} />

      {/* Une filière sans aucune matière ne produirait que des bulletins vides :
          on le dit avant de laisser valider, pas après. */}
      {filiereVide && (
        <p className="text-body-sm text-amber-700">
          Une filière au moins n&apos;a aucune matière : ses bulletins seraient vides.
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || combinaisons.length === 0 || filiereVide}>
          {enCours ? 'Enregistrement…' : 'Enregistrer le programme'}
        </Button>
      </div>
    </div>
  );
}
