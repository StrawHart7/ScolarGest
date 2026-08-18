import Link from 'next/link';
import { ArrowLeft, Users2, School } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getClasse } from '@/services/classe';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';

export default async function ClasseDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const classe = await getClasse(params.id);

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href={`/etablissement/classes?anneeScolaireId=${classe.anneeScolaireId}`}
          className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour aux classes
        </Link>

        <Card>
          <CardContent className="flex flex-col gap-6 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
                <School className="h-7 w-7" aria-hidden />
              </div>
              <div>
                <p className="text-headline-sm text-text-primary">{classe.nom}</p>
                <p className="text-body-sm text-text-secondary">
                  {classe.niveau.nom}
                  {classe.serie ? ` — Série ${classe.serie.nom}` : ''}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-4 border-t border-surface-border pt-4 text-body-sm">
              <div>
                <dt className="text-text-secondary">Capacité</dt>
                <dd className="text-text-primary" data-mono>
                  {classe.capacite ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Créée le</dt>
                <dd className="text-text-primary" data-mono>
                  {new Date(classe.createdAt).toLocaleDateString('fr-FR')}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Élèves inscrits</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users2 className="h-8 w-8 text-text-secondary/50" aria-hidden />
            <p className="text-body-sm text-text-secondary">
              La gestion des inscriptions arrive en Phase 2.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
