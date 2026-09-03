'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  function fermer() {
    try {
      window.localStorage.setItem(CLE, jourCourant);
    } catch {
      // Sans mémoire du refus, le rappel réapparaîtra : gênant, pas grave.
    }
    setVisible(false);
  }

  if (!visible) return null;

  const urgent = joursRestants <= 1;
  const annuelle = formules.find((f) => f.periodicite === 'AN');
  const mensuelle = formules.find((f) => f.periodicite === 'MOIS');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titre-rappel-essai"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-surface-border bg-surface-container-lowest p-6 shadow-elevated">
        <button
          type="button"
          onClick={fermer}
          aria-label="Fermer le rappel"
          className="absolute right-4 top-4 rounded-lg p-1 text-text-secondary transition-colors hover:bg-surface-container hover:text-text-primary"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-fixed">
          <Sparkles className="h-5 w-5 text-primary-container" aria-hidden />
        </span>

        <h2 id="titre-rappel-essai" className="mt-4 text-display-sm text-text-primary">
          {urgent
            ? joursRestants <= 0
              ? 'Votre essai se termine aujourd’hui'
              : 'Dernier jour d’essai'
            : `Il vous reste ${joursRestants} jours d’essai`}
        </h2>

        {/* Décrit exactement ce que la lecture seule retire, et rien de plus.
            Annoncer une perte de données serait faux, et la première école à
            le constater aurait raison de se méfier du reste. */}
        <p className="mt-2 text-body-md text-text-secondary">
          À la fin de l’essai, votre espace passe en lecture seule : vos données restent
          consultables et vos documents imprimables, mais la saisie des notes, des inscriptions et
          des encaissements s’arrête.
        </p>

        {formules.length > 0 && (
          <div className="mt-5">
            <p className="text-label-md uppercase tracking-wide text-text-secondary">
              Votre formule : {formules[0]!.nomFormule}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/abonnement/souscrire" onClick={fermer}>
              Souscrire maintenant
            </Link>
          </Button>
          <button
            type="button"
            onClick={fermer}
            className="text-body-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
