'use client';

import * as React from 'react';
import { useFormState } from 'react-dom';
import { Pencil, Power } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button, SubmitButton } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import type { TypeFrais } from '@/services/type-frais';
import { modifierTypeFraisAction } from './actions';

export function TypeFraisRowActions({ typeFrais }: { typeFrais: TypeFrais }) {
  const [resultat, formAction] = useFormState(modifierTypeFraisAction, null);
  const [ouvert, setOuvert] = React.useState(false);
  const [bascule, demarrerBascule] = React.useTransition();
  const { succes, erreur } = useToast();
  const dernier = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!resultat || resultat === dernier.current) return;
    dernier.current = resultat;
    if (resultat === 'OK') {
      setOuvert(false);
      succes('Type de frais modifié');
    } else {
      erreur('Modification refusée', resultat);
    }
  }, [resultat, succes, erreur]);

  const basculerStatut = () => {
    const donnees = new FormData();
    donnees.set('id', typeFrais.id);
    donnees.set('statut', typeFrais.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF');
    demarrerBascule(async () => {
      const reponse = await modifierTypeFraisAction(null, donnees);
      if (reponse === 'OK') {
        succes(typeFrais.statut === 'ACTIF' ? 'Type de frais désactivé' : 'Type de frais activé');
      } else if (reponse) {
        erreur('Changement de statut refusé', reponse);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <Button size="sm" variant="secondary" onClick={() => setOuvert(true)}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Modifier
        </Button>

        <DialogContent taille="sm">
          <form action={formAction}>
            <input type="hidden" name="id" value={typeFrais.id} />
            <DialogHeader>
              <DialogTitle>Modifier le type de frais</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`nom-${typeFrais.id}`}>Libellé</Label>
                <Input
                  id={`nom-${typeFrais.id}`}
                  name="nom"
                  defaultValue={typeFrais.nom}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`description-${typeFrais.id}`}>Description</Label>
                <Input
                  id={`description-${typeFrais.id}`}
                  name="description"
                  defaultValue={typeFrais.description ?? ''}
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="sm">
                  Annuler
                </Button>
              </DialogClose>
              <SubmitButton size="sm" libelleEnCours="Enregistrement…">
                Enregistrer
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Button size="sm" variant="ghost" chargement={bascule} onClick={basculerStatut}>
        <Power className="h-3.5 w-3.5" aria-hidden />
        {typeFrais.statut === 'ACTIF' ? 'Désactiver' : 'Activer'}
      </Button>
    </div>
  );
}
