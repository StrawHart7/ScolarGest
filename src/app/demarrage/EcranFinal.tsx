'use client';

import Link from 'next/link';
import { CheckCircle2, PartyPopper, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BilanOnboarding } from '@/services/onboarding';
import type { FormuleProposee } from '@/lib/abonnement-formule';

/**
 * Écran de fin : ce que la configuration a réellement produit.
 *
 * Les chiffres viennent d'un comptage en base, pas d'un cumul au fil des
 * étapes — annoncer « 36 classes » alors que la base en contient 12 serait
 * pire que de ne rien annoncer. Les compteurs à zéro sont masqués : afficher
 * « 0 enseignant » à quelqu'un qui vient de passer l'étape volontairement
 * ressemble à un reproche.
 */
export function EcranFinal({
  bilan,
  onTerminer,
  enCours,
  essaiFinLe,
  formules,
}: {
  bilan: BilanOnboarding;
  onTerminer: () => void;
  enCours: boolean;
  /** Fin de l'essai démarré à l'étape du code de confirmation. */
  essaiFinLe: string | null;
  /** Les deux formules réellement proposables, d'après les cycles activés. */
  formules: FormuleProposee[];
}) {
  const chiffres: { valeur: number; libelle: string }[] = [
    { valeur: bilan.cycles, libelle: bilan.cycles > 1 ? 'cycles activés' : 'cycle activé' },
    { valeur: bilan.classes, libelle: bilan.classes > 1 ? 'classes créées' : 'classe créée' },
    { valeur: bilan.matieres, libelle: bilan.matieres > 1 ? 'matières' : 'matière' },
    {
      valeur: bilan.coefficients,
      libelle: bilan.coefficients > 1 ? 'coefficients définis' : 'coefficient défini',
    },
    {
      valeur: bilan.enseignants,
      libelle: bilan.enseignants > 1 ? 'enseignants invités' : 'enseignant invité',
    },
    { valeur: bilan.eleves, libelle: bilan.eleves > 1 ? 'élèves inscrits' : 'élève inscrit' },
    {
      valeur: bilan.typesFrais,
      libelle: bilan.typesFrais > 1 ? 'types de frais' : 'type de frais',
    },
    { valeur: bilan.tarifs, libelle: bilan.tarifs > 1 ? 'tarifs définis' : 'tarif défini' },
  ].filter((c) => c.valeur > 0);

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center animate-fade-in">
      <span className="relative grid h-16 w-16 place-items-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-tertiary/10 animate-ring-pulse"
        />
        <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-tertiary-container to-tertiary text-white">
          <PartyPopper className="h-7 w-7" aria-hidden />
        </span>
      </span>

      <div>
        <h2 className="text-display-sm text-text-primary">Votre établissement est configuré</h2>
        <p className="mt-1 text-body-md text-text-secondary">
          {bilan.anneeLibelle
            ? `Tout est en place pour l’année ${bilan.anneeLibelle}.`
            : 'Tout est en place.'}
        </p>
      </div>

      {chiffres.length > 0 && (
        <dl className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
          {chiffres.map((c) => (
            <div
              key={c.libelle}
              className="rounded-lg border border-surface-border bg-surface-container-low p-3"
            >
              <dt className="sr-only">{c.libelle}</dt>
              <dd>
                <span className="block text-display-sm tabular-nums text-primary-container">
                  {c.valeur}
                </span>
                <span className="block text-body-sm text-text-secondary">{c.libelle}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* L'essai est annoncé ici, et pas plus tôt : c'est le moment où l'école
          a fini de travailler et où l'information est utile plutôt
          qu'anxiogène. Les tarifs suivent, sans obligation — proposer sans
          bloquer, à un directeur qui vient de saisir toute son école, laisse
          la décision là où elle doit être. */}
      {essaiFinLe && (
        <div className="w-full rounded-xl border border-tertiary/30 bg-tertiary-fixed/30 p-5 text-left">
          <p className="flex items-center gap-2 text-body-md font-medium text-text-primary">
            <Sparkles className="h-4 w-4 shrink-0 text-tertiary" aria-hidden />
            Votre essai gratuit a commencé
          </p>
          <p className="mt-1 text-body-sm text-text-secondary">
            Accès complet et sans restriction jusqu&apos;au{' '}
            {new Date(essaiFinLe).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            . Vous pouvez souscrire dès maintenant, ou plus tard — souscrire ne fait perdre aucun
            jour d&apos;essai.
          </p>

          {formules.length > 0 && (
            <>
              <p className="mt-4 text-label-md uppercase tracking-wide text-text-secondary">
                Votre formule : {formules[0]!.nomFormule}
              </p>
              <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {formules.map((f) => (
                  <div
                    key={f.periodicite}
                    className="rounded-lg border border-surface-border bg-surface-container-lowest p-3"
                  >
                    <dt className="text-body-sm text-text-secondary">
                      {f.periodicite === 'AN' ? 'Engagement annuel' : 'Sans engagement'}
                    </dt>
                    <dd className="text-body-md font-semibold text-text-primary">
                      {f.montantLibelle}
                    </dd>
                    {f.avantage && (
                      <dd className="text-body-sm text-tertiary">{f.avantage}</dd>
                    )}
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={onTerminer} disabled={enCours} className="gap-2">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Aller au tableau de bord
        </Button>
        <Button asChild variant="secondary">
          <Link href="/abonnement/souscrire">Choisir ma formule</Link>
        </Button>
      </div>
    </div>
  );
}
