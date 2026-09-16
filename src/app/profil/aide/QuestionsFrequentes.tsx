'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  CreditCard,
  FileText,
  GraduationCap,
  LifeBuoy,
  Rocket,
  School,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { RechercheLocale } from '@/components/ui/liste-toolbar';
import {
  THEMES,
  correspond,
  type Question,
  type ThemeAide,
} from '@/lib/aide/questions';

/**
 * Table d'icônes typée, comme `icones-navigation.ts`.
 *
 * `Record<ThemeAide, LucideIcon>` fait échouer la compilation si un thème
 * ajouté au catalogue n'a pas son icône ici — c'est ce typage qui, sur la
 * navigation, avait révélé une table dupliquée et divergente. Aucune
 * résolution par chaîne : `lucide[nom]` empêcherait le bundler d'élaguer et
 * tomberait à l'exécution sur une faute de frappe.
 */
const ICONES: Record<ThemeAide, LucideIcon> = {
  DEMARRAGE: Rocket,
  CLASSES: School,
  ELEVES: Users,
  NOTES: GraduationCap,
  FINANCES: Wallet,
  COMPTES: ShieldCheck,
  DOCUMENTS: FileText,
  ABONNEMENT: CreditCard,
  PROBLEMES: LifeBuoy,
};

/**
 * Les questions fréquentes, cherchables.
 *
 * ## Pourquoi une recherche côté client
 *
 * Toute l'aide tient en mémoire — quelques dizaines d'entrées, aucune donnée
 * d'établissement. Un aller-retour serveur par frappe n'aurait rien de plus à
 * filtrer, et la page resterait utilisable hors ligne, ce qui n'est pas un
 * détail pour une école de Lomé un jour de coupure.
 *
 * ## Pourquoi la recherche plutôt qu'un sommaire
 *
 * Personne n'arrive ici pour lire l'aide : on arrive avec une question. Sept
 * rubriques se parcouraient à l'œil ; quarante ne se parcourent plus. Le champ
 * est donc le premier élément de l'écran, et les thèmes ne servent qu'à ranger
 * ce qu'il rend.
 *
 * ## Deux détails qui décident de l'usage
 *
 * **Une recherche qui ne trouve rien propose le support.** C'est exactement le
 * moment où quelqu'un renonce, et exactement celui où il faut lui tendre
 * l'autre canal.
 *
 * **Une seule réponse trouvée s'ouvre d'elle-même.** Refermer la seule réponse
 * de l'écran derrière un clic de plus serait une coquetterie.
 */
