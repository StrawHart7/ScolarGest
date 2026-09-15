'use client';

import * as React from 'react';
import { KeyRound } from 'lucide-react';
import { Button, SubmitButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { reinitialiser } from './actions';

/**
 * Redonner un mot de passe à quelqu'un qui n'a pas d'adresse email.
 *
 * `ConfirmationPin` ne convient pas ici : il ferme la fenêtre et annonce le
 * succès par un message éphémère. Or ce qu'il faut rendre, c'est **un mot de
 * passe à recopier** — un message qui s'efface tout seul au bout de quelques
 * secondes le ferait perdre, et il n'y a aucun moyen de le relire.
 *
 * La fenêtre reste donc ouverte et change de contenu : le PIN d'abord, le mot
 * de passe ensuite, et un bouton pour fermer quand c'est noté.
 */
export function ReinitialiserMotDePasse({
  utilisateurId,
  nomComplet,
}: {
  utilisateurId: string;
  nomComplet: string;
}) {
  const [ouvert, setOuvert] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [motDePasse, setMotDePasse] = React.useState<string | null>(null);

  const soumettre = async (donnees: FormData) => {
    setErreur(null);
    const resultat = await reinitialiser(utilisateurId, String(donnees.get('pin') ?? ''));
    if (resultat?.etat === 'FAIT') setMotDePasse(resultat.motDePasse);
    else setErreur(resultat?.message ?? 'Erreur lors de la réinitialisation');
  };

  const fermer = (etat: boolean) => {
    setOuvert(etat);
    if (!etat) {
      setErreur(null);
      setMotDePasse(null);
    }
  };

  return (
    <Dialog open={ouvert} onOpenChange={fermer}>
      <Button variant="ghost" size="sm" onClick={() => setOuvert(true)}>
        <KeyRound className="h-4 w-4" aria-hidden />
        Nouveau mot de passe
      </Button>

      <DialogContent taille="sm">
        {motDePasse ? (
          <>
            <DialogHeader>
              <DialogTitle>Le nouveau mot de passe</DialogTitle>
              <DialogDescription>
                Notez-le et remettez-le à {nomComplet}. Il ne s&apos;affichera plus.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <p className="select-all rounded-lg border border-surface-border bg-surface-container/50 p-3 text-center font-mono text-headline-sm text-text-primary">
                {motDePasse}
              </p>
              <p className="text-body-sm text-text-secondary">
                L&apos;ancien mot de passe ne fonctionne plus. Demandez-lui de le changer depuis son
                profil après sa première connexion.
              </p>
            </DialogBody>
            <DialogFooter>
              <Button type="button" size="sm" onClick={() => fermer(false)}>
                C&apos;est noté
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form action={soumettre}>
            <DialogHeader>
              <DialogTitle>Redonner un mot de passe</DialogTitle>
              <DialogDescription>
                {nomComplet} se connecte par identifiant : elle ne peut pas récupérer son mot de
                passe toute seule.
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`pin-${utilisateurId}`}>PIN de confirmation</Label>
                <Input
                  id={`pin-${utilisateurId}`}
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\d{6}"
                  autoComplete="off"
                  required
                  autoFocus
                />
                {erreur && <p className="text-body-sm text-error">{erreur}</p>}
              </div>
            </DialogBody>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="sm">
                  Annuler
                </Button>
              </DialogClose>
              <SubmitButton size="sm" libelleEnCours="Un instant…">
                Générer
              </SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
