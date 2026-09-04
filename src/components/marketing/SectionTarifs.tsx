'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/motion/Reveal';
import { phrasePlaces, type PlacesFondatrices } from '@/lib/fondateur';
import {
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
 * **La troisième colonne n'est pas un palier, c'est un programme.** L'offre
 * fondatrice ne donne pas plus de fonctionnalités que les deux autres : c'est
 * le même produit, à un tarif de lancement, avec de l'accompagnement et un
 * engagement de prix à vie. Elle est mise en avant parce que c'est par elle que
 * passent aujourd'hui toutes les entrées — on ne souscrit pas seul au programme
 * fondateur, il s'ouvre après un échange.
 *
 * Son montant n'est **pas affiché**, et c'est une décision commerciale, pas un
 * oubli : le publier en ferait l'ancrage définitif du produit dans la tête du
 * marché, alors qu'il doit rester une offre de lancement. La rareté remplace le
 * prix — c'est le seul argument qui vaille quand le montant est tu.
 *
 * **Chaque offre reprend la précédente par une ligne « Tout ce que comprend… »
 * puis ajoute la sienne.** Sans cette échelle, l'offre d'entrée détaillait ses
 * quatre modules pendant que l'offre mise en avant les résumait en une ligne —
 * la plus chère paraissait donc la plus pauvre. Toute ligne ajoutée à une offre
 * doit être ajoutée en haut de l'échelle, jamais au milieu.
 *
 * Les libellés décrivent un résultat, pas un module : « les bulletins de toute
 * une classe en un clic » se vérifie dans le produit
 * (`genererBulletinsClasseAction`), là où « module bulletins » ne promet rien.
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
      'La gestion complète de votre école : élèves, enseignants, notes et finances',
      'Les bulletins de toute une classe générés en un clic',
      'Chaque paiement encaissé, son reçu remis dans la foulée',
      'Un écran par rôle : personne ne voit ce qui ne le regarde pas',
      'Élèves, enseignants et comptes sans limite de nombre',
    ],
    cta: 'Demander une démo',
  },
  {
    nom: 'Collège et lycée',
    sousTitre: 'Pour un complexe scolaire couvrant les deux cycles.',
    cycles: 2,
    mise_en_avant: false,
    inclus: [
      'Tout ce que comprend l’offre à un cycle',
      'Vos deux cycles dans un seul espace, une seule connexion',
      'Le passage de la 3ème à la 2nde sans ressaisir un dossier',
      'Un enseignant créé une fois, affecté au collège comme au lycée',
      'Effectifs et trésorerie consolidés sur un seul tableau de bord',
      'Un seul abonnement, une seule facture',
    ],
    cta: 'Demander une démo',
  },
  {
    nom: 'École fondatrice',
    sousTitre: 'Programme de lancement, réservé aux premières écoles.',
    cycles: null,
    mise_en_avant: true,
    inclus: [
      'Tout ce que comprend l’offre collège et lycée',
      'Un tarif préférentiel, garanti à vie',
      'La configuration de votre école faite avec vous',
      'La formation de vos équipes, sur place',
      'Un accès direct à l’équipe, sans file d’attente',
      'Vos retours décident des prochaines fonctionnalités',
    ],
    cta: 'Rejoindre le programme',
  },
];

export function SectionTarifs({ places }: { places: PlacesFondatrices }) {
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
              Pas de palier caché, pas de facturation à l’élève. Vous payez pour les cycles
              que vous enseignez. Les premières écoles rejoignent le programme fondateur, à
              tarif préférentiel et avec notre accompagnement.
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
                    Places limitées
                  </span>
                )}

                <h3 className="text-lg font-bold text-text-primary sm:text-xl">{offre.nom}</h3>
                <p className="mt-1 min-h-[2.5rem] text-sm text-text-secondary">
                  {offre.sousTitre}
                </p>

                <div className="mt-6 border-b border-surface-border pb-6">
                  {offre.cycles === null ? (
                    <>
                      {/*
                        Le montant fondateur n'est pas affiche, et ce n'est pas
                        une omission : le publier en ferait l'ancrage definitif
                        du produit dans la tete du marche, alors qu'il doit
                        rester une offre de lancement. Ce qui est montre a la
                        place, c'est la rarete — le seul argument qui vaille
                        quand le prix est tu.
                      */}
                      <p className="text-3xl font-extrabold text-text-primary">
                        Tarif préférentiel
                      </p>
                      <p className="mt-1 text-sm font-medium text-primary">
                        {phrasePlaces(places)}
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
            Tous les prix sont en francs CFA, par établissement. Le programme fondateur
            s’ouvre après un échange avec notre équipe : nous configurons votre école avec
            vous avant la première rentrée de données. Si votre abonnement s’interrompt, votre
            espace passe en lecture seule — vos données restent consultables et vos documents
            imprimables.{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Déjà client ? Connectez-vous.
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