export function QuestionsFrequentes({ questions }: { questions: Question[] }) {
  const [recherche, setRecherche] = React.useState('');
  const [themeActif, setThemeActif] = React.useState<ThemeAide | null>(null);

  const retenues = React.useMemo(
    () =>
      questions.filter(
        (q) => correspond(q, recherche) && (themeActif === null || q.theme === themeActif),
      ),
    [questions, recherche, themeActif],
  );

  const groupes = React.useMemo(
    () =>
      THEMES.map((theme) => ({
        theme,
        lignes: retenues.filter((q) => q.theme === theme.id),
      })).filter((g) => g.lignes.length > 0),
    [retenues],
  );

  // Les thèmes proposés sont ceux qui ont quelque chose pour ce rôle : un
  // Enseignant n'a pas à voir un onglet « Abonnement » vide.
  const themesDisponibles = React.useMemo(
    () => THEMES.filter((theme) => questions.some((q) => q.theme === theme.id)),
    [questions],
  );

  const filtre = recherche.trim() !== '' || themeActif !== null;
  const seule = retenues.length === 1;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3">
        <RechercheLocale
          valeur={recherche}
          onChange={setRecherche}
          placeholder="Votre question en quelques mots…"
          className="md:w-full"
        />

        {/* Rangée de thèmes. Le repli « Tout » est en tête et porte l'état par
            défaut : sans lui, on ne saurait pas comment revenir à la liste
            entière après avoir choisi un thème. */}
        <div className="-mx-1 flex flex-wrap gap-2 px-1">
          <PuceTheme actif={themeActif === null} onClick={() => setThemeActif(null)}>
            Tout ({questions.length})
          </PuceTheme>
          {themesDisponibles.map((theme) => {
            const Icone = ICONES[theme.id];
            return (
              <PuceTheme
                key={theme.id}
                actif={themeActif === theme.id}
                onClick={() => setThemeActif(themeActif === theme.id ? null : theme.id)}
              >
                <Icone className="size-3.5 shrink-0" aria-hidden />
                {theme.titre}
              </PuceTheme>
            );
          })}
        </div>
      </div>

      {groupes.length === 0 ? (
        <div className="rounded-xl border border-surface-border bg-surface-container-lowest px-5 py-8 text-center">
          <p className="text-body-md text-text-primary">Aucune réponse ne correspond.</p>
          <p className="mx-auto mt-1 max-w-md text-body-sm text-text-secondary">
            Essayez d’autres mots, ou posez directement la question à l’équipe — c’est comme ça
            que cette page s’enrichit.
          </p>
          <Link
            href="/profil/support"
            className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-primary-container hover:underline"
          >
            <LifeBuoy className="size-4" aria-hidden />
            Poser ma question
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {groupes.map(({ theme, lignes }) => {
            const Icone = ICONES[theme.id];
            return (
              <div key={theme.id} className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <Icone className="mt-0.5 size-4 shrink-0 text-text-secondary" aria-hidden />
                  <div className="min-w-0">
                    <h3 className="text-body-md font-medium text-text-primary">{theme.titre}</h3>
                    {/* La description du thème ne s'affiche qu'en vue complète :
                        pendant une recherche, elle décrirait un ensemble dont
                        on ne voit qu'un fragment. */}
                    {filtre ? null : (
                      <p className="text-body-sm text-text-secondary">{theme.description}</p>
                    )}
                  </div>
                </div>

                <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface-container-lowest">
                  {lignes.map((ligne) => (
                    // La clé porte l'état d'ouverture par défaut : c'est ce qui
                    // remonte le repli quand la recherche se réduit à une seule
                    // réponse. Sans elle, React garderait l'élément en place et
                    // `open` se battrait avec ce que l'utilisateur a cliqué.
                    <li key={`${ligne.id}-${seule}`}>
                      <BlocQuestion question={ligne} ouvertParDefaut={seule} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PuceTheme({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      // 32px de haut sur bureau, 44 sous `md` : la cible se mesure sur
      // l'élément cliquable, jamais sur la pilule qu'il contient.
      className={[
        'inline-flex h-row-standard items-center gap-1.5 rounded-full border px-3 text-body-sm transition-colors md:h-8',
        actif
          ? 'border-primary bg-primary text-primary-on'
          : 'border-surface-border bg-surface-container-lowest text-text-secondary hover:bg-surface-container-low hover:text-text-primary',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/**
 * Une question et sa réponse.
 *
 * `<details>` et non un état React : le navigateur sait ouvrir un repli, au
 * clavier compris, et une page d'aide n'a aucune raison de payer un composant
 * interactif par ligne. `key` change avec `ouvertParDefaut` côté appelant —
 * c'est ce qui laisse le repli se rouvrir quand la recherche se réduit à une
 * seule réponse.
 */
function BlocQuestion({
  question,
  ouvertParDefaut,
}: {
  question: Question;
  ouvertParDefaut: boolean;
}) {
  return (
    <details className="group" open={ouvertParDefaut}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-container-low [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-body-md font-medium text-text-primary">
          {question.question}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-text-secondary transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="space-y-2 border-t border-surface-border px-5 py-4">
        {question.reponse.map((paragraphe) => (
          <p key={paragraphe.slice(0, 40)} className="text-body-sm leading-relaxed text-text-secondary">
            {paragraphe}
          </p>
        ))}

        {question.lien ? (
          <Link
            href={question.lien.href}
            className="inline-flex items-center gap-1.5 pt-1 text-body-sm font-medium text-primary-container hover:underline"
          >
            {question.lien.label}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
    </details>
  );
}
