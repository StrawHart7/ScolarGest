'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErreurEtape } from '../Bulles';
import { creerTarifsAction } from '../actions';

export interface ClasseTarifable {
  id: string;
  nom: string;
  niveauId: string;
  niveauNom: string;
}

export interface TypeFraisTarifable {
  id: string;
  nom: string;
}

/**
 * Le tarif est stocké **par classe** (`tarif_scolaire.classeId`), mais le
 * demander classe par classe serait inutilisable : vingt classes et quatre
 * types de frais feraient quatre-vingts champs. La saisie se fait donc **par
 * niveau**, et le montant est développé sur toutes les classes de ce niveau
 * avant l'envoi. L'ajustement d'une classe en particulier reste possible
 * ensuite depuis l'écran des tarifs.
 */
export function EtapeTarifs({
  anneeScolaireId,
  classes,
  typesFrais,
  onTermine,
}: {
  anneeScolaireId: string;
  classes: ClasseTarifable[];
  typesFrais: TypeFraisTarifable[];
  onTermine: () => void;
}) {
  const [montants, setMontants] = React.useState<Record<string, string>>({});
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  const cle = (niveauId: string, typeFraisId: string) => `${niveauId}|${typeFraisId}`;

  const niveaux = React.useMemo(() => {
    const parNiveau = new Map<string, { id: string; nom: string; nombreClasses: number }>();
    for (const classe of classes) {
      const existant = parNiveau.get(classe.niveauId);
      parNiveau.set(classe.niveauId, {
        id: classe.niveauId,
        nom: classe.niveauNom,
        nombreClasses: (existant?.nombreClasses ?? 0) + 1,
      });
    }
    return [...parNiveau.values()];
  }, [classes]);

  async function valider() {
    setErreur(null);
    setEnCours(true);

    // Développement niveau → classes : un montant saisi une fois s'applique à
    // toutes les classes du niveau.
    const tarifs: { classeId: string; typeFraisId: string; montant: number }[] = [];
    for (const classe of classes) {
      for (const type of typesFrais) {
        const brut = montants[cle(classe.niveauId, type.id)];
        if (brut === undefined || brut.trim() === '') continue;
        const montant = Number(brut);
        if (Number.isNaN(montant)) continue;
        tarifs.push({ classeId: classe.id, typeFraisId: type.id, montant });
      }
    }

    if (tarifs.length === 0) {
      setEnCours(false);
      setErreur('Renseignez au moins un montant.');
      return;
    }

    const resultat = await creerTarifsAction({ anneeScolaireId, tarifs });
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {niveaux.map((niveau) => (
        <div
          key={niveau.id}
          className="rounded-lg border border-surface-border bg-surface-container-low p-3"
        >
          <p className="mb-2 text-body-md font-medium text-text-primary">
            {niveau.nom}
            <span className="ml-2 text-body-sm font-normal text-text-secondary">
              {niveau.nombreClasses} classe{niveau.nombreClasses > 1 ? 's' : ''}
            </span>
          </p>
          <div className="flex flex-col gap-2">
            {typesFrais.map((type) => (
              <div key={type.id} className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor={`tarif-${niveau.id}-${type.id}`}
                  className="text-body-sm text-text-primary"
                >
                  {type.nom}
                </label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id={`tarif-${niveau.id}-${type.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    value={montants[cle(niveau.id, type.id)] ?? ''}
                    onChange={(e) =>
                      setMontants((prec) => ({
                        ...prec,
                        [cle(niveau.id, type.id)]: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="h-9 w-32 text-right"
                  />
                  <span className="text-body-sm text-text-secondary">F</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || niveaux.length === 0}>
          {enCours ? 'Enregistrement…' : 'Enregistrer les tarifs'}
        </Button>
      </div>
    </div>
  );
}
