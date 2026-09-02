import { UserRound } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getUtilisateur } from '@/services/utilisateur';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSidebarItems } from '@/lib/navigation';
import { DesactiverButton } from '../DesactiverButton';

const STATUT_BADGE = {
  ACTIF: 'success',
  INACTIF: 'neutral',
  BLOQUE: 'error',
} as const;

export default async function UtilisateurDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const utilisateur = await getUtilisateur(params.id);

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <LienRetour href="/utilisateurs">Retour aux utilisateurs</LienRetour>

        <Card>
          <CardContent className="flex flex-col gap-6 p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-on">
                <UserRound className="h-7 w-7" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-headline-sm text-text-primary">
                  {utilisateur.prenom} {utilisateur.nom}
                </p>
                <p className="truncate text-body-sm text-text-secondary">{utilisateur.email}</p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Badge variant="primary">{utilisateur.role}</Badge>
                <Badge shape="pill" variant={STATUT_BADGE[utilisateur.statut]}>
                  {utilisateur.statut}
                </Badge>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-4 border-t border-surface-border pt-4 text-body-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-secondary">Téléphone</dt>
                <dd className="text-text-primary">{utilisateur.telephone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Dernier accès</dt>
                <dd className="text-text-primary" data-mono>
                  {utilisateur.dernierAcces
                    ? new Date(utilisateur.dernierAcces).toLocaleString('fr-FR')
                    : 'Jamais connecté'}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Membre depuis</dt>
                <dd className="text-text-primary" data-mono>
                  {new Date(utilisateur.createdAt).toLocaleDateString('fr-FR')}
                </dd>
              </div>
            </dl>

            {utilisateur.statut === 'ACTIF' && ctx.role === 'DIRECTEUR' && (
              <div className="border-t border-surface-border pt-4">
                <DesactiverButton utilisateurId={utilisateur.id} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
