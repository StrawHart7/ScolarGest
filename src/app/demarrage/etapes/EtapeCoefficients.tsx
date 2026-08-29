'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { appelerAction } from '../appel-action';
import { ErreurEtape } from '../Bulles';
import { definirCoefficientsAction } from '../actions';

export interface LigneProgrammeNiveau {
  /** Identifiant de la ligne `programme_etablissement`, clé du coefficient. */
  programmeEtablissementId: string;
  niveauId: string;
  niveauNom: string;
  matiereNom: string;
  /** Séries du cycle du niveau ; vide hors lycée. */
  serieIds: string[];
}

/**
 * Les coefficients se saisissent par niveau, et au lycée par série : deux
 * Terminales de séries différentes ne pondèrent pas les mêmes matières de la
 * même façon. `definirCoefficients` accepte un lot par série, d'où le
 * regroupement ci-dessous.
 *
 * Défaut à 1 partout : c'est la valeur neutre, l'école n'ajuste que ce qui
 * s'écarte de la règle.
 */
export function EtapeCoefficients({
  anneeScolaireId,
  lignes,
  seriesParId,
  onTermine,
}: {
  anneeScolaireId: string;
  lignes: LigneProgrammeNiveau[];
  seriesParId: Record<string, string>;
  onTermine: () => void;
}) {
  const [valeurs, setValeurs] = React.useState<Record<string, number>>({});
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  /** Clé de saisie : une ligne de programme par série (ou sans série). */
  const cle = (programmeId: string, serieId: string | null) => `${programmeId}|${serieId ?? ''}`;

  // Le nom du niveau est porté par le groupe lui-même plutôt que relu sur sa
  // première ligne : `noUncheckedIndexedAccess` rendrait cet accès incertain,
  // alors que l'information est connue au moment du regroupement.
  const parNiveau = React.useMemo(() => {
    const groupes = new Map<string, { niveauNom: string; lignes: LigneProgrammeNiveau[] }>();
    for (const ligne of lignes) {
      const groupe = groupes.get(ligne.niveauId) ?? { niveauNom: ligne.niveauNom, lignes: [] };
      groupe.lignes.push(ligne);
      groupes.set(ligne.niveauId, groupe);
    }
    return [...groupes.entries()].map(([niveauId, groupe]) => ({ niveauId, ...groupe }));
  }, [lignes]);

  async function valider() {
    setErreur(null);
    setEnCours(true);

    // Regroupement par série : `definirCoefficients` traite un lot à la fois.
    const parSerie = new Map<string | null, { programmeEtablissementId: string; coefficient: number }[]>();
    for (const ligne of lignes) {
      const series: (string | null)[] = ligne.serieIds.length > 0 ? ligne.serieIds : [null];
      for (const serieId of series) {
        const saisies = parSerie.get(serieId) ?? [];
        saisies.push({
          programmeEtablissementId: ligne.programmeEtablissementId,
          coefficient: valeurs[cle(ligne.programmeEtablissementId, serieId)] ?? 1,
        });
        parSerie.set(serieId, saisies);
      }
    }

    const resultat = await appelerAction(() => definirCoefficientsAction({
      anneeScolaireId,
      lots: [...parSerie.entries()].map(([serieId, saisies]) => ({ serieId, saisies })),
    }));
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  const avecSeries = lignes.some((l) => l.serieIds.length > 0);

  return (
    <div className="mt-4 flex flex-col gap-4">
      {avecSeries && (
        <p className="rounded border border-surface-border bg-surface-container-low p-2 text-body-sm text-text-secondary">
          Seules les séries pour lesquelles vous avez ouvert une classe sont proposées. Un
          coefficient à <strong>0</strong> retire la matière de la moyenne de cette série.
        </p>
      )}
      {parNiveau.map((groupe) => (
        <div
          key={groupe.niveauId}
          className="rounded-lg border border-surface-border bg-surface-container-low p-3"
        >
          <p className="mb-2 text-body-md font-medium text-text-primary">{groupe.niveauNom}</p>
          <div className="flex flex-col gap-2">
            {groupe.lignes.map((ligne) => {
              const series: (string | null)[] = ligne.serieIds.length > 0 ? ligne.serieIds : [null];
              return (
                <div
                  key={ligne.programmeEtablissementId}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="text-body-sm text-text-primary">{ligne.matiereNom}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {series.map((serieId) => (
                      <div key={serieId ?? 'sans'} className="flex items-center gap-1.5">
                        {serieId && (
                          <span className="text-label-md text-text-secondary">
                            {seriesParId[serieId]}
                          </span>
                        )}
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={0.5}
                          aria-label={`Coefficient ${ligne.matiereNom}${serieId ? ` série ${seriesParId[serieId]}` : ''}`}
                          value={valeurs[cle(ligne.programmeEtablissementId, serieId)] ?? 1}
                          onChange={(e) =>
                            setValeurs((prec) => ({
                              ...prec,
                              [cle(ligne.programmeEtablissementId, serieId)]: Number(e.target.value),
                            }))
                          }
                          className="h-9 w-16 text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || lignes.length === 0}>
          {enCours ? 'Enregistrement…' : 'Enregistrer les coefficients'}
        </Button>
      </div>
    </div>
  );
}
