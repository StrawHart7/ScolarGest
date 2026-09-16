import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { blocsSection, SECTIONS } from '@/lib/navigation';
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
 * ## Mobile : un repli, plus un défilement
 *
 * Le premier jet faisait défiler la rangée horizontalement, en assumant qu'un
 * menu coûterait un clic de plus pour voir ce qui existe. Mesuré le 2026-09-15
 * sur un écran de 390px, la rangée d'Établissement mesure **1 345px** : trois
 * entrées sur dix sont visibles, et l'écran courant — « Utilisateurs », le
 * huitième — se trouve **586px au-delà du bord droit**. Une barre de section
 * qui ne montre pas la section où l'on est ne coûte pas un clic de moins, elle
 * ne rend pas son service.
 *
 * Rien ne signalait non plus qu'il y avait quelque chose à droite : le
 * défilement était muet.
 *
 * Le repli fermé mesure **46px** contre 44 pour la rangée — à hauteur égale,
 * il nomme la section *et* l'écran courant, et une tape ouvre les dix. Il vaut
 * pour **les trois sections**, pas seulement Établissement : Notes et Finances
 * n'en ont que cinq, mais leurs intitulés sont longs (« Moyennes et
 * classement », « Approbation des notes ») et leur cinquième entrée sort de
 * l'écran exactement pareil. Deux comportements pour une même barre selon la
 * section en feraient apprendre deux.
 *
 * `<details>` et non un état client : la barre est rendue au serveur, et le
 * navigateur sait replier seul, au clavier compris.
 *
 * ## Bureau : deux rangs à 32px
 *
 * Les dix entrées cumulent **1 273px** de puces et de gouttières pour les
 * 972px de contenu d'un écran de 1 280px CSS — le cadre de référence. Elles
 * passent donc à la ligne, et c'est très bien : tout est visible d'un coup
 * d'œil, sans défilement ni repli.
 *
 * Ce qui coûtait cher est la hauteur de la puce. `row-standard` (44px) est le
 * **plancher tactile**, il n'a pas de raison d'être au doigt ce qu'il est à la
 * souris : deux rangs passent de 96 à **72px** en rendant les puces à 32px
 * au-delà de `md`. La règle du plancher reste tenue là où elle vaut — sous
 * `md`, où les entrées sont des lignes de 44px dans le repli.
 */
export function BarreSection({
  chemin,
  role,
  actif,
  exclure,
}: {
  /** La section, telle qu'elle est déclarée dans `SECTIONS`. */
  chemin: string;
  role: Role;
  /** L'écran affiché, pour le marquer dans la rangée. */
  actif: string;
  /**
   * Entrées à retirer de la rangée pour cette école-ci.
   *
   * Le rôle ne suffit pas à décider de tout : « Configuration » s'adresse au
   * Directeur, mais **plus une fois que les neuf réglages indispensables sont
   * faits** — elle n'a alors plus rien à lui apprendre et occupe la première
   * case de sa section. C'est un état de l'établissement, pas une permission,
   * donc `blocsSection` ne peut pas le savoir : il lui est passé.
   *
   * L'entrée retirée reste **atteignable par son adresse** : on la range, on ne
   * la ferme pas.
   */
  exclure?: string[];
}) {
  const retires = new Set(exclure ?? []);
  // L'écran courant ne se retire jamais de sa propre rangée : il y est le
  // repère, et disparaître de sa propre barre ferait croire qu'on a quitté la
  // section.
  const blocs = blocsSection(chemin, role).filter(
    (bloc) => bloc.href === actif || !retires.has(bloc.href),
  );
  if (blocs.length <= 1) return null;

  // **La barre ne s'affiche que si elle peut dire où l'on est.**
  //
  // Un écran de section peut être atteignable par un rôle sans figurer dans sa
  // liste : `/abonnement` est ouverte à tous les rôles par conception, mais son
  // bloc n'est déclaré que pour le Directeur et le Comptable. Une Secrétaire y
  // recevrait donc une rangée où rien n'est marqué — elle lui dirait « voici
  // les autres écrans » sans lui dire lequel elle regarde, ce qui est
  // exactement le contraire du service rendu.
  const ecranCourant = blocs.find((bloc) => bloc.href === actif)?.titre;
  if (!ecranCourant) return null;

  const titreSection = SECTIONS[chemin]?.titre ?? 'Cette section';

  return (
    <>
      {/* Téléphone : le repli. Fermé, il tient dans la hauteur qu'occupait la
          rangée et dit enfin où l'on est. */}
      {/* `overflow-hidden` : l'entrée courante est un aplat pleine largeur.
          « Rapports et exports » étant la dernière de la liste, c'est elle qui
          serait marquée en arrivant depuis la section — son fond carrait alors
          les deux coins bas du cadre. */}
      <details className="group overflow-hidden rounded-lg border border-surface-border bg-surface-container-lowest md:hidden">
        <summary className="flex h-row-standard cursor-pointer list-none items-center gap-2 px-3 [&::-webkit-details-marker]:hidden">
          <span className="shrink-0 text-body-sm text-text-secondary">{titreSection}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-secondary" aria-hidden />
          <span className="min-w-0 truncate text-body-sm font-medium text-text-primary">
            {ecranCourant}
          </span>
          <ChevronDown
            className="ml-auto h-4 w-4 shrink-0 text-text-secondary transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <nav aria-label="Autres écrans de cette section">
          <ul className="flex flex-col border-t border-surface-border">
            {blocs.map((bloc) =>
              bloc.href === actif ? (
                <li key={bloc.href}>
                  <span
                    aria-current="page"
                    className="flex h-row-standard items-center bg-primary/5 px-3 text-body-sm font-medium text-text-primary"
                  >
                    {bloc.titre}
                  </span>
                </li>
              ) : (
                <li key={bloc.href}>
                  <Link
                    href={bloc.href}
                    className="flex h-row-standard items-center px-3 text-body-sm text-text-secondary"
                  >
                    {bloc.titre}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      </details>

      {/* Bureau : la rangée, qui passe à la ligne quand il le faut. */}
      <nav aria-label="Autres écrans de cette section" className="hidden md:block">
        <ul className="flex flex-wrap gap-2">
          {blocs.map((bloc) => {
            const courant = bloc.href === actif;
            return (
              <li key={bloc.href}>
                {courant ? (
                  <span
                    aria-current="page"
                    className="inline-flex h-8 items-center rounded-lg border border-primary bg-primary/5 px-3 text-body-sm font-medium text-text-primary"
                  >
                    {bloc.titre}
                  </span>
                ) : (
                  <Link
                    href={bloc.href}
                    className="inline-flex h-8 items-center rounded-lg border border-surface-border bg-surface-container-lowest px-3 text-body-sm text-text-secondary transition-colors hover:border-primary/50 hover:text-text-primary"
                  >
                    {bloc.titre}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
