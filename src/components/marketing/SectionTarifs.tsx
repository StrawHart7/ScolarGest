'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/motion/Reveal';
import {
  JOURS_ESSAI_GRATUIT,
  REMISE_ANNUELLE_POURCENT,
  formaterFCFA,
  prixPourCycles,
  type Periodicite,
} from '@/lib/tarifs';
import { cn } from '@/lib/utils';

/**
 * Grille tarifaire publique.
 *
 * Les trois colonnes ne sont pas des paliers de fonctionnalités — il n'y en a
 * qu'un seul produit, et une petite école a besoin des mêmes bulletins qu'une
 * grande. Elles reflètent la seule chose qui fait réellement varier le prix :
 * **le nombre de cycles exploités**. Inventer un palier « Basic » amputé de la
 * facturation ou des bulletins vendrait un logiciel de gestion scolaire qui ne
 * gère pas une école.
 *
 * La troisième colonne est un vrai cas, pas un remplissage : un groupe de
 * plusieurs établissements distincts sort du modèle mono-tenant et relève d'un
 * devis.
 */

interface Offre {
  nom: string;
  sousTitre: string;
  /** `null` pour une offre sur devis. */
  cycles: number | null;
  mise_en_avant: boolean;
  inclus: string[];
  cta: string;
}

const OFFRES: Offre[] = [
  {
    nom: 'Un cycle',
    sousTitre: 'Pour un collège seul ou un lycée seul.',
    cycles: 1,
    mise_en_avant: false,
    inclus: [
      'Élèves, responsables et inscriptions',
      'Enseignants et affectations',
      'Notes, moyennes et bulletins officiels',
      'Facturation, paiements et reçus',
      'Comptes Directeur, Secrétaire, Comptable, Enseignant',
      'Utilisateurs et effectifs illimités',
    ],
    cta: 'Commencer',
  },
  {
    nom: 'Collège et lycée',
    sousTitre: 'Pour un complexe scolaire couvrant les deux cycles.',
    cycles: 2,
    mise_en_avant: true,
    inclus: [
      'Tout ce que comprend l’offre à un cycle',
      'Les deux cycles dans un seul espace',
      'Passage de la 3ème à la 2nde sans ressaisie',
      'Enseignants partagés entre collège et lycée',
      'Trésorerie et tableaux de bord consolidés',
    ],
    cta: 'Commencer',
  },
  {
    nom: 'Groupe scolaire',
    sousTitre: 'Pour plusieurs établissements distincts.',
    cycles: null,
    mise_en_avant: false,
    inclus: [
      'Un espace isolé par établissement',
      'Accompagnement à la reprise de données',
      'Formation des équipes',
      'Facturation groupée',
    ],
    cta: 'Nous contacter',
  },
];

export function SectionTarifs() {
  const [periodicite, setPeriodicite] = React.useState<Periodicite>('AN');
  const annuel = periodicite === 'AN';

  return (
    <section
      className="border-t border-surface-border bg-surface-container-low px-4 py-16 sm:px-6 sm:py-20 lg:px-container-pad lg:py-24"
      id="tarifs"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="text-center">
            <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-text-primary sm:mb-6 sm:text-3xl md:text-4xl">
              Un prix par cycle, sans surprise
            </h2>
            <p className="mx-auto max-w-2xl text-base text-text-secondary sm:text-lg">
              Pas de palier caché, pas de facturation à l’élève. Vous payez pour les cycles que
              vous enseignez, et {JOURS_ESSAI_GRATUIT} jours d’essai gratuit vous laissent tout
              configurer avant de décider.
            </p>
          </div>

          {/* Bascule de périodicité. Deux vrais boutons plutôt qu'un
              interrupteur : « annuel » et « mensuel » sont deux choix nommés,
              pas un réglage actif/inactif dont on devine le sens. */}
          <div
            className="mx-auto mt-8 flex w-fit items-center rounded-full border border-surface-border bg-surface-container-lowest p-1 shadow-sm sm:mt-10"
            role="group"
            aria-label="Périodicité de facturation"
          >
            <button
              type="button"
              onClick={() => setPeriodicite('AN')}
              aria-pressed={annuel}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:px-5',
                annuel
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-primary',
              )}
            >
              Annuel
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  annuel ? 'bg-white/20 text-white' : 'bg-primary-fixed text-primary',
                )}
              >
                -{REMISE_ANNUELLE_POURCENT}%
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPeriodicite('MOIS')}
              aria-pressed={!annuel}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors sm:px-5',
                !annuel
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-primary',
              )}
            >
              Mensuel
            </button>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 items-start gap-6 sm:mt-14 lg:grid-cols-3 lg:gap-8">
          {OFFRES.map((offre, i) => (
            <Reveal key={offre.nom} delayMs={i * 80}>
              <div
                className={cn(
                  'relative flex h-full flex-col rounded-2xl border bg-surface-container-lowest p-6 transition-all duration-300 sm:p-8',
                  offre.mise_en_avant
                    ? 'border-primary shadow-lg lg:-mt-4 lg:pb-10 lg:pt-12'
                    : 'border-surface-border shadow-sm hover:-translate-y-1 hover:shadow-md',
                )}
              >
                {offre.mise_en_avant && (
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    Le plus courant
                  </span>
                )}

                <h3 className="text-lg font-bold text-text-primary sm:text-xl">{offre.nom}</h3>
                <p className="mt-1 min-h-[2.5rem] text-sm text-text-secondary">
                  {offre.sousTitre}
                </p>

                <div className="mt-6 border-b border-surface-border pb-6">
                  {offre.cycles === null ? (
                    <>
                      <p className="text-3xl font-extrabold text-text-primary">Sur devis</p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Selon le nombre d’établissements.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold text-text-primary sm:text-4xl">
                          {formaterFCFA(prixPourCycles(offre.cycles, periodicite))}
                        </span>
                        <span className="text-sm text-text-secondary">
                          {annuel ? '/an' : '/mois'}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {annuel
                          ? `Soit ${formaterFCFA(Math.round(prixPourCycles(offre.cycles, 'AN') / 12))} par mois.`
                          : `Soit ${formaterFCFA(prixPourCycles(offre.cycles, 'AN'))} en réglant à l’année.`}
                      </p>
                    </>
                  )}
                </div>

                <ul className="mt-6 flex flex-col gap-3">
                  {offre.inclus.map((ligne) => (
                    <li key={ligne} className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-tertiary"
                        aria-hidden
                      />
                      <span className="text-sm leading-relaxed text-text-secondary">{ligne}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex-grow" />
                <Button
                  asChild
                  variant={offre.mise_en_avant ? 'primary' : 'secondary'}
                  className="w-full"
                >
                  <a href="#demo">{offre.cta}</a>
                </Button>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mx-auto mt-10 max-w-3xl text-center text-sm leading-relaxed text-text-secondary">
            Tous les prix sont en francs CFA, par établissement. L’essai gratuit de{' '}
            {JOURS_ESSAI_GRATUIT} jours donne accès à l’ensemble des fonctionnalités, sans carte
            bancaire. À son terme, votre espace passe en lecture seule : vos données restent
            consultables et vos documents imprimables.{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Déjà client ? Connectez-vous.
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
