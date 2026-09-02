'use client';

import * as React from 'react';
import {
  Search,
  Inbox,
  Loader,
  CheckCircle2,
  Layers,
  KeyRound,
  GraduationCap,
  Receipt,
  CreditCard,
  Bug,
  CircleHelp,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  CATEGORIES_SUPPORT,
  type CategorieSupport,
  type DemandeSupportPlateforme,
  type StatutSupport,
} from '@/lib/support';
import { CarteDemandeSupport } from './CarteDemandeSupport';

/**
 * File de travail du support : filtrer, retrouver, distinguer.
 *
 * Une file de demandes se lit mal parce que toutes les cartes se ressemblent —
 * même taille, même couleur, même disposition. L'œil n'a aucune prise et
 * chaque demande doit être lue en entier pour savoir si elle vous concerne.
 *
 * Trois choses y remédient, et aucune n'est décorative :
 *
 * - **Les cartes du haut sont le filtre.** Elles disent où en est la file et
 *   servent à s'y déplacer, en un seul geste. Une rangée de compteurs suivie
 *   d'une rangée d'onglets aurait affiché deux fois les mêmes nombres pour
 *   deux gestes différents.
 * - **Chaque catégorie a son icône et sa teinte.** C'est ce qui rend une file
 *   parcourable : on repère les trois problèmes de paiement au milieu de vingt
 *   demandes sans lire un mot.
 * - **Le filtrage est instantané, côté navigateur.** Le volume se compte en
 *   dizaines : un aller-retour serveur par frappe de clavier coûterait plus
 *   qu'il ne rapporte.
 *
 * Le filtrage ne masque jamais une demande sans le dire : les compteurs restent
 * ceux de la file entière, et un filtre qui ne ramène rien l'annonce plutôt que
 * d'afficher une page vide.
 */

const JOUR = 86_400_000;

type Onglet = 'A_TRAITER' | 'EN_COURS' | 'CLOSES' | 'TOUTES';

const STATUTS_PAR_ONGLET: Record<Onglet, StatutSupport[]> = {
  A_TRAITER: ['NOUVELLE'],
  EN_COURS: ['EN_COURS'],
  CLOSES: ['RESOLUE', 'FERMEE'],
  TOUTES: ['NOUVELLE', 'EN_COURS', 'RESOLUE', 'FERMEE'],
};

/**
 * Icône et teinte par catégorie.
 *
 * Les teintes sont prises dans la palette du système, jamais inventées : une
 * couleur ad hoc casserait la cohérence avec le reste des écrans, et les
 * teintes de statut ont déjà un sens ailleurs dans le produit.
 */
const VISUEL: Record<CategorieSupport, { Icone: LucideIcon; classe: string }> = {
  COMPTE_ACCES: { Icone: KeyRound, classe: 'bg-primary-fixed text-primary-container' },
  NOTES_BULLETINS: { Icone: GraduationCap, classe: 'bg-secondary-container text-text-primary' },
  FINANCES: { Icone: Receipt, classe: 'bg-tertiary/10 text-tertiary' },
  ABONNEMENT_PAIEMENT: { Icone: CreditCard, classe: 'bg-amber-500/10 text-amber-700' },
  ANOMALIE: { Icone: Bug, classe: 'bg-error/10 text-error' },
  AUTRE: { Icone: CircleHelp, classe: 'bg-surface-container text-text-secondary' },
};

/**
 * Carte-filtre, reprise du motif des raccourcis du tableau de bord : pastille
 * d'icône qui s'inverse au survol, léger soulèvement, bordure qui s'allume.
 *
 * Contrairement aux raccourcis, elle ne navigue pas — elle filtre la liste en
 * dessous. D'où le `button` et l'`aria-pressed` plutôt qu'un lien : une carte
 * qui garde un état actif n'est pas une destination.
 */
function CarteFiltre({
  actif,
  onClick,
  Icone,
  classeIcone,
  valeur,
  libelle,
  precision,
  alerte,
}: {
  actif: boolean;
  onClick: () => void;
  Icone: LucideIcon;
  classeIcone: string;
  valeur: string;
  libelle: string;
  precision: string;
  alerte?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        'group flex h-full w-full items-start gap-3 rounded-lg border bg-surface-container-lowest p-4 text-left transition-all',
        'hover:-translate-y-0.5 hover:border-primary-container/60 hover:shadow-floating',
        actif
          ? 'border-primary-container/70 shadow-floating'
          : 'border-surface-border',
      )}
    >
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors',
          classeIcone,
          'group-hover:bg-primary-container group-hover:text-white',
          actif && 'bg-primary-container text-white',
        )}
      >
        <Icone className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-display-sm leading-tight text-text-primary" data-mono>
          {valeur}
        </span>
        <span className="block text-body-md font-medium text-text-primary">{libelle}</span>
        <span
          className={cn(
            'mt-0.5 block text-body-sm',
            alerte ? 'font-medium text-error' : 'text-text-secondary',
          )}
        >
          {precision}
        </span>
      </span>
    </button>
  );
}

