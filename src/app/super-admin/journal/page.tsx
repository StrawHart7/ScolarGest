import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listJournalAudit, getMetriquesPlateforme } from '@/services/plateforme';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getSidebarItems } from '@/lib/navigation';
import { EntreeJournalLigne } from './EntreeJournalLigne';

export const metadata = { title: 'Journal d’audit' };

/** Sentinelle : Radix refuse une valeur vide sur un `SelectItem`. */
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

  const ecoleFiltree =
    searchParams.etablissement && searchParams.etablissement !== TOUTES
      ? searchParams.etablissement
      : undefined;
  const filtreActif = Boolean(searchParams.module || ecoleFiltree || searchParams.q);

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

        {/* Filtres en liens plutôt qu'en formulaire : une recherche se partage,
            et la page reste entièrement rendue côté serveur. */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-md uppercase tracking-wide text-text-secondary">
              Module
            </span>
            <Link
              href={lien({ module: undefined, page: undefined })}
              className={`rounded-full border px-3 py-1 text-body-sm transition-colors ${
                !searchParams.module
                  ? 'border-primary-container bg-primary-fixed/50 font-medium text-primary-container'
                  : 'border-surface-border text-text-secondary hover:border-primary-container/50'
              }`}
            >
              tous
            </Link>
            {journal.modules.map((m) => (
              <Link
                key={m}
                href={lien({ module: m, page: undefined })}
                className={`rounded-full border px-3 py-1 text-body-sm transition-colors ${
                  searchParams.module === m
                    ? 'border-primary-container bg-primary-fixed/50 font-medium text-primary-container'
                    : 'border-surface-border text-text-secondary hover:border-primary-container/50'
                }`}
              >
                {m}
              </Link>
            ))}
          </div>

          <form action="/super-admin/journal" method="get" className="flex flex-wrap gap-2">
            {searchParams.module && (
              <input type="hidden" name="module" value={searchParams.module} />
            )}
            <input
              type="search"
              name="q"
              defaultValue={searchParams.q ?? ''}
              placeholder="Rechercher une action, par exemple ANNULER_PAIEMENT"
              className="h-10 min-w-0 flex-1 rounded-lg border border-surface-border bg-surface-container-lowest px-3 text-body-md text-text-primary placeholder:text-text-secondary/60 focus-visible:border-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/20"
            />
            {/* `Select` du projet et non un `<select>` natif : la liste déroulante
                native est rendue par le système et échappe au design system.
                Radix soumet quand même via un `<select>` cache, donc le
                formulaire GET fonctionne tel quel.

                Radix refuse une valeur vide sur un item, d'ou la sentinelle
                `TOUTES`, neutralisee cote serveur. */}
            <Select name="etablissement" defaultValue={searchParams.etablissement ?? TOUTES}>
              <SelectTrigger className="h-10 w-full sm:w-56">
                <SelectValue placeholder="Toutes les écoles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOUTES}>Toutes les écoles</SelectItem>
                {ecoles.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="secondary">
              Filtrer
            </Button>
            {filtreActif && (
              <Button asChild variant="ghost">
                <Link href="/super-admin/journal">Effacer</Link>
              </Button>
            )}
          </form>
        </div>

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
