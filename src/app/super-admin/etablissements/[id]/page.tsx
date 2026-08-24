import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getEtablissement } from '@/services/etablissement';
import { listAbonnementsParEtablissement } from '@/services/abonnement';
import { listUtilisateursParEtablissement } from '@/services/utilisateur';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSidebarItems } from '@/lib/navigation';
import { InviterDirecteurForm } from './InviterDirecteurForm';

const ETAB_STATUT_BADGE = {
  ACTIF: 'success',
  INACTIF: 'neutral',
  SUSPENDU: 'error',
} as const;

const ABONNEMENT_STATUT_BADGE = {
  ACTIF: 'success',
  EXPIRE: 'error',
  SUSPENDU: 'neutral',
} as const;

const UTILISATEUR_STATUT_BADGE = {
  ACTIF: 'success',
  INACTIF: 'neutral',
  BLOQUE: 'error',
} as const;

export default async function EtablissementDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const [etablissement, abonnements, utilisateurs] = await Promise.all([
    getEtablissement(params.id),
    listAbonnementsParEtablissement(params.id),
    listUtilisateursParEtablissement(params.id),
  ]);

  return (
    <AppLayout
      items={getSidebarItems('SUPER_ADMIN')}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/super-admin"
          className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour aux établissements
        </Link>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
              <Building2 className="h-7 w-7" aria-hidden />
            </div>
            <div>
              <p className="text-headline-sm text-text-primary">{etablissement.nom}</p>
              <p className="text-body-sm text-text-secondary">
                {etablissement.ville ?? '—'} · {etablissement.email ?? '—'}
              </p>
            </div>
            <Badge shape="pill" variant={ETAB_STATUT_BADGE[etablissement.statut]} className="ml-auto">
              {etablissement.statut}
            </Badge>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="flex-row items-center justify-between border-b border-surface-border bg-surface-container-low/50 p-5">
            <CardTitle>Abonnements</CardTitle>
            <Button asChild variant="secondary" size="sm">
              <Link href="/super-admin/abonnements/nouveau">Nouvel abonnement</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {abonnements.length === 0 ? (
              <p className="p-5 text-body-sm text-text-secondary">Aucun abonnement enregistré.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="h-row-dense border-b border-surface-border bg-surface text-label-md text-text-secondary">
                      <th className="py-2 pl-5 pr-3 font-semibold">Plan</th>
                      <th className="px-3 py-2 font-semibold">Statut</th>
                      <th className="px-3 py-2 font-semibold">Échéance</th>
                      <th className="py-2 pl-3 pr-5 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-sm text-text-primary">
                    {abonnements.map((a) => (
                      <tr
                        key={a.id}
                        className="h-row-dense border-b border-surface-border/50 last:border-0 hover:bg-surface-container-low"
                      >
                        <td className="py-2 pl-5 pr-3 font-medium">{a.plan.nom}</td>
                        <td className="px-3 py-2">
                          <Badge shape="pill" variant={ABONNEMENT_STATUT_BADGE[a.statut]}>
                            {a.statut}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-text-secondary" data-mono>
                          {new Date(a.dateFin).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-2 pl-3 pr-5 text-right">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/super-admin/abonnements/${a.id}/paiement`}>
                              Valider un paiement
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 border-b border-surface-border bg-surface-container-low/50 p-5">
            <CardTitle className="pt-1.5">Utilisateurs</CardTitle>
            <div className="w-full sm:w-auto">
              <InviterDirecteurForm etablissementId={etablissement.id} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {utilisateurs.length === 0 ? (
              <p className="p-5 text-body-sm text-text-secondary">Aucun utilisateur créé.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="h-row-dense border-b border-surface-border bg-surface text-label-md text-text-secondary">
                      <th className="py-2 pl-5 pr-3 font-semibold">Nom</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Rôle</th>
                      <th className="py-2 pl-3 pr-5 font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-sm text-text-primary">
                    {utilisateurs.map((u) => (
                      <tr
                        key={u.id}
                        className="h-row-dense border-b border-surface-border/50 last:border-0 hover:bg-surface-container-low"
                      >
                        <td className="py-2 pl-5 pr-3 font-medium">
                          {u.prenom} {u.nom}
                        </td>
                        <td className="px-3 py-2 text-text-secondary">{u.email}</td>
                        <td className="px-3 py-2">
                          <Badge variant="primary">{u.role}</Badge>
                        </td>
                        <td className="py-2 pl-3 pr-5">
                          <Badge shape="pill" variant={UTILISATEUR_STATUT_BADGE[u.statut]}>
                            {u.statut}
                          </Badge>
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
