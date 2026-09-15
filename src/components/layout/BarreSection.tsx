import Link from 'next/link';
import { blocsSection } from '@/lib/navigation';
import type { Role } from '@/services/tenant';

/**
 * Les autres écrans d'un domaine, en rangée, au-dessus de celui qu'on regarde.
 *
 * ## Ce qu'elle remplace
 *
 * `/etablissement/finances` n'était pas un écran : c'était une grille de cinq
 * blocs qui **nommaient** cinq écrans. Le Directeur cliquait « Finances » et
 * obtenait cinq noms de tables — il n'avait pas encore vu un chiffre. Même
 * chose pour « Notes et résultats » et « Établissement », soit trois des sept
 * entrées de son menu.
 *
 * Ces pages existaient pour une bonne raison : regrouper la barre latérale
 * sans elles reviendrait à cacher des écrans. La correction n'est donc pas de
 * les supprimer, c'est de **déplacer leur contenu** — le domaine ouvre
 * directement son écran principal, et les autres entrées se rangent ici, à un
 * niveau visuel inférieur.
 *
 * C'est le principe « les fonctions rares ne doivent pas occuper le même
 * niveau visuel que les fonctions quotidiennes ». Rien n'est retiré : tout est
 * hiérarchisé.
 *
 * ## L'écran courant reste dans la rangée
 *
 * Marqué, non cliquable. Le retirer ferait bouger les autres d'un écran à
 * l'autre, et on ne saurait plus où l'on est dans le domaine.
 *
 * ## Mobile
 *
 * La rangée défile horizontalement (`overflow-x-auto`), elle ne se replie pas
 * en menu : cinq entrées courtes tiennent en deux coups de pouce, et un menu
 * demanderait un clic de plus pour voir ce qui existe — exactement ce qu'on
 * vient d'enlever. `-mx-4 px-4` sous `md` pour que le défilement aille bord à
 * bord au lieu de s'arrêter dans la gouttière.
 */
export function BarreSection({
  chemin,
  role,
  actif,
}: {
  /** La section, telle qu'elle est déclarée dans `SECTIONS`. */
  chemin: string;
  role: Role;
  /** L'écran affiché, pour le marquer dans la rangée. */
  actif: string;
}) {
  const blocs = blocsSection(chemin, role);
  if (blocs.length <= 1) return null;

  return (
    <nav
      aria-label="Autres écrans de cette section"
      className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <ul className="flex w-max gap-2 md:w-auto md:flex-wrap">
        {blocs.map((bloc) => {
          const courant = bloc.href === actif;
          return (
            <li key={bloc.href}>
              {courant ? (
                <span
                  aria-current="page"
                  className="inline-flex h-row-standard items-center rounded-lg border border-primary bg-primary/5 px-3 text-body-sm font-medium text-text-primary"
                >
                  {bloc.titre}
                </span>
              ) : (
                <Link
                  href={bloc.href}
                  className="inline-flex h-row-standard items-center rounded-lg border border-surface-border bg-surface-container-lowest px-3 text-body-sm text-text-secondary transition-colors hover:border-primary/50 hover:text-text-primary"
                >
                  {bloc.titre}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
