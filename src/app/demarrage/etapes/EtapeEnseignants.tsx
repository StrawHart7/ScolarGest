'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErreurEtape, PuceChoix } from '../Bulles';
import { inviterEnseignantsAction } from '../actions';

interface Ligne {
  nom: string;
  prenoms: string;
  sexe: 'M' | 'F';
  email: string;
}

const LIGNE_VIDE: Ligne = { nom: '', prenoms: '', sexe: 'M', email: '' };

/**
 * `createEnseignant` invite toujours un compte : l'email est obligatoire, et
 * l'année scolaire l'est aussi puisqu'elle sert de séquence au matricule.
 * L'étape reste facultative — une école peut très bien ajouter ses enseignants
 * plus tard, depuis l'écran dédié.
 */
export function EtapeEnseignants({
  anneeScolaireId,
  onTermine,
}: {
  anneeScolaireId: string;
  onTermine: () => void;
}) {
  const [lignes, setLignes] = React.useState<Ligne[]>([{ ...LIGNE_VIDE }]);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  function modifier(index: number, champ: keyof Ligne, valeur: string) {
    setLignes((prec) =>
      prec.map((ligne, i) => (i === index ? { ...ligne, [champ]: valeur } : ligne)),
    );
  }

  const completes = lignes.filter(
    (l) => l.nom.trim() && l.prenoms.trim() && l.email.trim(),
  );

  async function valider() {
    setErreur(null);
    setEnCours(true);
    const resultat = await inviterEnseignantsAction({
      anneeScolaireId,
      enseignants: completes,
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
      {lignes.map((ligne, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <Input
            value={ligne.nom}
            onChange={(e) => modifier(index, 'nom', e.target.value)}
            placeholder="Nom"
            aria-label={`Nom de l'enseignant ${index + 1}`}
            className="h-9 w-32"
          />
          <Input
            value={ligne.prenoms}
            onChange={(e) => modifier(index, 'prenoms', e.target.value)}
            placeholder="Prénoms"
            aria-label={`Prénoms de l'enseignant ${index + 1}`}
            className="h-9 w-36"
          />
          <div
            role="group"
            aria-label={`Sexe de l'enseignant ${index + 1}`}
            className="flex gap-1"
          >
            {(['M', 'F'] as const).map((sexe) => (
              <PuceChoix
                key={sexe}
                selectionne={ligne.sexe === sexe}
                onClick={() => modifier(index, 'sexe', sexe)}
              >
                {sexe}
              </PuceChoix>
            ))}
          </div>
          <Input
            type="email"
            value={ligne.email}
            onChange={(e) => modifier(index, 'email', e.target.value)}
            placeholder="email@ecole.tg"
            aria-label={`Email de l'enseignant ${index + 1}`}
            className="h-9 min-w-[12rem] flex-1"
          />
          {lignes.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Retirer l'enseignant ${index + 1}`}
              onClick={() => setLignes((prec) => prec.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      ))}

      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setLignes((prec) => [...prec, { ...LIGNE_VIDE }])}
          className="gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter un enseignant
        </Button>
      </div>

      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || completes.length === 0}>
          {enCours ? 'Envoi…' : `Inviter ${completes.length} enseignant${completes.length > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
