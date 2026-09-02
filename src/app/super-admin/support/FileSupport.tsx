'use client';

import * as React from 'react';
import {
  Search,
  KeyRound,
  GraduationCap,
  Receipt,
  CreditCard,
  Bug,
  CircleHelp,
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
 * chaque demande demande d'être lue en entier pour savoir si elle vous
 * concerne. Trois choses y remédient ici, et aucune n'est décorative :
 *
 * - **Chaque catégorie a son icône et sa teinte.** C'est ce qui rend une file
 *   parcourable : on repère les trois problèmes de paiement au milieu de vingt
 *   demandes sans lire un mot.
 * - **Les filtres sont des onglets, pas un menu.** Le compte est visible en
 *   permanence sur chacun ; « À traiter (7) » dit à la fois où aller et
 *   combien il reste, sans ouvrir quoi que ce soit.
 * - **Le filtrage est instantané, côté navigateur.** Le volume se compte en
 *   dizaines : un aller-retour serveur par frappe de clavier coûterait plus
 *   qu'il ne rapporte.
 *
 * Le filtrage ne masque jamais une demande sans le dire : le compte de chaque
 * onglet reste celui de la file entière, et un filtre qui ne ramène rien
 * l'annonce plutôt que d'afficher une page vide.
 */

type Onglet = 'A_TRAITER' | 'EN_COURS' | 'CLOSES' | 'TOUTES';

const ONGLETS: { cle: Onglet; libelle: string; statuts: StatutSupport[] }[] = [
  { cle: 'A_TRAITER', libelle: 'À traiter', statuts: ['NOUVELLE'] },
  { cle: 'EN_COURS', libelle: 'En cours', statuts: ['EN_COURS'] },
  { cle: 'CLOSES', libelle: 'Closes', statuts: ['RESOLUE', 'FERMEE'] },
  { cle: 'TOUTES', libelle: 'Toutes', statuts: ['NOUVELLE', 'EN_COURS', 'RESOLUE', 'FERMEE'] },
];

/**
 * Icône et teinte par catégorie.
 *
 * Les teintes sont prises dans la palette du système, jamais inventées : une
 * couleur ad hoc casserait la cohérence avec le reste des écrans, et les
 * teintes de statut ont déjà un sens ailleurs dans le produit.
 */
const VISUEL: Record<CategorieSupport, { Icone: typeof CircleHelp; classe: string }> = {
  COMPTE_ACCES: { Icone: KeyRound, classe: 'bg-primary-fixed text-primary-container' },
  NOTES_BULLETINS: { Icone: GraduationCap, classe: 'bg-secondary-container text-text-primary' },
  FINANCES: { Icone: Receipt, classe: 'bg-tertiary/10 text-tertiary' },
  ABONNEMENT_PAIEMENT: { Icone: CreditCard, classe: 'bg-amber-500/10 text-amber-700' },
  ANOMALIE: { Icone: Bug, classe: 'bg-error/10 text-error' },
  AUTRE: { Icone: CircleHelp, classe: 'bg-surface-container text-text-secondary' },
};

export function FileSupport({ demandes }: { demandes: DemandeSupportPlateforme[] }) {
  const [onglet, setOnglet] = React.useState<Onglet>('A_TRAITER');
  const [categorie, setCategorie] = React.useState<CategorieSupport | 'TOUTES'>('TOUTES');
  const [recherche, setRecherche] = React.useState('');

  const comptes = React.useMemo(() => {
    const c: Record<Onglet, number> = { A_TRAITER: 0, EN_COURS: 0, CLOSES: 0, TOUTES: 0 };
    for (const d of demandes) {
      c.TOUTES += 1;
      if (d.statut === 'NOUVELLE') c.A_TRAITER += 1;
      else if (d.statut === 'EN_COURS') c.EN_COURS += 1;
      else c.CLOSES += 1;
    }
    return c;
  }, [demandes]);

  const visibles = React.useMemo(() => {
    const statuts = ONGLETS.find((o) => o.cle === onglet)!.statuts;
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            type="button"
            onClick={() => setOnglet(o.cle)}
            className={cn(
              'rounded-full px-4 py-1.5 text-body-sm font-medium transition-colors',
              onglet === o.cle
                ? 'bg-primary-container text-white'
                : 'border border-surface-border bg-surface-container-lowest text-text-secondary hover:border-primary-container/50',
            )}
          >
            {o.libelle}
            <span className={cn('ml-2', onglet === o.cle ? 'text-white/80' : 'text-text-secondary')}>
              {comptes[o.cle]}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
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
