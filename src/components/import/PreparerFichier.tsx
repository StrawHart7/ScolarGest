'use client';

import * as React from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MODELES, type DomaineImport } from '@/lib/import/modeles';

/**
 * Ce qu'il faut faire avant de déposer un fichier.
 *
 * L'écran annonçait ses quinze en-têtes en une ligne de code monospace, à
 * recopier à la main. C'est intimidant, ça ne dit pas quoi faire, et surtout
 * c'est la source du seul échec qui arrête tout : une colonne mal orthographiée
 * et le fichier entier devient illisible.
 *
 * **Le modèle téléchargeable supprime la classe d'erreur** au lieu de mieux la
 * signaler. Le reste — la liste exacte des colonnes — n'a plus à occuper le
 * premier plan : elle est repliée, disponible pour qui veut vérifier, invisible
 * pour qui suit simplement les trois étapes.
 *
 * Les étapes sont numérotées parce que c'est une vraie séquence : on ne peut
 * pas déposer avant d'avoir rempli, ni remplir avant d'avoir le modèle. C'est
 * exactement le cas où une numérotation porte une information et n'est pas un
 * ornement.
 */
export function PreparerFichier({ domaine }: { domaine: DomaineImport }) {
  const [colonnesVisibles, setColonnesVisibles] = React.useState(false);
  const modele = MODELES[domaine];
  const obligatoires = modele.colonnes.filter((c) => c.obligatoire).length;

  return (
    <div className="space-y-4 rounded-xl border border-surface-border bg-surface-container-low p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-body-md font-medium text-text-primary">
            1. Partez du modèle
          </p>
          <p className="text-body-sm text-text-secondary">
            Il porte déjà les bonnes colonnes et une ligne d’exemple à remplacer. C’est la façon
            la plus sûre : une colonne mal orthographiée rend tout le fichier illisible.
          </p>
        </div>
        <Button asChild variant="secondary" className="shrink-0">
          {/* Une ancre, pas un `fetch` : c'est le navigateur qui doit recevoir
              l'en-tête `Content-Disposition` et proposer l'enregistrement. */}
          <a href={`/api/modele-import/${domaine}`} download>
            <Download className="h-4 w-4" aria-hidden />
            Télécharger le modèle
          </a>
        </Button>
      </div>

      <div className="border-t border-surface-border pt-3">
        <p className="text-body-md font-medium text-text-primary">2. Remplissez-le</p>
        <p className="text-body-sm text-text-secondary">
          Une ligne par {domaine === 'paiements' ? 'versement' : domaine === 'eleves' ? 'élève' : 'enseignant'}.
          Gardez la première ligne telle quelle : ce sont les en-têtes.
          {obligatoires > 0 && ` ${obligatoires} colonnes sont obligatoires, les autres peuvent rester vides.`}
        </p>
      </div>

      <div className="border-t border-surface-border pt-3">
        <p className="text-body-md font-medium text-text-primary">3. Déposez-le ci-dessous</p>
        <p className="text-body-sm text-text-secondary">
          Rien ne sera enregistré tout de suite : vous verrez d’abord un bilan de ce qui passe et
          de ce qui bloque, puis vous confirmerez.
        </p>
      </div>

      <div className="border-t border-surface-border pt-3">
        <button
          type="button"
          onClick={() => setColonnesVisibles((v) => !v)}
          aria-expanded={colonnesVisibles}
          className="flex w-full items-center justify-between gap-2 text-left text-body-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          <span>Voir le détail des {modele.colonnes.length} colonnes</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${colonnesVisibles ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {colonnesVisibles && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {modele.colonnes.map((colonne) => (
              <li key={colonne.cle} className="flex flex-wrap items-baseline gap-x-2 text-body-sm">
                <code className="text-text-primary" data-mono>
                  {colonne.cle}
                </code>
                {colonne.obligatoire && (
                  <span className="text-label-md uppercase tracking-wide text-warning-on-container">
                    obligatoire
                  </span>
                )}
                <span className="text-text-secondary">{colonne.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
