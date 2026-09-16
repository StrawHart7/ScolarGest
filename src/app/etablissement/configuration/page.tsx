import Link from 'next/link';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { etatSocle, type ElementSocle } from '@/services/configuration';
import { getSidebarItems } from '@/lib/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarreEtablissement } from '@/components/layout/BarreEtablissement';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Configuration' };

/**
 * La checklist de configuration de l'établissement.
 *
 * ## Pourquoi un troisième écran, après `/demarrage` et les conseils
 *
 * Les deux existants ont la forme opposée à ce qu'il faut ici.
 *
 * `/demarrage` est **linéaire, unique et sans retour** — chaque étape écrit en
 * base au moment où elle est validée, et `activerCycle` est définitive. Y
 * ajouter « invitez vos enseignants » forcerait soit à bloquer la fin, soit à
 * ne jamais finir. Le Directeur n'a pas les adresses de ses professeurs le
 * premier jour.
 *
 * Les conseils sont **rythmés pour ne pas harceler** : un par vingt-quatre
 * heures, jamais au premier écran d'une session. C'est exactement l'inverse de
 * ce qu'il faut pour « sans ça, vous n'avez pas terminé ».
 *
 * D'où cet écran : non linéaire, permanent, exhaustif, et qui ne bloque rien.
 * Il ne réimplémente rien — le contenu est le catalogue des conseils, lu sous
 * un autre axe.
 *
 * ## Deux sections, et une seule est comptée
 *
 * « Indispensable » est ce sans quoi l'école ne peut ni facturer ni éditer un
 * bulletin. « Pour aller au bout » est listé sans être compté : ne pas avoir
 * posé de filigrane n'est pas un manque, c'est un choix — mais un choix que
 * personne ne peut faire s'il ignore que le filigrane existe. C'est toute la
 * raison de sa présence ici.
 */
export default async function ConfigurationPage() {
  const [ctx, socle] = await Promise.all([getTenantContext(), etatSocle()]);
  const pourcentage = socle.total > 0 ? Math.round((socle.faits / socle.total) * 100) : 100;

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-4 md:space-y-6">
        <BarreEtablissement role={ctx.role} actif="/etablissement/configuration" />

        <div className="hidden md:block">
          <PageHeader
            title="Configuration de votre établissement"
            description="Ce qui reste à régler pour que tout fonctionne. Chaque ligne mène à l’écran qui la répare, et revient ici."
          />
        </div>

        {/*
          **Une seule carte, dans les deux états.**

          Il y en avait deux, et celle de l'état fini était un écran de
          félicitations : cotillons, « Votre établissement est configuré », un
          paragraphe d'explication et un gros bouton. Le défaut est qu'une
          félicitation se mérite **une fois**, à la fin du parcours — c'est le
          rôle de `EcranFinal` à la sortie de `/demarrage`, et il le fait déjà.
          Rejouée à chaque ouverture de l'écran, elle cesse d'être une nouvelle
          et devient du décor qu'il faut dépasser pour atteindre la page. Le
          testeur l'a signalée deux fois le 2026-09-15, en la traversant chaque
          fois par « Retour à la configuration » depuis les classes.

          La barre pleine et « 9 sur 9 » disent la même chose, sans la fête, et
          se lisent d'un coup d'œil. La page redevient ce qu'elle est : les
          réglages de l'établissement.
        */}
        <Card>
          <CardContent className="flex flex-col gap-4 py-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-body-md text-text-primary">
                <span className="text-display-sm tabular-nums">{socle.faits}</span>
                <span className="text-text-secondary">
                  {' '}
                  sur {socle.total} réglages indispensables
                </span>
              </p>
              {/*
                `?tableau=1` y compris ici, et ce n'est pas un détail de
                cosmétique : sans lui, `/dashboard` refait un `etatSocle()`
                complet — une quinzaine d'allers-retours vers la base — pour
                décider de ne pas rediriger quelqu'un qui vient précisément de
                cet écran. La branche « en cours » portait déjà le paramètre ;
                celle de l'état fini l'avait oublié, et c'est ce lien-là qui
                tombait en erreur chez le testeur.
              */}
              <Link
                href="/dashboard?tableau=1"
                className="text-body-sm text-text-secondary underline underline-offset-4 hover:text-text-primary"
              >
                Aller au tableau de bord
              </Link>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-surface-container"
              role="progressbar"
              aria-valuenow={socle.faits}
              aria-valuemin={0}
              aria-valuemax={socle.total}
              aria-label="Avancement de la configuration"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pourcentage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <SectionSocle titre="Indispensable" elements={socle.requis} />
        <SectionSocle
          titre="Pour aller au bout"
          description="Facultatif, et souvent ignoré faute de savoir que ça existe."
          elements={socle.recommandes}
        />

        {/*
          La grille « Tous les réglages de l'établissement » vivait ici, en pied
          de page : dix blocs avec leur description, qui rattrapaient la page
          d'aiguillage supprimée.

          Elle part parce que `BarreEtablissement`, en tête d'écran, porte
          exactement les mêmes dix entrées — et les porte désormais sur **tous**
          les écrans de la section, pas seulement sur celui-ci. Les garder
          toutes les deux ferait dire deux fois la même chose au même écran, une
          fois en haut et une fois en bas.
        */}
      </div>
    </AppLayout>
  );
}

