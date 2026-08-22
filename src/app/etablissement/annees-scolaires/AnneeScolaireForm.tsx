'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { FormulaireModal } from '@/components/ui/form-modal';
import { creerAnneeScolaire } from './actions';

export function AnneeScolaireForm() {
  const anneeCourante = new Date().getFullYear();

  return (
    <FormulaireModal
      action={creerAnneeScolaire}
      titre="Nouvelle année scolaire"
      description="L'année est créée en statut PRÉPARATION ; elle devra être activée séparément, avec votre PIN."
      declencheur="Nouvelle année scolaire"
      declencheurFlottant
      libelleValidation="Créer l'année scolaire"
      messageSucces="Année scolaire créée"
      detailSucces="Activez-la lorsque vous serez prêt."
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="libelle">Libellé</Label>
        <Input
          id="libelle"
          name="libelle"
          placeholder={`${anneeCourante}-${anneeCourante + 1}`}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateDebut">Date de début</Label>
          <DatePicker
            id="dateDebut"
            name="dateDebut"
            anneeMin={anneeCourante - 5}
            anneeMax={anneeCourante + 5}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateFin">Date de fin</Label>
          <DatePicker
            id="dateFin"
            name="dateFin"
            anneeMin={anneeCourante - 5}
            anneeMax={anneeCourante + 5}
          />
        </div>
      </div>
    </FormulaireModal>
  );
}
