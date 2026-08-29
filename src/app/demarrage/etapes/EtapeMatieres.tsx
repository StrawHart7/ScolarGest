'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErreurEtape, PuceChoix } from '../Bulles';
import { MATIERES_SUGGEREES, type NomCycle } from '@/lib/onboarding/suggestions';
import { creerMatieresAction } from '../actions';

/**
 * Contrairement aux cycles et niveaux, il n'existe **aucun catalogue système**
 * de matières : la table `matiere` porte un `etablissementId`, chaque école
 * crée les siennes. Les suggestions viennent donc d'une liste en dur, adaptée
 * aux cycles réellement activés, pour éviter de laisser le Directeur devant un
 * champ vide. L'ajout libre reste possible.
 */
export function EtapeMatieres({
  cyclesActifsNoms,
  matieresExistantes,
  onTermine,
}: {
  cyclesActifsNoms: string[];
  matieresExistantes: string[];
  onTermine: () => void;
}) {
  const suggestions = React.useMemo(() => {
    const parNom = new Map<string, { nom: string; code: string; parDefaut: boolean }>();
    for (const cycle of cyclesActifsNoms) {
      for (const matiere of MATIERES_SUGGEREES[cycle as NomCycle] ?? []) {
        const existante = parNom.get(matiere.nom);
        // Une matière proposée par défaut dans l'un des cycles de l'école
        // le reste globalement — le tronc commun prime sur l'option.
        if (!existante || (!existante.parDefaut && matiere.parDefaut)) {
          parNom.set(matiere.nom, matiere);
        }
      }
    }
    return [...parNom.values()].filter((m) => !matieresExistantes.includes(m.nom));
  }, [cyclesActifsNoms, matieresExistantes]);

  const [selection, setSelection] = React.useState<string[]>(() =>
    suggestions.filter((m) => m.parDefaut).map((m) => m.nom),
  );
  const [ajoutees, setAjoutees] = React.useState<string[]>([]);
  const [saisieLibre, setSaisieLibre] = React.useState('');
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  function basculer(nom: string) {
    setSelection((prec) =>
      prec.includes(nom) ? prec.filter((n) => n !== nom) : [...prec, nom],
    );
  }

  function ajouter() {
    const nom = saisieLibre.trim();
    if (nom === '') return;
    if (![...ajoutees, ...suggestions.map((s) => s.nom), ...matieresExistantes].includes(nom)) {
      setAjoutees((prec) => [...prec, nom]);
      setSelection((prec) => [...prec, nom]);
    }
    setSaisieLibre('');
  }

  async function valider() {
    setErreur(null);
    setEnCours(true);
    const matieres = selection.map((nom) => ({
      nom,
      code: suggestions.find((s) => s.nom === nom)?.code,
    }));
    const resultat = await creerMatieresAction({ matieres });
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
        {suggestions.map((matiere) => (
          <PuceChoix
            key={matiere.nom}
            selectionne={selection.includes(matiere.nom)}
            onClick={() => basculer(matiere.nom)}
          >
            {matiere.nom}
          </PuceChoix>
        ))}
        {ajoutees.map((nom) => (
          <PuceChoix key={nom} selectionne={selection.includes(nom)} onClick={() => basculer(nom)}>
            {nom}
          </PuceChoix>
        ))}
      </div>

      {matieresExistantes.length > 0 && (
        <p className="text-body-sm text-text-secondary">
          Déjà enregistrées : {matieresExistantes.join(', ')}
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
          placeholder="Ajouter une autre matière"
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
          {enCours ? 'Création…' : `Enregistrer ${selection.length} matière${selection.length > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
