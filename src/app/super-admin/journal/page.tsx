import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listJournalAudit, getMetriquesPlateforme } from '@/services/plateforme';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarreListe } from '@/components/ui/barre-liste';
import { getSidebarItems } from '@/lib/navigation';
import { EntreeJournalLigne } from './EntreeJournalLigne';

export const metadata = { title: 'Journal d’audit' };

/**
 * Ancienne sentinelle du `Select` maison — Radix refuse une valeur vide sur un
 * `SelectItem`. `BarreListe` retire simplement le parametre quand le filtre
 * est sur « tout », si bien qu'elle n'est plus ecrite nulle part. Elle reste
 * neutralisee a la lecture : des liens vers une recherche filtree ont pu etre
 * partages, et ils portent encore `etablissement=TOUTES`.
 */
const TOUTES = 'TOUTES';

/**
 * Journal d'audit de la plateforme.
 *
 * `audit_log` était alimenté par chaque écriture sensible depuis la Phase 1,
 * mais n'était lisible que école par école. Aucune vue transverse n'existait :
 * impossible de répondre à « qui a annulé ce paiement, et quand », ni de voir
 * qu'une action anormale se répète chez plusieurs tenants.
 *
 * Les filtres passent par l'URL plutôt que par un état client. Trois raisons :
 * un lien vers une recherche se partage, la page reste rendue côté serveur, et
 * on évite `useSearchParams` qui imposerait une frontière `Suspense`.
 *
 * **Ils passent maintenant par `BarreListe`**, comme les autres listes de
 * l'application. La page composait sa propre rangée : une file de pastilles
 * de module écrites à la main, un `<input type="search">` brut avec ses classes
 * en dur — donc hors du système, ni la hauteur ni l'anneau de focus des autres
 * champs — un `Select`, et deux boutons « Filtrer » et « Effacer ». Soit un
 * quatrième dialecte de filtrage dans un produit qui en a déjà un.
 *
 * `BarreListe` écrit les mêmes paramètres d'URL, efface `page` à chaque
 * changement — rester en page 4 d'un résultat qui n'en compte plus qu'une
 * affichait un tableau vide sans explication — et affiche les filtres actifs
 * en pastilles retirables. La pagination continue de se construire ici.
 */
export default async function JournalPage({
  searchParams,
}: {
  searchParams: { module?: string; etablissement?: string; q?: string; page?: string };
}) {
  const ctx = await getTenantContext();
  const page = Number(searchParams.page ?? '1') || 1;

  const [journal, { ecoles }] = await Promise.all([
    listJournalAudit({
      module: searchParams.module || undefined,
      etablissementId:
        searchParams.etablissement && searchParams.etablissement !== TOUTES
          ? searchParams.etablissement
          : undefined,
      recherche: searchParams.q || undefined,
      page,
    }),
    getMetriquesPlateforme(),
  ]);

  const dernierePage = Math.max(1, Math.ceil(journal.total / journal.parPage));

  function lien(modifs: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    const base = {
      module: searchParams.module,
      etablissement: searchParams.etablissement,
      q: searchParams.q,
      page: searchParams.page,
      ...modifs,
    };
    for (const [cle, valeur] of Object.entries(base)) {
      if (valeur) p.set(cle, valeur);
    }
    const chaine = p.toString();
    return chaine ? `/super-admin/journal?${chaine}` : '/super-admin/journal';
  }

  return (
    <AppLayout
      items={getSidebarItems('SUPER_ADMIN')}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Journal d'audit"
          description={`${journal.total} écriture${journal.total > 1 ? 's' : ''} tracée${journal.total > 1 ? 's' : ''}, toutes écoles confondues.`}
        />

        <BarreListe
          placeholderRecherche="Une action, par exemple ANNULER_PAIEMENT…"
          filtres={[
            {
              parametre: 'module',
              libelle: 'Module',
              options: journal.modules.map((m) => ({ valeur: m, libelle: m })),
              libelleTout: 'Tous les modules',
            },
            {
              parametre: 'etablissement',
              libelle: 'École',
              options: ecoles.map((e) => ({ valeur: e.id, libelle: e.nom })),
              libelleTout: 'Toutes les écoles',
            },
          ]}
        />

        <Card className="overflow-hidden rounded-xl">
          <CardContent className="p-0">
            {journal.entrees.length === 0 ? (
              <p className="p-8 text-center text-body-sm text-text-secondary">
                Aucune écriture ne correspond à ces filtres.
              </p>
            ) : (
              <ul>
                {journal.entrees.map((entree) => (
                  <EntreeJournalLigne key={entree.id} entree={entree} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {dernierePage > 1 && (
          <div className="flex items-center justify-between gap-4">
            <Button asChild variant="secondary" disabled={page <= 1}>
              <Link href={lien({ page: String(Math.max(1, page - 1)) })}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Précédent
              </Link>
            </Button>
            <span className="text-body-sm text-text-secondary" data-mono>
              {page} / {dernierePage}
            </span>
            <Button asChild variant="secondary" disabled={page >= dernierePage}>
              <Link href={lien({ page: String(Math.min(dernierePage, page + 1)) })}>
                Suivant
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