/**
 * Une section de la checklist — et, une fois tout coché, un simple repli.
 *
 * ## Pourquoi le repli
 *
 * Les neuf lignes de « Indispensable » mesurent près de 600px. Tant qu'il en
 * reste une à régler, c'est exactement ce qu'on vient chercher. Toutes cochées,
 * elles n'apprennent plus rien et repoussent sous la ligne de flottaison
 * « Pour aller au bout », qui est alors la **seule** section encore
 * actionnable de la page.
 *
 * La section garde sa place et son titre plutôt que de descendre sous l'autre :
 * une section qui change d'ordre selon son état se cherche à chaque visite. Ce
 * qui change est sa hauteur, pas son rang.
 *
 * `<details>` et non un état client : la page est rendue au serveur, et
 * l'ouverture d'un repli n'a aucune raison de coûter un composant client. Le
 * navigateur sait le faire seul, au clavier compris.
 *
 * Le résumé annonce **ce qu'il y a derrière le repli** — « 9 réglages » — et
 * non l'avancement : celui-ci est déjà sur la carte, en gros chiffres et en
 * barre pleine, deux centimètres plus haut. Le répéter ferait dire deux fois
 * la même chose à deux éléments qui se touchent.
 */
function SectionSocle({
  titre,
  description,
  elements,
}: {
  titre: string;
  description?: string;
  elements: ElementSocle[];
}) {
  if (elements.length === 0) return null;

  const tout = elements.every((element) => element.fait);

  if (tout) {
    return (
      <details className="group rounded-lg border border-surface-border bg-surface-container-lowest">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-on"
            aria-hidden
          >
            <Check className="h-4 w-4" />
          </span>
          <span className="min-w-0 text-body-md font-medium text-text-primary">{titre}</span>
          <span className="ml-auto shrink-0 text-body-sm tabular-nums text-text-secondary">
            {elements.length} réglages
          </span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-text-secondary transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="space-y-3 border-t border-surface-border p-4">
          {description ? <p className="text-body-sm text-text-secondary">{description}</p> : null}
          <ul className="flex flex-col gap-2">
            {elements.map((element) => (
              <LigneSocle key={element.id} element={element} />
            ))}
          </ul>
        </div>
      </details>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-body-md font-medium text-text-primary">{titre}</h2>
        {description ? <p className="text-body-sm text-text-secondary">{description}</p> : null}
      </div>

      <ul className="flex flex-col gap-2">
        {elements.map((element) => (
          <LigneSocle key={element.id} element={element} />
        ))}
      </ul>
    </section>
  );
}

function LigneSocle({ element }: { element: ElementSocle }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-surface-border bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span
          className={
            element.fait
              ? 'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-on'
              : 'mt-0.5 h-6 w-6 shrink-0 rounded-full border border-surface-border'
          }
          aria-hidden
        >
          {element.fait ? <Check className="h-4 w-4" /> : null}
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-body-md text-text-primary">{element.titre}</p>
          {/* Le texte du catalogue porte son propre chiffre — « 4 classes
              sur 6 » — parce que `formaterTexte` a déjà substitué les
              jetons côté serveur. Une fois fait, il n'apprend plus rien
              et n'est plus affiché. */}
          {element.fait ? null : (
            <p className="text-body-sm text-text-secondary">{element.texte}</p>
          )}
        </div>
      </div>

      {element.fait || !element.action ? null : element.actionnable ? (
        <Button asChild variant="primary" className="shrink-0 sm:ml-4">
          <Link href={element.action.href}>
            {element.action.label}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      ) : (
        <p className="shrink-0 text-body-sm text-text-secondary sm:ml-4">
          À faire par la direction.
        </p>
      )}
    </li>
  );
}
