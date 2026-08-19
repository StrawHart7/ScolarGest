import Link from 'next/link';
import { UserPlus, Users2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listEnseignants, type StatutEnseignant } from '@/services/enseignant';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { EnseignantsFiltres } from './EnseignantsFiltres';

const STATUT_BADGE: Record<StatutEnseignant, { label: string; variant: 'success' | 'neutral' | 'warning' }> = {
  ACTIF: { label: 'Actif', variant: 'success' },
  INACTIF: { label: 'Inactif', variant: 'neutral' },
  CONGE: { label: 'Congé', variant: 'warning' },
  DEPART: { label: 'Départ', variant: 'neutral' },
};

export default async function EnseignantsPage({
  searchParams,
}: {
  searchParams: { q?: string; statut?: StatutEnseignant };
}) {
  const ctx = await getTenantContext();
  const enseignants = await listEnseignants({ search: searchParams.q, statut: searchParams.statut });
  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-display-sm text-text-primary">Liste des enseignants</h1>
          {canWrite && (
            <div className="flex items-center gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/etablissement/enseignants/import">Import Excel</Link>
              </Button>
              <Button asChild>
                <Link href="/etablissement/enseignants/nouveau" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Nouvel enseignant
                </Link>
              </Button>
            </div>
          )}
        </div>

        <Card>
          <div className="border-b border-surface-border p-4">
            <EnseignantsFiltres defaultSearch={searchParams.q ?? ''} defaultStatut={searchParams.statut ?? ''} />
          </div>

          {enseignants.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Users2 className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucun enseignant trouvé.</p>
              <p className="text-body-sm text-text-secondary">
                {canWrite
                  ? 'Créez votre premier enseignant pour commencer.'
                  : 'Aucun enseignant ne correspond à ces critères.'}
              </p>
              {canWrite && (
                <Button asChild size="sm">
                  <Link href="/etablissement/enseignants/nouveau">Nouvel enseignant</Link>
                </Button>
              )}
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Nom &amp; Prénoms</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enseignants.map((enseignant) => (
                  <TableRow key={enseignant.id}>
                    <TableCell data-mono>{enseignant.matricule}</TableCell>
                    <TableCell className="font-medium">
                      {enseignant.nom} {enseignant.prenoms}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUT_BADGE[enseignant.statut].variant} shape="pill">
                        {STATUT_BADGE[enseignant.statut].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/etablissement/enseignants/${enseignant.id}`}
                        className="text-text-secondary hover:text-primary-container"
                      >
                        Voir la fiche
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
