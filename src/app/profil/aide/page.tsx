import Link from 'next/link';
import { LifeBuoy, Check, ArrowRight, Compass } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listerAide } from '@/services/conseils';
import { ORDRE_FAMILLES, LIBELLE_FAMILLE, type Famille } from '@/lib/conseils/catalogue';
import { questionsPourRole } from '@/lib/aide/questions';
import { AppLayout } from '@/components/layout/AppLayout';
import { getSidebarItems, SECTIONS, cheminAutorise } from '@/lib/navigation';
import { QuestionsFrequentes } from './QuestionsFrequentes';

export const metadata = { title: 'Aide' };

const LIBELLE_ROLE: Record<string, string> = {
  DIRECTEUR: 'direction',
  SECRETAIRE: 'secrétariat',
  COMPTABLE: 'comptabilité',
  ENSEIGNANT: 'enseignant',
  SUPER_ADMIN: 'plateforme',
};

/**
 * L'aide de l'établissement.
 *
 * ## Ce que cette page a corrigé, au-delà de sa forme
 *
 * Elle portait sept rubriques écrites en dur dans ce fichier, et **deux
 * d'entre elles étaient devenues fausses** sans que personne le remarque :
 *
 * - « les lignes d'une facture sont figées dès le premier versement » — règle
 *   retirée le 2026-09-16, sur demande de l'utilisateur ;
 * - « la réponse du support s'affichera sur cette page, visible par votre
 *   établissement » — une demande ne se relit que par son auteur depuis la
 *   migration `20260907221109`, pièces jointes comprises.
 *
 * Une aide fausse est pire qu'une aide absente : elle est crue, et elle
 * enseigne à l'école une règle que le produit n'applique plus. Le contenu vit
 * désormais dans `src/lib/aide/questions.ts`, avec la consigne qui va avec —
 * toute modification de comportement vient relire ce fichier.
 *
 * ## Trois sections, et un ordre qui n'est pas arbitraire
 *
 * On arrive ici **avec une question**, pas pour lire l'aide. Les questions
 * fréquentes passent donc en premier, derrière un champ de recherche.
 *
 * L'inventaire — « tout ce que vous pouvez faire » — vient ensuite : c'est la
 * réponse à une autre question, « qu'est-ce que je peux faire ici ? », que le
 * panneau de conseils ne peut pas donner en n'en proposant qu'un à la fois.
 *
 * La carte de la navigation ferme la page. Elle ne répond à rien, elle
 * oriente : c'est ce qu'on lit quand on n'a pas trouvé ailleurs.
 */
