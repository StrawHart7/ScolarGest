'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FormuleProposee } from '@/lib/abonnement-formule';

/**
 * Rappel de fin d'essai. Voir `RappelFinEssai` pour la décision d'affichage.
 *
 * Le refus est mémorisé **par jour** (`localStorage`), pas définitivement :
 * refermer le rappel de J-7 ne doit pas faire sauter celui de J-1. Chaque
 * lecture et chaque écriture est protégée — `localStorage` lève dans certains
 * contextes (navigation privée, cookies bloqués), et un rappel commercial ne
 * doit jamais faire tomber une page.
 *
 * Rendu après montage seulement : lire `localStorage` pendant le rendu serveur
 * produirait une hydratation incohérente, et le rappel clignoterait chez une
 * école qui l'a déjà refermé.
 *
 * **Monté sur le `Dialog` du projet, pas sur une boîte maison.** La première
 * version était un `<div role="dialog">` en `fixed inset-0`, ce qui lui faisait
 * perdre quatre choses que Radix et `dialog.tsx` apportent : la fermeture au
 * clavier (`Escape`) et par clic sur l'arrière-plan, le piégeage du focus, la
 * vraie mécanique de feuille sous `sm` (`85dvh`, donc un contenu qui défile au
 * lieu de déborder), et le décalage clavier de `useKeyboardOffset`. C'est le
 * seul écran de l'application qui s'impose sans avoir été demandé, à un moment
 * de tension pour l'école : une fenêtre qu'on subit doit être irréprochable à
 * fermer.
 *
 * Il n'y a pas de `DialogTrigger` : l'ouverture vient d'une décision serveur,
 * pas d'un clic. L'état est donc piloté.
 */
const CLE = 'sg_rappel_essai';

export function ModaleFinEssai({
  joursRestants,
  formules,
}: {
  joursRestants: number;
  formules: FormuleProposee[];
}) {
  const [visible, setVisible] = React.useState(false);

  const jourCourant = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  React.useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(CLE) !== jourCourant);
    } catch {
      // Stockage indisponible : on montre le rappel. Le montrer une fois de
      // trop vaut mieux que de le taire à une école sur le point de perdre
      // l'écriture.
      setVisible(true);
    }
  }, [jourCourant]);

  const fermer = React.useCallback(() => {
    try {
      window.localStorage.setItem(CLE, jourCourant);
    } catch {
      // Sans mémoire du refus, le rappel réapparaîtra : gênant, pas grave.
    }
    setVisible(false);
  }, [jourCourant]);

  const urgent = joursRestants <= 1;
  const annuelle = formules.find((f) => f.periodicite === 'AN');
  const mensuelle = formules.find((f) => f.periodicite === 'MOIS');

  return (
    // `onOpenChange` reçoit toutes les fermetures — croix, `Escape`, clic sur
    // l'arrière-plan — et chacune doit mémoriser le refus du jour. Câbler
    // seulement le bouton laisserait revenir le rappel après une fermeture au
    // clavier.
    <Dialog open={visible} onOpenChange={(ouvert) => !ouvert && fermer()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-fixed">
              <Sparkles className="h-5 w-5 text-primary-container" aria-hidden />
            </span>
            <div className="min-w-0">
              <DialogTitle>
                {urgent
                  ? joursRestants <= 0
                    ? 'Votre essai se termine aujourd’hui'
                    : 'Dernier jour d’essai'
                  : `Il vous reste ${joursRestants} jours d’essai`}
              </DialogTitle>
              {/* Décrit exactement ce que la lecture seule retire, et rien de
                  plus. Annoncer une perte de données serait faux, et la
                  première école à le constater aurait raison de se méfier du
                  reste. */}
              <DialogDescription className="mt-1">
                À la fin de l’essai, votre espace passe en lecture seule : vos données restent
                consultables et vos documents imprimables, mais la saisie des notes, des
                inscriptions et des encaissements s’arrête.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {formules.length > 0 && (
          <DialogBody>
            <p className="text-label-md uppercase tracking-wide text-text-secondary">
              Votre formule : {formules[0]!.nomFormule}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {annuelle && (
                <div className="rounded-lg border border-tertiary/30 bg-tertiary-fixed/30 p-3">
                  <p className="text-body-sm text-text-secondary">Engagement annuel</p>
                  <p className="text-body-md font-semibold text-text-primary">
                    {annuelle.montantLibelle}
                  </p>
                  <p className="text-body-sm text-tertiary">{annuelle.avantage}</p>
                </div>
              )}
              {mensuelle && (
                <div className="rounded-lg border border-surface-border p-3">
                  <p className="text-body-sm text-text-secondary">Sans engagement</p>
                  <p className="text-body-md font-semibold text-text-primary">
                    {mensuelle.montantLibelle}
                  </p>
                </div>
              )}
            </div>
          </DialogBody>
        )}

        <DialogFooter className="justify-between">
          <button
            type="button"
            onClick={fermer}
            className="rounded px-1 text-body-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            Plus tard
          </button>
          <Button asChild>
            <Link href="/abonnement/souscrire" onClick={fermer}>
              Souscrire maintenant
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
