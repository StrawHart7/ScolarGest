import { ChevronDown, CircleHelp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MODELES, type DomaineImport } from '@/lib/import/modeles';

/**
 * Le mode d'emploi de l'import — replié, et placé après la zone de dépôt.
 *
 * ## Pourquoi il n'est plus en tête d'écran
 *
 * Il l'était, déplié : trois étapes numérotées, six phrases, un repli de
 * colonnes, et la zone de dépôt repoussée en bas. Or l'écran n'a qu'une chose à
 * demander — un fichier — et il commençait par un paragraphe. Quelqu'un qui a
 * déjà importé une fois relit tout à chaque passage pour retrouver la seule
 * zone qui l'intéresse.
 *
 * Surtout, **l'analyse est déjà le mode d'emploi**. Rien n'est écrit au dépôt :
 * `preparerImport*` rend un bilan ligne à ligne, et le contrôle des en-têtes
 * court-circuite le reste pour dire exactement quelle colonne ne va pas. Un
 * fichier mal formé n'échoue donc pas en silence — il revient expliqué, sur les
 * données réelles de l'école plutôt que sur un exemple. Expliquer d'avance ce
 * que le bilan dira mieux après coup coûte un écran de lecture à tout le monde,
 * dont ceux qui n'en avaient pas besoin.
 *
 * ## Le téléchargement du modèle reste en clair, lui
 *
 * Ce n'est pas une information, c'est l'action qui **supprime** la seule classe
 * d'échec qui arrête tout : une colonne mal orthographiée rend le fichier
 * entier illisible. La replier remettrait en place l'erreur qu'elle évite. Elle
 * tient en un bouton, et un bouton ne se lit pas.
 *
 * ## `<details>` plutôt qu'un état React
 *
 * Le navigateur sait replier seul, au clavier compris, et le composant n'a plus
 * besoin d'être client. Les étapes restent numérotées : on ne peut pas déposer
 * avant d'avoir rempli, ni remplir avant d'avoir le modèle — c'est une vraie
 * séquence, pas un ornement.
 */
export function PreparerFichier({ domaine }: { domaine: DomaineImport }) {
  const modele = MODELES[domaine];
  const obligatoires = modele.colonnes.filter((c) => c.obligatoire).length;
  const unite =
    domaine === 'paiements' ? 'versement' : domaine === 'eleves' ? 'élève' : 'enseignant';

  return (
    <div className="space-y-3">
      <Button asChild variant="secondary" size="sm">
        {/* Une ancre, pas un `fetch` : c'est le navigateur qui doit recevoir
            l'en-tête `Content-Disposition` et proposer l'enregistrement. */}
        <a href={`/api/modele-import/${domaine}`} download>
          <Download className="h-4 w-4" aria-hidden />
          Télécharger le modèle Excel
        </a>
      </Button>

      <details className="group overflow-hidden rounded-lg border border-surface-border bg-surface-container-low">
        <summary className="flex h-row-standard cursor-pointer list-none items-center gap-2 px-4 [&::-webkit-details-marker]:hidden md:h-11">
          <CircleHelp className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
          <span className="min-w-0 text-body-sm text-text-secondary">
            Comment préparer le fichier
          </span>
          <ChevronDown
            className="ml-auto h-4 w-4 shrink-0 text-text-secondary transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>

        <div className="space-y-4 border-t border-surface-border p-4">
          <div>
            <p className="text-body-md font-medium text-text-primary">1. Partez du modèle</p>
            <p className="text-body-sm text-text-secondary">
              Il porte déjà les bonnes colonnes et une ligne d’exemple à remplacer. C’est la façon
              la plus sûre : une colonne mal orthographiée rend tout le fichier illisible.
            </p>
          </div>

          <div className="border-t border-surface-border pt-3">
            <p className="text-body-md font-medium text-text-primary">2. Remplissez-le</p>
            <p className="text-body-sm text-text-secondary">
              Une ligne par {unite}. Gardez la première ligne telle quelle : ce sont les en-têtes.
              {obligatoires > 0 &&
                ` ${obligatoires} colonnes sont obligatoires, les autres peuvent rester vides.`}
            </p>
          </div>

          <div className="border-t border-surface-border pt-3">
            {/* « Ci-dessous » n'a plus de sens : la zone de dépôt est au-dessus
                de ce panneau depuis qu'elle a repris la tête de l'écran. */}
            <p className="text-body-md font-medium text-text-primary">3. Déposez-le</p>
            <p className="text-body-sm text-text-secondary">
              Rien ne sera enregistré tout de suite : vous verrez d’abord un bilan de ce qui passe
              et de ce qui bloque, puis vous confirmerez.
            </p>
          </div>

          <details className="group/colonnes border-t border-surface-border pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-body-sm text-text-secondary transition-colors hover:text-text-primary [&::-webkit-details-marker]:hidden">
              <span>Voir le détail des {modele.colonnes.length} colonnes</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 transition-transform group-open/colonnes:rotate-180"
                aria-hidden
              />
            </summary>

            <ul className="mt-3 flex flex-col gap-1.5">
              {modele.colonnes.map((colonne) => (
                <li
                  key={colonne.cle}
                  className="flex flex-wrap items-baseline gap-x-2 text-body-sm"
                >
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
          </details>
        </div>
      </details>
    </div>
  );
}