export default async function AidePage() {
  const ctx = await getTenantContext();
  const questions = questionsPourRole(ctx.role);

  // Inventaire de tout ce que la plateforme sait faire pour ce rôle, avec ce
  // qui est déjà en place. Le panneau de conseils n'en propose qu'un à la
  // fois — bon pour ne pas lasser, mauvais pour qui veut simplement savoir ce
  // qui existe.
  //
  // Le diagnostic coûte une vingtaine de comptages ; c'est assumé sur un écran
  // qu'on ouvre quelques fois par trimestre, et c'est précisément pourquoi il
  // ne tourne pas au rendu de chaque page.
  let inventaire: Awaited<ReturnType<typeof listerAide>> = [];
  try {
    inventaire = await listerAide();
  } catch {
    // Une aide amputée vaut mieux qu'une page d'aide inaccessible. Les
    // questions fréquentes, elles, ne dépendent d'aucune lecture.
  }
  const parFamille = ORDRE_FAMILLES.map((famille) => ({
    famille,
    lignes: inventaire.filter((ligne) => ligne.famille === famille),
  })).filter((groupe) => groupe.lignes.length > 0);
  const enPlace = inventaire.filter((ligne) => ligne.fait).length;

  // Les sections de la navigation sont filtrées par rôle : décrire à un
  // Enseignant une section « Finances » qu'il ne peut pas ouvrir lui apprend
  // seulement qu'on ne lui parle pas à lui.
  const sections = Object.entries(SECTIONS).filter(([chemin]) =>
    cheminAutorise(chemin, ctx.role),
  );

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-3xl space-y-8 md:space-y-10">
        <header className="space-y-1">
          <h1 className="text-display-sm text-text-primary">Aide</h1>
          <p className="text-body-sm text-text-secondary">
            {questions.length} réponses, choisies pour ce que vous faites au quotidien
            {LIBELLE_ROLE[ctx.role] ? ` (${LIBELLE_ROLE[ctx.role]})` : ''}. Cherchez par mots,
            ou parcourez par thème.
          </p>
        </header>

        <QuestionsFrequentes questions={questions} />

        {/* Le recours au support est posé **entre** les deux sections, et non
            tout en bas : c'est ici qu'on arrive quand les questions fréquentes
            n'ont rien donné, et c'est ici qu'il faut tendre l'autre canal. En
            pied de page, il serait sous l'inventaire, c'est-à-dire hors de
            portée de quelqu'un qui vient de renoncer. */}
        <section className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-5">
          <h2 className="text-headline-sm text-text-primary">
            Votre question n&apos;est pas ici ?
          </h2>
          <p className="mt-1 text-body-sm text-text-secondary">
            Écrivez à l&apos;équipe ScolarGest. Votre demande n&apos;est lisible que par vous —
            ni vos collègues ni les autres comptes de l&apos;établissement n&apos;y ont accès — et
            la réponse vous attend sur la page Support.
          </p>
          <Link
            href="/profil/support"
            className="mt-3 inline-flex items-center gap-1.5 text-body-sm font-medium text-primary-container hover:underline"
          >
            <LifeBuoy className="size-4" aria-hidden />
            Contacter le support
          </Link>
        </section>

        {parFamille.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-headline-sm text-text-primary">Tout ce que vous pouvez faire</h2>
              <p className="text-body-sm text-text-secondary">
                {enPlace === inventaire.length
                  ? 'Tout est en place pour votre rôle.'
                  : `${enPlace} sur ${inventaire.length} déjà en place. Le reste n’est pas un retard : c’est ce qui est encore possible.`}
              </p>
            </div>
            {parFamille.map((groupe) => (
              <div key={groupe.famille} className="space-y-2">
                <h3 className="text-body-sm font-medium text-text-secondary">
                  {LIBELLE_FAMILLE[groupe.famille as Famille]}
                </h3>
                <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface-container-lowest">
                  {groupe.lignes.map((ligne) => (
                    <li key={ligne.id} className="flex items-start gap-3 px-5 py-3">
                      {/*
                        La pastille dit l'état, jamais un reproche : ce qui
                        reste n'est pas un retard, c'est ce qui est encore
                        possible.
                      */}
                      <span
                        className={
                          ligne.fait
                            ? 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary-on-fixed'
                            : 'mt-0.5 size-5 shrink-0 rounded-full border border-surface-border'
                        }
                      >
                        {ligne.fait && <Check className="size-3" aria-hidden />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-body-md text-text-primary">{ligne.titre}</p>
                        <p className="text-body-sm text-text-secondary">{ligne.texte}</p>
                      </div>
                      {ligne.href && (
                        <Link
                          href={ligne.href}
                          className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-body-sm font-medium text-primary-container hover:underline"
                        >
                          Ouvrir
                          <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {sections.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-start gap-2.5">
              <Compass className="mt-0.5 size-4 shrink-0 text-text-secondary" aria-hidden />
              <div>
                <h2 className="text-headline-sm text-text-primary">Comment s’organise le menu</h2>
                <p className="text-body-sm text-text-secondary">
                  Chaque entrée de la barre latérale ouvre un écran, et porte en tête la rangée de
                  ceux qui l’accompagnent.
                </p>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {sections.map(([chemin, section]) => (
                <li key={chemin}>
                  <Link
                    href={chemin}
                    className="block h-full rounded-xl border border-surface-border bg-surface-container-lowest px-5 py-3 transition-colors hover:border-primary/40 hover:bg-surface-container-low"
                  >
                    <p className="text-body-md text-text-primary">{section.titre}</p>
                    <p className="text-body-sm text-text-secondary">{section.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
