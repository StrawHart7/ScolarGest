import Link from 'next/link';
import { CreditCard, Plus } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAbonnements, listPlans, expirerAbonnementsEchus } from '@/services/abonnement';
import { statutEffectif, joursAvantEcheance } from '@/services/abonnement-acces';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSidebarItems } from '@/lib/navigation';
import { AbonnementRowActions } from './AbonnementRowActions';

const STATUT_BADGE = {
  ACTIF: 'success',
  EXPIRE: 'error',
  SUSPENDU: 'neutral',
  AUCUN: 'neutral',
} as const;

export default async function AbonnementsPage() {
  const ctx = await getTenantContext();
  // Constate les échéances dépassées avant d'afficher : sans planificateur
  // dans le MVP, l'ouverture de la console est le point de passage naturel.
  await expirerAbonnementsEchus();
  const abonnements = await listAbonnements();
  const plans = await listPlans();

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
            <h1 className="text-display-sm text-text-primary">Abonnements</h1>
            <p className="text-body-md text-text-secondary">
              Suivi des abonnements par école et validation manuelle des paiements.
            </p>
          </div>
          <Button asChild>
            <Link href="/super-admin/abonnements/nouveau" className="gap-2">
              <Plus className="h-4 w-4" aria-hidden />
              Nouvel abonnement
            </Link>
          </Button>
        </div>

        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="flex-row items-center justify-between border-b border-surface-border bg-surface-container-low/50 p-5">
            <CardTitle>Liste des abonnements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {abonnements.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <CreditCard className="h-8 w-8 text-text-secondary/50" aria-hidden />
                <p className="text-body-sm text-text-secondary">Aucun abonnement enregistré.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="h-row-dense border-b border-surface-border bg-surface text-label-md text-text-secondary">
                      <th className="py-2 pl-5 pr-3 font-semibold">Établissement</th>
                      <th className="px-3 py-2 font-semibold">Plan</th>
                      <th className="px-3 py-2 font-semibold">Statut</th>
                      <th className="px-3 py-2 font-semibold">Échéance</th>
                      <th className="px-3 py-2 font-semibold">Reste</th>
                      <th className="py-2 pl-3 pr-5 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-sm text-text-primary">
                    {abonnements.map((a) => (
                      <tr
                        key={a.id}
                        className="h-row-dense border-b border-surface-border/50 transition-colors last:border-0 hover:bg-surface-container-low"
                      >
                        <td className="py-2 pl-5 pr-3 font-medium">{a.etablissement.nom}</td>
                        <td className="px-3 py-2 text-text-secondary">
                          {a.plan.nom} ({Number(a.plan.prix).toLocaleString('fr-FR')} FCFA)
                        </td>
                        <td className="px-3 py-2">
                          <Badge shape="pill" variant={STATUT_BADGE[statutEffectif(a)]}>
                            {statutEffectif(a)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-text-secondary" data-mono>
                          {new Date(a.dateFin).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-3 py-2 text-text-secondary">
                          {joursAvantEcheance(a.dateFin) > 0
                            ? `${joursAvantEcheance(a.dateFin)} j`
                            : `échu depuis ${Math.abs(joursAvantEcheance(a.dateFin))} j`}
                        </td>
                        <td className="py-2 pl-3 pr-5">
                          <div className="flex flex-col items-end gap-2">
                            <Button asChild variant="secondary" size="sm">
                              <Link href={`/super-admin/abonnements/${a.id}/paiement`}>
                                Valider un paiement
                              </Link>
                            </Button>
                            <AbonnementRowActions
                              abonnementId={a.id}
                              statut={a.statut}
                              planActuelId={a.planId}
                              plans={plans.map((p) => ({ id: p.id, nom: p.nom }))}
                            />
                          </div>
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
