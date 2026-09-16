'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { Classe } from '@/services/classe';
import { changerClasseAction, inscrireEleve } from './actions';

function SubmitButton({ libelle, enCours }: { libelle: string; enCours: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? enCours : libelle}
    </Button>
  );
}

/**
 * Un seul écran pour deux gestes : inscrire, et changer de classe.
 *
 * Vu de l'école, la question est la même — « dans quelle classe est cet
 * élève ? ». Ce qui change est ce que la plateforme doit faire derrière :
 * créer une inscription, ou en modifier une qui existe déjà. C'est la page qui
 * tranche, puisqu'elle a lu l'état de l'élève ; le formulaire reçoit la
 * réponse au lieu de la deviner.
 *
 * `inscriptionExistante` est non nul dès qu'une ligne existe pour l'année
 * active, **quel que soit son statut**. La contrainte
 * `unique(eleveId, anneeScolaireId)` interdit d'en créer une seconde, et c'est
 * précisément ce qui enfermait le testeur : annuler puis « Inscrire » menait à
 * « Cet élève est déjà inscrit ».
 */
export function InscriptionForm({
  eleveId,
  anneeScolaireId,
  classes,
  inscriptionExistante,
}: {
  eleveId: string;
  anneeScolaireId: string;
  classes: Classe[];
  inscriptionExistante?: { id: string; classeId: string; annulee: boolean } | null;
}) {
  const changement = inscriptionExistante ?? null;
  const [error, formAction] = useFormState(
    changement ? changerClasseAction : inscrireEleve,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="eleveId" value={eleveId} />
      <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
      {changement && <input type="hidden" name="inscriptionId" value={changement.id} />}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="classeId">Classe</Label>
        {/* La classe actuelle est pré-sélectionnée : on vient ici pour la
            changer, pas pour la ressaisir de mémoire. */}
        <Select name="classeId" required defaultValue={changement?.classeId}>
          <SelectTrigger id="classeId">
            <SelectValue placeholder="Choisir une classe" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nom} — {c.niveau.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-surface-border bg-surface-container-low p-3 text-body-sm text-text-secondary">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {/* Dire ce qui va arriver à l'argent, avant de cliquer. Un directeur qui
            change un élève de classe ne pense pas spontanément à sa facture ; il
            la découvrirait au recouvrement. */}
        {changement ? (
          <p>
            La facture est refaite avec les tarifs de la nouvelle classe, et les versements déjà
            encaissés y sont reportés. L&apos;ancienne facture est conservée, marquée annulée. Les
            reçus déjà remis restent valables.
          </p>
        ) : (
          <p>
            La facture est générée automatiquement à partir des tarifs configurés pour cette classe.
            Si aucun tarif n&apos;est encore configuré, une facture à 0 FCFA sera créée (à corriger
            ultérieurement en Finances).
          </p>
        )}
      </div>

      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex justify-end">
        {changement ? (
          <SubmitButton
            libelle={changement.annulee ? "Réinscrire dans cette classe" : 'Changer de classe'}
            enCours="Enregistrement..."
          />
        ) : (
          <SubmitButton libelle="Confirmer l'inscription" enCours="Inscription..." />
        )}
      </div>
    </form>
  );
}
