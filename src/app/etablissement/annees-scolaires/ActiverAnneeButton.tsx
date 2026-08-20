'use client';

import { Lock, Play } from 'lucide-react';
import { ConfirmationPin } from '@/components/ui/confirmation-pin';
import type { BilanCloture } from '@/services/annee-scolaire';
import { activerAnnee, cloturerAnnee } from './actions';

const fcfa = (montant: number) => `${Number(montant).toLocaleString('fr-FR')} FCFA`;

export function ActiverAnneeButton({
  anneeScolaireId,
  libelle,
  anneeActiveLibelle,
}: {
  anneeScolaireId: string;
  libelle: string;
  /** Libellé de l'année encore active, s'il y en a une. */
  anneeActiveLibelle?: string;
}) {
  return (
    <ConfirmationPin
      action={activerAnnee}
      champsCaches={{ anneeScolaireId }}
      declencheur="Activer"
      iconeDeclencheur={<Play className="h-3.5 w-3.5" aria-hidden />}
      titre={`Activer l'année ${libelle}`}
      description="Toutes les inscriptions, notes et factures créées ensuite seront rattachées à cette année."
      consequence={
        anneeActiveLibelle
          ? `L'année ${anneeActiveLibelle} est encore active. Clôturez-la d'abord : une activation ne clôture plus l'année en cours à votre insu.`
          : undefined
      }
      libelleValidation="Activer l'année"
      messageSucces={`Année ${libelle} activée`}
      desactive={Boolean(anneeActiveLibelle)}
    />
  );
}

export function CloturerAnneeButton({
  anneeScolaireId,
  libelle,
  bilan,
}: {
  anneeScolaireId: string;
  libelle: string;
  bilan: BilanCloture;
}) {
  const suspens: string[] = [];
  if (bilan.notesEnAttente > 0) {
    suspens.push(`${bilan.notesEnAttente} demande(s) d'approbation de notes non traitée(s)`);
  }
  if (bilan.facturesNonSoldees > 0) {
    suspens.push(
      `${bilan.facturesNonSoldees} facture(s) non soldée(s), soit ${fcfa(bilan.resteARecouvrer)} à recouvrer`,
    );
  }

  return (
    <ConfirmationPin
      action={cloturerAnnee}
      champsCaches={{ anneeScolaireId }}
      declencheur="Clôturer"
      iconeDeclencheur={<Lock className="h-3.5 w-3.5" aria-hidden />}
      varianteDeclencheur="destructive"
      titre={`Clôturer l'année ${libelle}`}
      description="L'année passe en TERMINEE. Ses données restent consultables et exportables, mais l'établissement n'aura plus d'année active tant qu'une autre n'est pas activée."
      consequence={
        suspens.length > 0
          ? `Restent en suspens : ${suspens.join(' ; ')}. La clôture ne les efface pas, elle les fige en l'état.`
          : 'La clôture est irréversible.'
      }
      libelleValidation="Clôturer l'année"
      messageSucces={`Année ${libelle} clôturée`}
    />
  );
}