export function FileSupport({ demandes }: { demandes: DemandeSupportPlateforme[] }) {
  const [onglet, setOnglet] = React.useState<Onglet>('A_TRAITER');
  const [categorie, setCategorie] = React.useState<CategorieSupport | 'TOUTES'>('TOUTES');
  const [recherche, setRecherche] = React.useState('');

  const stats = React.useMemo(() => {
    const maintenant = Date.now();
    const aTraiter = demandes.filter((d) => d.statut === 'NOUVELLE');
    const attentes = aTraiter.map((d) =>
      Math.floor((maintenant - new Date(d.createdAt).getTime()) / JOUR),
    );
    return {
      aTraiter: aTraiter.length,
      enCours: demandes.filter((d) => d.statut === 'EN_COURS').length,
      closes: demandes.filter((d) => d.statut === 'RESOLUE' || d.statut === 'FERMEE').length,
      total: demandes.length,
      resoluesRecentes: demandes.filter(
        (d) =>
          d.statut === 'RESOLUE' &&
          d.repondueLe !== null &&
          maintenant - new Date(d.repondueLe).getTime() < 30 * JOUR,
      ).length,
      // La plus ancienne en attente est le seul chiffre qui alerte. Une moyenne
      // rassure toujours ; une école qui attend depuis six jours est en train
      // de perdre confiance, même si les vingt autres ont eu une réponse dans
      // l'heure.
      plusAncienne: attentes.length > 0 ? Math.max(...attentes) : null,
    };
  }, [demandes]);

  const visibles = React.useMemo(() => {
    const statuts = STATUTS_PAR_ONGLET[onglet];
    const q = recherche.trim().toLowerCase();
    return demandes.filter((d) => {
      if (!statuts.includes(d.statut)) return false;
      if (categorie !== 'TOUTES' && d.categorie !== categorie) return false;
      if (q === '') return true;
      // La recherche porte sur ce qu'on a en tête quand on cherche une
      // demande : le nom de l'école, la personne, ou un mot du sujet.
      return (
        d.etablissementNom.toLowerCase().includes(q) ||
        d.auteurNom.toLowerCase().includes(q) ||
        d.sujet.toLowerCase().includes(q) ||
        d.message.toLowerCase().includes(q)
      );
    });
  }, [demandes, onglet, categorie, recherche]);

  // Les catégories réellement présentes, avec leur compte. Proposer un filtre
  // qui ne ramène rien fait douter du filtre plutôt que des données.
  const categoriesPresentes = React.useMemo(() => {
    const compte = new Map<CategorieSupport, number>();
    for (const d of demandes) compte.set(d.categorie, (compte.get(d.categorie) ?? 0) + 1);
    return CATEGORIES_SUPPORT.filter((c) => compte.has(c.valeur)).map((c) => ({
      ...c,
      compte: compte.get(c.valeur)!,
    }));
  }, [demandes]);

  const attenteLisible =
    stats.plusAncienne === null
      ? 'aucune en attente'
      : stats.plusAncienne === 0
        ? "la plus ancienne : aujourd'hui"
        : `la plus ancienne : ${stats.plusAncienne} j`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CarteFiltre
          actif={onglet === 'A_TRAITER'}
          onClick={() => setOnglet('A_TRAITER')}
          Icone={Inbox}
          classeIcone="bg-primary-fixed text-primary-container"
          valeur={String(stats.aTraiter)}
          libelle="À traiter"
          precision={attenteLisible}
          // Trois jours : au-delà, l'école a eu le temps de conclure que
          // personne ne lui répondra.
          alerte={stats.plusAncienne !== null && stats.plusAncienne >= 3}
        />
        <CarteFiltre
          actif={onglet === 'EN_COURS'}
          onClick={() => setOnglet('EN_COURS')}
          Icone={Loader}
          classeIcone="bg-amber-500/10 text-amber-700"
          valeur={String(stats.enCours)}
          libelle="En cours"
          precision="prises en charge, pas encore closes"
        />
        <CarteFiltre
          actif={onglet === 'CLOSES'}
          onClick={() => setOnglet('CLOSES')}
          Icone={CheckCircle2}
          classeIcone="bg-tertiary/10 text-tertiary"
          valeur={String(stats.closes)}
          libelle="Closes"
          precision={`${stats.resoluesRecentes} résolue${stats.resoluesRecentes > 1 ? 's' : ''} sur 30 jours`}
        />
        <CarteFiltre
          actif={onglet === 'TOUTES'}
          onClick={() => setOnglet('TOUTES')}
          Icone={Layers}
          classeIcone="bg-surface-container text-text-secondary"
          valeur={String(stats.total)}
          libelle="Toutes"
          precision="depuis le début"
        />
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          aria-hidden
        />
        <Input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une école, une personne, un sujet…"
          className="pl-9"
          aria-label="Rechercher dans les demandes"
        />
      </div>

      {categoriesPresentes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategorie('TOUTES')}
            className={cn(
              'rounded-full border px-3 py-1 text-label-md transition-colors',
              categorie === 'TOUTES'
                ? 'border-primary-container bg-primary-fixed text-primary-container'
                : 'border-surface-border text-text-secondary hover:border-primary-container/50',
            )}
          >
            Toutes catégories
          </button>
          {categoriesPresentes.map((c) => {
            const { Icone } = VISUEL[c.valeur];
            const actif = categorie === c.valeur;
            return (
              <button
                key={c.valeur}
                type="button"
                onClick={() => setCategorie(actif ? 'TOUTES' : c.valeur)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-label-md transition-colors',
                  actif
                    ? 'border-primary-container bg-primary-fixed text-primary-container'
                    : 'border-surface-border text-text-secondary hover:border-primary-container/50',
                )}
              >
                <Icone className="h-3.5 w-3.5" aria-hidden />
                {c.libelle}
                <span className="text-text-secondary">{c.compte}</span>
              </button>
            );
          })}
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-surface-border bg-surface-container-lowest px-5 py-12 text-center text-body-sm text-text-secondary">
          {demandes.length === 0
            ? 'Aucune demande pour le moment.'
            : 'Aucune demande ne correspond à ce filtre.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibles.map((demande) => (
            <CarteDemandeSupport
              key={demande.id}
              demande={demande}
              visuel={VISUEL[demande.categorie]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
