'use client';

import * as React from 'react';
import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button, SubmitButton } from '@/components/ui/button';
import { DeclencheurCreation } from '@/components/ui/declencheur-creation';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { creerTarifAction } from './actions';

/**
 * « Nouveau tarif » vivait dans une carte sous le tableau : dès que la liste
 * dépassait la hauteur de l'écran, le formulaire devenait inatteignable sans
 * défilement. Il passe en modal, déclenché depuis la barre d'outils.
 */
export function TarifForm({
  anneeScolaireId,
  classes,
  typesFrais,
  defaultClasseId,
}: {
  anneeScolaireId: string;
  classes: { id: string; nom: string }[];
  typesFrais: { id: string; nom: string }[];
  defaultClasseId: string;
}) {
  const [resultat, formAction] = useFormState(creerTarifAction, null);
  const [ouvert, setOuvert] = React.useState(false);
  const { succes, erreur } = useToast();
  const dernier = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!resultat || resultat === dernier.current) return;
    dernier.current = resultat;
    if (resultat === 'OK') {
      setOuvert(false);
      succes('Tarif enregistré', 'Il alimentera les prochaines factures émises.');
    } else {
      erreur('Tarif non enregistré', resultat);
    }
  }, [resultat, succes, erreur]);

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurCreation libelle="Nouveau tarif" onClick={() => setOuvert(true)} />

      <DialogContent>
        <form action={formAction}>
          <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />

          <DialogHeader>
            <DialogTitle>Nouveau tarif</DialogTitle>
            <DialogDescription>
              Un tarif est immuable une fois créé : il ne peut être ni modifié ni supprimé, pour
              préserver l&apos;intégrité des factures déjà émises.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="typeFraisId">Type de frais</Label>
              <Select name="typeFraisId" defaultValue={typesFrais[0]?.id ?? ''}>
                <SelectTrigger id="typeFraisId">
                  <SelectValue placeholder="Sélectionnez un type de frais" />
                </SelectTrigger>
                <SelectContent>
                  {typesFrais.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="classeId">Classe concernée</Label>
              <Select name="classeId" defaultValue={defaultClasseId || classes[0]?.id || ''}>
                <SelectTrigger id="classeId">
                  <SelectValue placeholder="Sélectionnez une classe" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="montant">Montant (FCFA)</Label>
              {/* step={1} : un step utilisé comme pas d'incrément fait rejeter
                  silencieusement par le navigateur tout montant hors multiple. */}
              <Input
                id="montant"
                name="montant"
                type="number" inputMode="numeric"
                min={0}
                step={1}
                placeholder="0"
                required
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
              Enregistrer le tarif
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
