import Link from 'next/link';
import { ArrowRight, Check, PartyPopper } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { etatSocle, type ElementSocle } from '@/services/configuration';
import { getSidebarItems } from '@/lib/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
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
        <div className="hidden md:block">
          <PageHeader
            title="Configuration de votre établissement"
            description="Ce qui reste à régler pour que tout fonctionne. Chaque ligne mène à l’écran qui la répare, et revient ici."
          />
        </div>

        {socle.complet ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <PartyPopper className="h-10 w-10 text-primary" aria-hidden />
              <h2 className="text-display-sm text-text-primary">Votre établissement est configuré</h2>
              {/*
                La question a été posée telle quelle : « une fois les
                indispensables faits, les autres passent où ? ». Ils restent ici
                — cet écran ne disparaît pas, il change de rôle. Le dire
                explicitement coûte une phrase et évite de croire qu'on a tout
                vu.
              */}
              <p className="max-w-prose text-body-sm text-text-secondary">
                Tout l’indispensable est en place. Les réglages « pour aller au bout » restent
                listés ci-dessous, et cette page reste accessible depuis Établissement ›
                Configuration.
              </p>
              <Button asChild variant="primary">
                <Link href="/dashboard">Aller au tableau de bord</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4 py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-body-md text-text-primary">
                  <span className="text-display-sm tabular-nums">{socle.faits}</span>
                  <span className="text-text-secondary"> sur {socle.total} réglages indispensables</span>
                </p>
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
                <div className="h-full rounded-full bg-primary" style={{ width: `${pourcentage}%` }} />
              </div>
            </CardContent>
          </Card>
        )}

        <SectionSocle titre="Indispensable" elements={socle.requis} />
        <SectionSocle
          titre="Pour aller au bout"
          description="Facultatif, et souvent ignoré faute de savoir que ça existe."
          elements={socle.recommandes}
        />
      </div>
    </AppLayout>
  );
}

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

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-body-md font-medium text-text-primary">{titre}</h2>
        {description ? <p className="text-body-sm text-text-secondary">{description}</p> : null}
      </div>

      <ul className="flex flex-col gap-2">
        {elements.map((element) => (
          <li
            key={element.id}
            className="flex flex-col gap-3 rounded-lg border border-surface-border bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between"
          >
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
        ))}
      </ul>
    </section>
  );
}
