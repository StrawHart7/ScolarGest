'use client';

import * as React from 'react';
import { useFormState } from 'react-dom';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, SubmitButton, type ButtonProps } from './button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { useToast } from './toast';

/**
 * Un formulaire de création logé dans un modal.
 *
 * Les formulaires « nouveau X » vivaient dans une carte au-dessus ou au-dessous
 * du tableau : sur une liste un peu longue, le formulaire devenait
 * inatteignable sans défilement, et rien ne confirmait la création.
 *
 * La Server Action doit renvoyer la chaîne `'OK'` en cas de succès et le
 * message d'erreur sinon.
 */
export type ActionFormulaire = (
  etatPrecedent: string | null,
  donnees: FormData,
) => Promise<string | null>;

export interface FormulaireModalProps {
  action: ActionFormulaire;
  titre: string;
  description?: string;
  /** Libellé du bouton qui ouvre le modal. */
  declencheur: string;
  iconeDeclencheur?: React.ReactNode;
  varianteDeclencheur?: ButtonProps['variant'];
  tailleDeclencheur?: ButtonProps['size'];
  /**
   * Sous `md`, présente l'action principale comme un bouton flottant (FAB)
   * au-dessus de la barre de navigation — comme les listes qui mènent à une
   * page de création. Le bouton normal reste en place sur desktop. À réserver
   * à l'action de création principale d'une page de liste.
   */
  declencheurFlottant?: boolean;
  libelleValidation?: string;
  messageSucces: string;
  detailSucces?: string;
  taille?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function FormulaireModal({
  action,
  titre,
  description,
  declencheur,
  iconeDeclencheur,
  varianteDeclencheur = 'primary',
  tailleDeclencheur = 'sm',
  declencheurFlottant = false,
  libelleValidation,
  messageSucces,
  detailSucces,
  taille = 'md',
  children,
}: FormulaireModalProps) {
  const [resultat, formAction] = useFormState(action, null);
  const [ouvert, setOuvert] = React.useState(false);
  const { succes, erreur } = useToast();
  const dernier = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!resultat || resultat === dernier.current) return;
    dernier.current = resultat;
    if (resultat === 'OK') {
      setOuvert(false);
      succes(messageSucces, detailSucces);
    } else {
      erreur('Échec de l’enregistrement', resultat);
    }
  }, [resultat, succes, erreur, messageSucces, detailSucces]);

  // Le formulaire est remonté à chaque ouverture pour repartir de champs
  // vides après une création réussie.
  return (
    <Dialog
      open={ouvert}
      onOpenChange={(etat) => {
        setOuvert(etat);
        if (etat) dernier.current = null;
      }}
    >
      <Button
        variant={varianteDeclencheur}
        size={tailleDeclencheur}
        onClick={() => setOuvert(true)}
        className={declencheurFlottant ? 'max-md:hidden' : undefined}
      >
        {iconeDeclencheur ?? <Plus className="h-4 w-4" aria-hidden />}
        {declencheur}
      </Button>

      {/* Sous `md`, l'action de création devient un bouton flottant, aligné sur
          celui des listes qui mènent à une page (voir `BoutonFlottant`), plutôt
          que de s'étaler dans la barre d'outils. */}
      {declencheurFlottant && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label={declencheur}
          title={declencheur}
          className={cn(
            'fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-30 md:hidden',
            'grid h-14 w-14 place-items-center rounded-2xl',
            'bg-primary-container text-white shadow-lg transition-all duration-200',
            'hover:bg-primary active:scale-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50 focus-visible:ring-offset-2',
          )}
        >
          {iconeDeclencheur ?? <Plus className="h-6 w-6" aria-hidden />}
        </button>
      )}

      <DialogContent taille={taille}>
        <form action={formAction} key={ouvert ? 'ouvert' : 'ferme'}>
          <DialogHeader>
            <DialogTitle>{titre}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <DialogBody>{children}</DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Annuler
              </Button>
            </DialogClose>
            <SubmitButton size="sm" libelleEnCours="Enregistrement…">
              {libelleValidation ?? 'Enregistrer'}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
