import Link from 'next/link';
import { getTenantContext } from '@/services/tenant';
import { listUtilisateurs } from '@/services/utilisateur';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSidebarItems } from '@/lib/navigation';
import { DesactiverButton } from './DesactiverButton';

const STATUT_BADGE = {
  ACTIF: 'success',
  INACTIF: 'neutral',
  BLOQUE: 'error',
} as const;

export default async function UtilisateursPage() {
  const ctx = await getTenantContext();
  const utilisateurs = await listUtilisateurs();

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-display-sm text-text-primary">Utilisateurs</h1>
            <p className="text-body-md text-text-secondary">
              {utilisateurs.length} utilisateur(s) dans votre établissement
            </p>
          </div>
          <Button asChild>
            <Link href="/utilisateurs/inviter">Inviter un utilisateur</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des utilisateurs</CardTitle>
          </CardHeader>
          <CardContent>
            {utilisateurs.length === 0 ? (
              <p className="text-body-sm text-text-secondary">Aucun utilisateur pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-left text-label-md text-text-secondary">
                      <th className="py-2 pr-4">Nom</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Rôle</th>
                      <th className="py-2 pr-4">Statut</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {utilisateurs.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-surface-border transition-colors last:border-0 hover:bg-surface-container-low"
                      >
                        <td className="py-3 pr-4 font-medium">
                          <Link
                            href={`/utilisateurs/${u.id}`}
                            className="text-text-primary hover:text-primary-container"
                          >
                            {u.prenom} {u.nom}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-text-secondary">{u.email}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="primary">{u.role}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={STATUT_BADGE[u.statut]}>{u.statut}</Badge>
                        </td>
                        <td className="py-3">
                          {u.statut === 'ACTIF' && <DesactiverButton utilisateurId={u.id} />}
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
