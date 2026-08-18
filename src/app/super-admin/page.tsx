import Link from 'next/link';
import { Building2, CreditCard, Plus, ShieldCheck } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listEtablissements } from '@/services/etablissement';
import { listAbonnements } from '@/services/abonnement';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { getSidebarItems } from '@/lib/navigation';

const STATUT_BADGE = {
  ACTIF: 'success',
  INACTIF: 'neutral',
  SUSPENDU: 'error',
} as const;

export default async function SuperAdminPage() {
  const ctx = await getTenantContext();
  const [etablissements, abonnements] = await Promise.all([listEtablissements(), listAbonnements()]);

  const abonnementsActifs = abonnements.filter((a) => a.statut === 'ACTIF').length;
  const enAttente = etablissements.length - abonnements.length;

  return (
    <AppLayout
      items={getSidebarItems('SUPER_ADMIN')}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-sm text-text-primary">Vue d&apos;ensemble</h1>
            <p className="text-body-md text-text-secondary">
              Gérez les écoles clientes et surveillez les abonnements de la plateforme.
            </p>
          </div>
          <Button asChild>
            <Link href="/super-admin/etablissements/nouveau" className="gap-2">
              <Plus className="h-4 w-4" aria-hidden />
              Nouvel établissement
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            label="Total écoles"
            value={etablissements.length}
            icon={<Building2 className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Abonnements actifs"
            value={abonnementsActifs}
            icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="En attente d'abonnement"
            value={enAttente}
            icon={<CreditCard className="h-5 w-5" aria-hidden />}
          />
        </div>

        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="flex-row items-center justify-between border-b border-surface-border bg-surface-container-low/50 p-5">
            <CardTitle>Liste des établissements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {etablissements.length === 0 ? (
              <p className="p-5 text-body-sm text-text-secondary">
                Aucun établissement pour le moment.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="h-row-dense border-b border-surface-border bg-surface text-label-md text-text-secondary">
                      <th className="py-2 pl-5 pr-3 font-semibold">Établissement</th>
                      <th className="px-3 py-2 font-semibold">Ville</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Statut</th>
                      <th className="py-2 pl-3 pr-5 text-right font-semibold">Créé le</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-sm text-text-primary">
                    {etablissements.map((etab) => (
                      <tr
                        key={etab.id}
                        className="h-row-dense border-b border-surface-border/50 transition-colors last:border-0 hover:bg-surface-container-low"
                      >
                        <td className="py-2 pl-5 pr-3 font-medium">
                          <Link
                            href={`/super-admin/etablissements/${etab.id}`}
                            className="text-text-primary hover:text-primary-container"
                          >
                            {etab.nom}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-text-secondary">{etab.ville ?? '—'}</td>
                        <td className="px-3 py-2 text-text-secondary">{etab.email ?? '—'}</td>
                        <td className="px-3 py-2">
                          <Badge shape="pill" variant={STATUT_BADGE[etab.statut]}>
                            {etab.statut}
                          </Badge>
                        </td>
                        <td
                          className="py-2 pl-3 pr-5 text-right text-text-secondary"
                          data-mono
                        >
                          {new Date(etab.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
