import Link from 'next/link';
import {
  Building2,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Inbox,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getMetriquesPlateforme, type EtatEcole } from '@/services/plateforme';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { getSidebarItems } from '@/lib/navigation';
import { formaterFCFA } from '@/lib/tarifs';

export const metadata = { title: 'Vue d’ensemble' };

/**
 * Tableau de bord de la plateforme.
 *
 * Auparavant, cette page était la liste des établissements avec trois
 * compteurs au-dessus. Elle répond maintenant aux questions qu'on se pose
 * réellement en ouvrant une console SaaS : combien ça rapporte, qui est sur le
 * point de partir, et qui attend une réponse.
 *
 * La liste des écoles vit désormais sur `/super-admin/etablissements` : mêler
 * un tableau de bord et un inventaire produisait une page qui ne faisait bien
 * ni l'un ni l'autre.
 */

const TON_ETAT: Record<EtatEcole, 'success' | 'warning' | 'error' | 'neutral' | 'primary'> = {
  ACTIF: 'success',
  ESSAI: 'primary',
  EXPIRE: 'warning',
  SUSPENDU: 'error',
  AUCUN: 'neutral',
};

const LIBELLE_ETAT: Record<EtatEcole, string> = {
  ACTIF: 'Abonnées',
  ESSAI: 'En essai',
  EXPIRE: 'Expirées',
  SUSPENDU: 'Suspendues',
  AUCUN: 'Sans abonnement',
};

export default async function SuperAdminPage() {
  const ctx = await getTenantContext();
  const m = await getMetriquesPlateforme();

  return (
    <AppLayout
      items={getSidebarItems('SUPER_ADMIN')}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Vue d'ensemble"
          description="État commercial de la plateforme et écoles demandant une attention."
          actions={
            <div className="hidden md:block">
              <Button asChild>
                <Link href="/super-admin/etablissements/nouveau" className="gap-2">
                  <Plus className="h-4 w-4" aria-hidden />
                  Nouvel établissement
                </Link>
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Revenu mensuel"
            value={formaterFCFA(m.revenuMensuel)}
            icon={<TrendingUp className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Encaissé ce mois"
            value={formaterFCFA(m.encaisseCeMois)}
            icon={<Wallet className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Écoles"
            value={m.ecoles.length}
            icon={<Building2 className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Demandes en attente"
            value={m.demandesNouvelles}
            icon={<Inbox className="h-5 w-5" aria-hidden />}
          />
        </div>

        {/* Le revenu mensuel ramène l'annuel au douzième : sans cette
            précision, un chiffre qui paraît faible face aux encaissements
            passerait pour une erreur de calcul. */}
        <p className="text-body-sm text-text-secondary">
          Le revenu mensuel ramène les abonnements annuels au douzième, et ne compte que les
          abonnements réellement actifs.
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Card>
            <CardHeader className="border-b border-surface-border bg-surface-container-low/50 p-5">
              <CardTitle>Répartition des écoles</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <ul className="flex flex-col gap-3">
                {(Object.keys(LIBELLE_ETAT) as EtatEcole[]).map((etat) => (
                  <li key={etat} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2.5">
                      <Badge shape="pill" variant={TON_ETAT[etat]}>
                        {LIBELLE_ETAT[etat]}
                      </Badge>
                    </span>
                    <span className="text-body-md font-semibold text-text-primary" data-mono>
                      {m.parEtat[etat]}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between border-b border-surface-border bg-surface-container-low/50 p-5">
              <CardTitle>À relancer sous 7 jours</CardTitle>
              {m.echeancesProches.length > 0 && (
                <Badge shape="pill" variant="warning">
                  {m.echeancesProches.length}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {m.echeancesProches.length === 0 ? (
                <p className="p-5 text-body-sm text-text-secondary">
                  Aucune échéance proche. Rien à relancer cette semaine.
                </p>
              ) : (
                <ul className="divide-y divide-surface-border/60">
                  {m.echeancesProches.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/super-admin/etablissements/${e.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface-container-low"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-body-sm font-medium text-text-primary">
                            {e.nom}
                          </span>
                          <span className="block text-body-sm text-text-secondary">
                            {e.etat === 'ESSAI' ? 'Fin d’essai' : 'Échéance'}
                            {e.nombreEleves > 0 && ` · ${e.nombreEleves} élèves`}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <Badge
                            shape="pill"
                            variant={
                              (e.joursRestants ?? 0) <= 2 ? 'error' : 'warning'
                            }
                          >
                            {e.joursRestants} j
                          </Badge>
                          <ArrowRight
                            className="h-4 w-4 text-text-secondary"
                            aria-hidden
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {m.demandesNouvelles > 0 && (
          <Link
            href="/super-admin/demandes"
            className="flex items-center gap-4 rounded-xl border border-primary-container/40 bg-primary-fixed/40 p-5 transition-colors hover:bg-primary-fixed/60"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-primary-container" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-body-md font-medium text-text-primary">
                {m.demandesNouvelles} demande{m.demandesNouvelles > 1 ? 's' : ''} de démo sans
                réponse
              </span>
              <span className="block text-body-sm text-text-secondary">
                Chaque jour d’attente coûte un prospect.
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary-container" aria-hidden />
          </Link>
        )}
      </div>
    </AppLayout>
  );
}
