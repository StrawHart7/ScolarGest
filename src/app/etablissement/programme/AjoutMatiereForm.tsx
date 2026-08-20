'use client';

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FormulaireModal } from '@/components/ui/form-modal';
import { ajouterAuProgrammeAction } from './actions';

export function AjoutMatiereForm({
  niveauId,
  niveauNom,
  matieresDisponibles,
  prochainOrdre,
}: {
  niveauId: string;
  niveauNom: string;
  matieresDisponibles: { id: string; nom: string; code: string | null }[];
  /**
   * L'ordre n'est plus saisi : il ne servait qu'à ordonner l'affichage, ce que
   * l'ordre alphabétique fait sans demander une décision à l'utilisateur. On
   * conserve la valeur pour l'action, qui alimente encore la colonne en base.
   */
  prochainOrdre: number;
}) {
  if (matieresDisponibles.length === 0) {
    return (
      <p className="text-body-sm text-text-secondary">
        Toutes les matières actives du catalogue font déjà partie du programme de ce niveau.
      </p>
    );
  }

  return (
    <FormulaireModal
      action={ajouterAuProgrammeAction}
      titre={`Ajouter une matière — ${niveauNom}`}
      description="La matière entrera dans le calcul des moyennes de ce niveau dès qu'un coefficient lui sera donné."
      declencheur="Ajouter une matière"
      libelleValidation="Ajouter au programme"
      messageSucces="Matière ajoutée au programme"
      detailSucces="Pensez à définir son coefficient."
    >
      <input type="hidden" name="niveauId" value={niveauId} />
      <input type="hidden" name="ordreAffichage" value={prochainOrdre} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="matiereId">Matière</Label>
        <Select name="matiereId" required>
          <SelectTrigger id="matiereId">
            <SelectValue placeholder="Choisir une matière" />
          </SelectTrigger>
          <SelectContent>
            {matieresDisponibles.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nom}
                {m.code ? ` (${m.code})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="obligatoire" name="obligatoire" defaultChecked />
        <Label htmlFor="obligatoire" className="cursor-pointer">
          Matière obligatoire
        </Label>
      </div>
      <p className="text-body-sm text-text-secondary">
        Une matière facultative n&apos;entre dans la moyenne que si l&apos;élève y a une note.
      </p>
    </FormulaireModal>
  );
}
