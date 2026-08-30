'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Stamp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { enregistrerFiligraneAction } from '@/app/etablissement/documents/actions';

/**
 * Proposée une seule fois, avant la première génération de document : logo et
 * filigrane sont plus faciles à poser *avant* d'avoir imprimé une pile de
 * bulletins sans eux.
 *
 * « Ne plus proposer » enregistre des paramètres vides, ce qui crée la ligne
 * `parametres_document` — son existence vaut « déjà proposé ». Le réglage
 * reste modifiable dans Établissement → Identité des documents : une question
 * posée une fois ne doit pas devenir une décision verrouillée à vie.
 */
export function InviteIdentiteDocuments() {
  const router = useRouter();
  const { erreur: toastErreur } = useToast();
  const [masquee, setMasquee] = React.useState(false);
  const [enCours, setEnCours] = React.useState(false);

  if (masquee) return null;

  async function nePlusProposer() {
    setEnCours(true);
    try {
      const resultat = await enregistrerFiligraneAction({
        filigraneTexte: null,
        filigraneActif: false,
      });
      if (resultat && !resultat.ok) {
        toastErreur(resultat.message);
        setEnCours(false);
        return;
      }
      setMasquee(true);
      router.refresh();
    } catch {
      // Une Server Action interrompue ne doit pas laisser le bouton figé.
      toastErreur('Connexion interrompue. Réessayez.');
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary-container/25 bg-primary-container/5 p-4">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-container/10 text-primary-container"
      >
        <Stamp className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-md font-medium text-text-primary">
          Personnaliser vos bulletins et reçus
        </p>
        <p className="text-body-sm text-text-secondary">
          Ajoutez le logo de votre établissement et, si vous le souhaitez, un filigrane en fond de
          page. Vous pourrez le modifier à tout moment.
        </p>
      </div>
      <Button asChild size="sm" className="gap-2">
        <Link href="/etablissement/documents">
          Configurer
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={enCours} onClick={nePlusProposer}>
        Ne plus proposer
      </Button>
    </div>
  );
}
