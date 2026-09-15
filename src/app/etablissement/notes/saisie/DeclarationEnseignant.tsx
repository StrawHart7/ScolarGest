'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { mInscrireCommeEnseignantAction } from './actions';

/**
 * « Êtes-vous aussi professeur ? »
 *
 * L'état vide disait au directeur d'aller s'inscrire dans la liste des
 * enseignants « avec son adresse habituelle ». C'était une impasse : la
 * création d'un enseignant ouvre toujours un **nouveau** compte, et Supabase
 * refuse une adresse déjà enregistrée. Il n'avait donc aucun moyen d'arriver
 * au bout.
 *
 * Un bouton, une confirmation, et sa fiche enseignant est rattachée à son
 * propre compte. Restent les matières à s'attribuer — ce qui est un vrai
 * choix, et se fait sur l'écran des affectations.
 */
export function DeclarationEnseignant() {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  if (!confirme) {
    return (
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild variant="secondary">
          <Link href="/etablissement/enseignants">Ouvrir la liste des enseignants</Link>
        </Button>
        <Button type="button" onClick={() => setConfirme(true)}>
          Je suis aussi professeur
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="max-w-prose text-body-sm text-text-secondary">
        Vous allez être ajouté à la liste des enseignants de votre établissement, avec votre compte
        actuel. Vous choisirez ensuite les classes et les matières que vous enseignez : vous ne
        pourrez saisir que celles-là.
      </p>
      {erreur && <p className="text-body-sm text-error">{erreur}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          disabled={enCours}
          onClick={() =>
            demarrer(async () => {
              setErreur(null);
              const reponse = await mInscrireCommeEnseignantAction();
              if ('erreur' in reponse) {
                setErreur(reponse.erreur);
                return;
              }
              // Vers ses affectations : la fiche seule ne débloque rien, c'est
              // la matière attribuée qui ouvre la saisie.
              router.push(`/etablissement/enseignants/${reponse.enseignantId}/affectations`);
            })
          }
        >
          {enCours ? 'Un instant…' : 'Confirmer'}
        </Button>
        <Button type="button" variant="ghost" disabled={enCours} onClick={() => setConfirme(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
