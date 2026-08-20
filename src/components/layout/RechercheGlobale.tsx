'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, School, Search, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import type { CategorieResultat, ResultatRecherche } from '@/services/recherche-globale';

const ICONES: Record<CategorieResultat, typeof GraduationCap> = {
  eleve: GraduationCap,
  classe: School,
  enseignant: UsersRound,
};

const LIBELLE_CATEGORIE: Record<CategorieResultat, string> = {
  eleve: 'Élève',
  classe: 'Classe',
  enseignant: 'Enseignant',
};

/**
 * Barre de recherche transverse du header — elle remplace le second
 * « ScolarGest », qui répétait celui de la sidebar sans rien apporter.
 * Les résultats arrivent au fil de la frappe et se parcourent au clavier.
 */
export function RechercheGlobale() {
  const router = useRouter();
  const [terme, setTerme] = React.useState('');
  const [resultats, setResultats] = React.useState<ResultatRecherche[]>([]);
  const [chargement, setChargement] = React.useState(false);
  const [ouvert, setOuvert] = React.useState(false);
  const [indexActif, setIndexActif] = React.useState(0);
  const conteneur = React.useRef<HTMLDivElement>(null);
  const champ = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const recherche = terme.trim();
    if (recherche.length < 2) {
      setResultats([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    const controleur = new AbortController();
    const minuteur = setTimeout(async () => {
      try {
        const reponse = await fetch(`/api/recherche?q=${encodeURIComponent(recherche)}`, {
          signal: controleur.signal,
        });
        if (!reponse.ok) throw new Error('Recherche indisponible');
        const donnees = (await reponse.json()) as ResultatRecherche[];
        setResultats(donnees);
        setIndexActif(0);
      } catch (erreur) {
        if (!(erreur instanceof DOMException && erreur.name === 'AbortError')) setResultats([]);
      } finally {
        setChargement(false);
      }
    }, 250);
    return () => {
      controleur.abort();
      clearTimeout(minuteur);
    };
  }, [terme]);

  // Fermeture au clic extérieur, et raccourci Ctrl/Cmd + K pour ouvrir.
  React.useEffect(() => {
    const auClic = (evenement: MouseEvent) => {
      if (!conteneur.current?.contains(evenement.target as Node)) setOuvert(false);
    };
    const auClavier = (evenement: KeyboardEvent) => {
      if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === 'k') {
        evenement.preventDefault();
        champ.current?.focus();
        setOuvert(true);
      }
    };
    document.addEventListener('mousedown', auClic);
    document.addEventListener('keydown', auClavier);
    return () => {
      document.removeEventListener('mousedown', auClic);
      document.removeEventListener('keydown', auClavier);
    };
  }, []);

  const ouvrir = (resultat: ResultatRecherche) => {
    setOuvert(false);
    setTerme('');
    router.push(resultat.href);
  };

  const auClavierChamp = (evenement: React.KeyboardEvent<HTMLInputElement>) => {
    if (evenement.key === 'Escape') {
      setOuvert(false);
      return;
    }
    if (resultats.length === 0) return;
    if (evenement.key === 'ArrowDown') {
      evenement.preventDefault();
      setIndexActif((i) => (i + 1) % resultats.length);
    } else if (evenement.key === 'ArrowUp') {
      evenement.preventDefault();
      setIndexActif((i) => (i - 1 + resultats.length) % resultats.length);
    } else if (evenement.key === 'Enter') {
      evenement.preventDefault();
      const choisi = resultats[indexActif];
      if (choisi) ouvrir(choisi);
    }
  };

  const afficherPanneau = ouvert && terme.trim().length >= 2;

  return (
    <div ref={conteneur} className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
        aria-hidden
      />
      <input
        ref={champ}
        type="search"
        value={terme}
        onChange={(e) => {
          setTerme(e.target.value);
          setOuvert(true);
        }}
        onFocus={() => setOuvert(true)}
        onKeyDown={auClavierChamp}
        placeholder="Rechercher un élève, une classe, un enseignant…"
        aria-label="Recherche globale"
        role="combobox"
        aria-expanded={afficherPanneau}
        aria-controls="resultats-recherche-globale"
        className="h-9 w-full rounded border border-surface-border bg-surface-container-lowest pl-9 pr-16 text-body-md text-text-primary transition-colors placeholder:text-text-secondary/60 hover:border-primary-container/40 focus-visible:border-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/20 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
        {chargement ? (
          <Spinner className="h-4 w-4 text-text-secondary" />
        ) : (
          <kbd className="rounded border border-surface-border px-1.5 py-0.5 text-label-md text-text-secondary">
            Ctrl K
          </kbd>
        )}
      </span>

      {afficherPanneau && (
        <div
          id="resultats-recherche-globale"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 animate-slide-up overflow-hidden rounded-lg border border-surface-border bg-surface-container-lowest shadow-floating"
        >
          {resultats.length === 0 ? (
            <p className="px-4 py-6 text-center text-body-sm text-text-secondary">
              {chargement ? 'Recherche en cours…' : 'Aucun résultat.'}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {resultats.map((resultat, index) => {
                const Icone = ICONES[resultat.categorie];
                return (
                  <li key={`${resultat.categorie}-${resultat.id}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === indexActif}
                      onMouseEnter={() => setIndexActif(index)}
                      onClick={() => ouvrir(resultat)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                        index === indexActif ? 'bg-primary-fixed' : 'hover:bg-surface-container',
                      )}
                    >
                      <Icone className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-body-md text-text-primary">
                        {resultat.libelle}
                      </span>
                      {resultat.detail && (
                        <span className="shrink-0 font-mono text-label-md text-text-secondary">
                          {resultat.detail}
                        </span>
                      )}
                      <span className="shrink-0 text-label-md uppercase text-text-secondary">
                        {LIBELLE_CATEGORIE[resultat.categorie]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
