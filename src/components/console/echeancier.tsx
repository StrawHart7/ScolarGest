import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { EnteteSection, TEINTE } from './entete-section';

/**
 * L'échéancier : le parc rangé par distance à son échéance.
 *
 * **Il remplace deux blocs à lui seul.** La console portait « Répartition des
 * écoles » — une barre empilée disant quelle proportion du parc était abonnée —
 * et « À relancer sous 7 jours », une liste. Le premier répondait à une
 * question qu'on ne se pose pas deux fois par jour ; le second ne montrait
 * qu'une tranche de sept jours, sans dire ce qu'il y avait juste derrière, ni
 * ce qui était déjà passé.
 *
 * Or la seule question qu'on ouvre cette page pour trancher est **qui relancer
 * aujourd'hui**. Cette activité est une suite de comptes à rebours : un essai
 * dure trente jours, un abonnement se termine à une date. Ranger le parc sur
 * cet axe-là, du dépassé au lointain, c'est ranger le travail.
 *
 * **Les quatre bandes se lisent de gauche à droite comme une piste**, chacune
 * ouverte par un filet de sa couleur — voir `EnteteSection`, partagé avec la
 * file des demandes de démo.
 *
 * **Les deux bandes urgentes montrent tout le monde, les deux calmes sont
 * plafonnées.** Une bande « Au-delà » de quarante lignes noierait les trois
 * écoles qui comptent, et ces quarante-là n'appellent aucun geste — le lien
 * vers l'inventaire complet suffit.
 *
 * Une école sans date — ni essai ni abonnement — n'a pas sa place sur un axe
 * de temps. Elle est comptée en pied de bloc plutôt que rangée de force dans
 * une bande qui mentirait.
 */

export interface EcoleEcheance {
  id: string;
  nom: string;
  joursRestants: number | null;
  nombreEleves: number;
}

/** Plafond d'affichage des bandes non urgentes. */
const PLAFOND_BANDE_CALME = 5;

type CleBande = 'depasse' | 'semaine' | 'mois' | 'apres';

const BANDES: {
  cle: CleBande;
  titre: string;
  definition: string;
  couleur: string;
  /** Une bande urgente montre tout le monde : c'est la liste de travail. */
  urgente: boolean;
}[] = [
  {
    cle: 'depasse',
    titre: 'Dépassé',
    definition: 'échéance passée',
    couleur: TEINTE.erreur,
    urgente: true,
  },
  {
    cle: 'semaine',
    titre: 'Cette semaine',
    definition: 'sous 7 jours',
    couleur: TEINTE.alerte,
    urgente: true,
  },
  {
    cle: 'mois',
    titre: 'Ce mois',
    definition: 'sous 30 jours',
    couleur: TEINTE.encours,
    urgente: false,
  },
  {
    cle: 'apres',
    titre: 'Au-delà',
    definition: 'plus de 30 jours',
    couleur: TEINTE.fait,
    urgente: false,
  },
];

function bandeDe(jours: number): CleBande {
  if (jours < 0) return 'depasse';
  if (jours <= 7) return 'semaine';
  if (jours <= 30) return 'mois';
  return 'apres';
}

export function Echeancier({ ecoles }: { ecoles: EcoleEcheance[] }) {
  const sansDate = ecoles.filter((e) => e.joursRestants === null);

  const parBande = new Map<CleBande, EcoleEcheance[]>(BANDES.map((b) => [b.cle, []]));
  for (const ecole of ecoles) {
    if (ecole.joursRestants === null) continue;
    parBande.get(bandeDe(ecole.joursRestants))!.push(ecole);
  }
  // Au sein d'une bande, le plus pressé d'abord. Dans « Dépassé », le plus
  // ancien retard vient donc en tête : c'est celui qu'on a laissé filer.
  for (const liste of parBande.values()) {
    liste.sort((a, b) => (a.joursRestants ?? 0) - (b.joursRestants ?? 0));
  }

  const total = ecoles.length - sansDate.length;

  return (
    <section
      className="animate-console-monte rounded-2xl border border-surface-border bg-surface-container-lowest shadow-subtle"
      style={{ animationDelay: '160ms' }}
      aria-label="Échéancier du parc"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-surface-border px-5 py-4">
        <h2 className="text-headline-md text-text-primary">Échéancier</h2>
        <p className="text-body-sm text-text-secondary">
          {total === 0
            ? 'Aucune école n’a d’échéance datée.'
            : `${total} école${total > 1 ? 's' : ''} sur l’axe, de la plus pressée à la plus lointaine.`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px bg-surface-border/60 md:grid-cols-2 xl:grid-cols-4">
        {BANDES.map((bande) => {
          const liste = parBande.get(bande.cle)!;
          const montrees = bande.urgente ? liste : liste.slice(0, PLAFOND_BANDE_CALME);
          const restantes = liste.length - montrees.length;

          return (
            <div key={bande.cle} className="flex flex-col bg-surface-container-lowest">
              <EnteteSection
                titre={bande.titre}
                definition={bande.definition}
                compte={liste.length}
                couleur={bande.couleur}
              />

              {liste.length === 0 ? (
                // Sur telephone le « 0 » du compteur dit deja tout, et les
                // quatre bandes s'empilent : une ligne de plus par bande vide
                // repousse d'autant celles qui portent du travail. Sur poste,
                // elle reste — elle occupe la colonne, qui sinon parait
                // tronquee a cote de ses voisines.
                <p className="hidden px-5 pb-5 pt-2 text-body-sm text-text-secondary md:block">
                  Aucune.
                </p>
              ) : (
                <ul className="flex flex-col pb-2">
                  {montrees.map((ecole) => (
                    <li key={ecole.id}>
                      <Link
                        href={`/super-admin/etablissements/${ecole.id}`}
                        className="group flex items-center gap-3 px-5 py-2 transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-md text-text-primary">
                            {ecole.nom}
                          </span>
                          <span className="block text-body-sm text-text-secondary">
                            {ecole.nombreEleves > 0
                              ? `${ecole.nombreEleves} élève${ecole.nombreEleves > 1 ? 's' : ''}`
                              : 'Aucun élève inscrit'}
                          </span>
                        </span>
                        {/* Dans la bande « Dépassé », le signe est porté par le
                            titre de la bande : afficher « -12 j » y serait
                            redondant et se lirait mal en petit corps. */}
                        <span
                          className="shrink-0 font-mono text-body-md font-semibold"
                          data-mono
                          style={{ color: bande.couleur }}
                        >
                          {Math.abs(ecole.joursRestants ?? 0)} j
                        </span>
                        <ArrowUpRight
                          className="size-4 shrink-0 text-text-secondary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}

                  {restantes > 0 && (
                    <li>
                      <Link
                        href="/super-admin/etablissements"
                        className="block px-5 py-2 text-body-sm text-primary-container hover:underline"
                      >
                        et {restantes} autre{restantes > 1 ? 's' : ''}
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {sansDate.length > 0 && (
        <div className="border-t border-surface-border px-5 py-3">
          <Link
            href="/super-admin/etablissements"
            className="inline-flex items-center gap-2 text-body-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <span className="size-2 shrink-0 rounded-full bg-outline" aria-hidden />
            {sansDate.length} école{sansDate.length > 1 ? 's' : ''} sans échéance — ni essai en
            cours, ni abonnement
            <ArrowUpRight className="size-4 shrink-0" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
