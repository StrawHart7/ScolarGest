'use client';

import { Power } from 'lucide-react';
import { ConfirmationPin } from '@/components/ui/confirmation-pin';
import { activerCycleAction } from './actions';

export function ActiverCycleButton({ cycleId, nom }: { cycleId: string; nom: string }) {
  return (
    <ConfirmationPin
      action={activerCycleAction}
      champsCaches={{ cycleId }}
      declencheur="Activer"
      iconeDeclencheur={<Power className="h-3.5 w-3.5" aria-hidden />}
      titre={`Activer le cycle ${nom}`}
      description="Le cycle sera proposé à la création des classes et du programme."
      consequence="Cette activation est définitive : un cycle activé ne peut plus être désactivé ni modifié."
      libelleValidation="Activer le cycle"
      messageSucces={`Cycle ${nom} activé`}
    />
  );
}
