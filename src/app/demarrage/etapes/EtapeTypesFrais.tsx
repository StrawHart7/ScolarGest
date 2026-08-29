'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErreurEtape, PuceChoix } from '../Bulles';
import { TYPES_FRAIS_SUGGERES } from '@/lib/onboarding/suggestions';
import { creerTypesFraisAction } from '../actions';

/**
 * Première étape du parcours finance, réservé à la Secrétaire et au Comptable :
 * `createTypeFrais` exige l'un de ces deux rôles, le Directeur étant en lecture
 * seule sur la finance (Docs/08 § 17).
 */
export function EtapeTypesFrais({
  typesExistants,
  onTermine,
}: {
  typesExistants: string[];
  onTermine: () => void;
}) {
  const suggestions = React.useMemo(
    () => TYPES_FRAIS_SUGGERES.filter((t) => !typesExistants.includes(t.nom)),
    [typesExistants],
  );

  const [selection, setSelection] = React.useState<string[]>(() =>
    suggestions.filter((t) => t.parDefaut).map((t) => t.nom),
  );
  const [ajoutes, setAjoutes] = React.useState<string[]>([]);
  const [saisieLibre, setSaisieLibre] = React.useState('');
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  function basculer(nom: string) {
    setSelection((prec) => (prec.includes(nom) ? prec.filter((n) => n !== nom) : [...prec, nom]));
  }

  function ajouter() {
    const nom = saisieLibre.trim();
    if (nom === '') return;
    if (![...ajoutes, ...suggestions.map((s) => s.nom), ...typesExistants].includes(nom)) {
      setAjoutes((prec) => [...prec, nom]);
      setSelection((prec) => [...prec, nom]);
    }
    setSaisieLibre('');
  }

  async function valider() {
    setErreur(null);
    setEnCours(true);
    const resultat = await creerTypesFraisAction({
      types: selection.map((nom) => ({
        nom,
        description: suggestions.find((s) => s.nom === nom)?.description,
      })),
    });
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((type) => (
          <PuceChoix
            key={type.nom}
            selectionne={selection.includes(type.nom)}
            onClick={() => basculer(type.nom)}
          >
            {type.nom}
          </PuceChoix>
        ))}
        {ajoutes.map((nom) => (
          <PuceChoix key={nom} selectionne={selection.includes(nom)} onClick={() => basculer(nom)}>
            {nom}
          </PuceChoix>
        ))}
      </div>

      {typesExistants.length > 0 && (
        <p className="text-body-sm text-text-secondary">
          Déjà enregistrés : {typesExistants.join(', ')}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={saisieLibre}
          onChange={(e) => setSaisieLibre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              ajouter();
            }
          }}
          placeholder="Ajouter un autre type de frais"
          className="max-w-xs"
        />
        <Button type="button" variant="secondary" size="sm" onClick={ajouter} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter
        </Button>
      </div>

      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || selection.length === 0}>
          {enCours ? 'Création…' : `Enregistrer ${selection.length} type${selection.length > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
