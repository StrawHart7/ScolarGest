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
import type { Matiere } from '@/services/matiere';
import { modifierMatiereAction } from './actions';

export function MatiereRowActions({ matiere }: { matiere: Matiere }) {
  const [resultat, formAction] = useFormState(modifierMatiereAction, null);
  const [ouvert, setOuvert] = React.useState(false);
  const [bascule, demarrerBascule] = React.useTransition();
  const { succes, erreur } = useToast();
  const dernier = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!resultat || resultat === dernier.current) return;
    dernier.current = resultat;
    if (resultat === 'OK') {
      setOuvert(false);
      succes('Matière modifiée');
    } else {
      erreur('Modification refusée', resultat);
    }
  }, [resultat, succes, erreur]);

  const basculerStatut = () => {
    const donnees = new FormData();
    donnees.set('id', matiere.id);
    donnees.set('statut', matiere.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF');
    demarrerBascule(async () => {
      const reponse = await modifierMatiereAction(null, donnees);
      if (reponse === 'OK') {
        succes(matiere.statut === 'ACTIF' ? 'Matière désactivée' : 'Matière activée');
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
            <input type="hidden" name="id" value={matiere.id} />
            <DialogHeader>
              <DialogTitle>Modifier la matière</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`nom-${matiere.id}`}>Nom</Label>
                <Input id={`nom-${matiere.id}`} name="nom" defaultValue={matiere.nom} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`code-${matiere.id}`}>Code</Label>
                <Input id={`code-${matiere.id}`} name="code" defaultValue={matiere.code ?? ''} />
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
        {matiere.statut === 'ACTIF' ? 'Désactiver' : 'Activer'}
      </Button>
    </div>
  );
}
