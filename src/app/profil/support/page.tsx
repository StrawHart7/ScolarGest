import { redirect } from 'next/navigation';
import { getTenantContext } from '@/services/tenant';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { getSidebarItems } from '@/lib/navigation';
import { Badge } from '@/components/ui/badge';
import { listDemandesSupportEtablissement } from '@/services/support';
import { libelleCategorie, LIBELLES_STATUT_SUPPORT, type StatutSupport } from '@/lib/support';
import { FormulaireSupport } from './FormulaireSupport';

export const metadata = { title: 'Contacter le support' };

const TON: Record<StatutSupport, 'neutral' | 'primary' | 'success' | 'warning'> = {
  NOUVELLE: 'primary',
  EN_COURS: 'warning',
  RESOLUE: 'success',
  FERMEE: 'neutral',
};

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Contacter le support, et relire ce que l'école a déjà envoyé.
 *
 * L'historique est sous le formulaire, pas sur un autre écran : quelqu'un qui
 * vient signaler un problème doit voir d'un coup d'œil qu'un collègue l'a déjà
 * signalé, et lire la réponse reçue plutôt que rouvrir la même demande.
 *
 * La page est sous `/profil` **délibérément** — voir `src/services/support.ts` :
 * c'est ce qui la laisse accessible à une école passée en lecture seule.
 */
export default async function SupportPage({
  searchParams,
}: {
  searchParams?: { depuis?: string };
}) {
  const ctx = await getTenantContext();
  // Le SUPER_ADMIN n'a pas d'établissement : il n'écrit pas au support, il y
  // répond. Le laisser ici produirait une liste vide et un formulaire qui
  // échoue à l'envoi, sans dire pourquoi.
  if (ctx.role === 'SUPER_ADMIN') redirect('/super-admin/support');
  const demandes = await listDemandesSupportEtablissement();

  // Chemin d'origine repris de l'URL, jamais une URL absolue : on ne veut ni
  // stocker un domaine, ni rendre cliquable ce qu'un tiers pourrait injecter.
  const brut = searchParams?.depuis ?? null;
  const pageOrigine = brut && brut.startsWith('/') && !brut.startsWith('//') ? brut : null;

  // Le support n'a pas de parent : la bulle flottante l'ouvre depuis n'importe
  // quel ecran. Un retour en dur vers `/profil` serait donc faux la plupart du
  // temps — on ne remonte que vers d'ou l'on vient, et seulement si l'entree de
  // barre laterale correspondante donne un nom a annoncer. Sans nom, pas de
  // lien : « Retour » seul ne dit pas ou l'on va.
  const entreeOrigine = pageOrigine
    ? getSidebarItems(ctx.role).find(
        (item) => pageOrigine === item.href || pageOrigine.startsWith(`${item.href}/`),
      )
    : undefined;

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-3xl space-y-8">
        {pageOrigine && entreeOrigine && (
          <LienRetour href={pageOrigine}>Retour — {entreeOrigine.label}</LienRetour>
        )}

        <div>
          <h1 className="text-display-sm text-text-primary">Contacter le support</h1>
          <p className="text-body-sm text-text-secondary">
            Décrivez votre problème : l&apos;équipe ScolarGest vous répond ici même. Consultez
            d&apos;abord l&apos;aide, la réponse s&apos;y trouve souvent.
          </p>
        </div>

        <section className="rounded-xl border border-surface-border bg-surface-container-lowest p-5">
          <FormulaireSupport pageOrigine={pageOrigine} />
        </section>

        <section className="space-y-3">
          <h2 className="text-headline-sm text-text-primary">Demandes de votre établissement</h2>
          {demandes.length === 0 ? (
            <p className="rounded-lg border border-surface-border bg-surface-container-lowest px-5 py-8 text-center text-body-sm text-text-secondary">
              Aucune demande envoyée pour le moment.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {demandes.map((demande) => (
                <article
                  key={demande.id}
                  className="rounded-xl border border-surface-border bg-surface-container-lowest p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body-md font-semibold text-text-primary">
                        {demande.sujet}
                      </p>
                      <p className="text-body-sm text-text-secondary">
                        {libelleCategorie(demande.categorie)} — {demande.auteurNom},{' '}
                        {dateCourte(demande.createdAt)}
                      </p>
                    </div>
                    <Badge shape="pill" variant={TON[demande.statut]}>
                      {LIBELLES_STATUT_SUPPORT[demande.statut]}
                    </Badge>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap rounded-lg border-l-2 border-surface-border bg-surface-container-low p-3 text-body-sm leading-relaxed text-text-secondary">
                    {demande.message}
                  </p>

                  {demande.reponseSupport && (
                    <div className="mt-3 rounded-lg border-l-2 border-primary-container bg-primary-fixed/40 p-3">
                      <p className="text-label-md font-semibold text-primary-container">
                        Réponse du support
                        {demande.repondueLe ? ` — ${dateCourte(demande.repondueLe)}` : ''}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-body-sm leading-relaxed text-text-primary">
                        {demande.reponseSupport}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
