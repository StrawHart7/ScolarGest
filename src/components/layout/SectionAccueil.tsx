import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { getSidebarItems, blocsSection, SECTIONS } from '@/lib/navigation';
import { ICONES } from '@/components/layout/icones-navigation';
import { getTenantContext } from '@/services/tenant';


/**
 * Page d'accueil d'une section : présente en blocs les fonctionnalités que le
 * regroupement de la sidebar a fait disparaître de la navigation de premier
 * niveau. Sans elle, réduire la sidebar reviendrait à cacher des écrans.
 */
export async function SectionAccueil({ chemin }: { chemin: string }) {
  const ctx = await getTenantContext();
  const section = SECTIONS[chemin];
  const blocs = blocsSection(chemin, ctx.role);

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">{section?.titre ?? 'Section'}</h1>
          <p className="max-w-3xl text-body-md text-text-secondary">{section?.description}</p>
        </div>

        {blocs.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-container-lowest py-16 text-center">
            <p className="text-body-md text-text-primary">
              Aucune fonctionnalité de cette section n&apos;est accessible à votre rôle.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {blocs.map((bloc) => {
              const Icone = ICONES[bloc.icone];
              return (
                <li key={bloc.href}>
                  <Link
                    href={bloc.href}
                    className="group flex h-full flex-col gap-3 rounded-lg border border-surface-border bg-surface-container-lowest p-5 transition-all hover:-translate-y-0.5 hover:border-primary-container/60 hover:shadow-floating"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary-fixed text-primary-container transition-colors group-hover:bg-primary-container group-hover:text-white">
                      <Icone className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-headline-sm text-text-primary">{bloc.titre}</span>
                    <span className="flex-1 text-body-sm text-text-secondary">
                      {bloc.description}
                    </span>
                    <span className="inline-flex items-center gap-1 text-body-sm font-medium text-primary-container">
                      Ouvrir
                      <ArrowRight
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
