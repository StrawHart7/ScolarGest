import Link from 'next/link';
import { UserPlus, Users2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listEleves, type StatutEleve } from '@/services/eleve';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { ElevesFiltres } from './ElevesFiltres';

const STATUT_BADGE: Record<StatutEleve, { label: string; variant: 'success' | 'neutral' | 'warning' }> = {
  ACTIF: { label: 'Actif', variant: 'success' },
  INACTIF: { label: 'Inactif', variant: 'neutral' },
  ARCHIVE: { label: 'Archivé', variant: 'neutral' },
  TRANSFERE: { label: 'Transféré', variant: 'warning' },
};

export default async function ElevesPage({
  searchParams,
}: {
  searchParams: { q?: string; statut?: StatutEleve };
}) {
  const ctx = await getTenantContext();
  const eleves = await listEleves({ search: searchParams.q, statut: searchParams.statut });
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
          <h1 className="text-display-sm text-text-primary">Liste des élèves</h1>
          {canWrite && (
            <div className="flex items-center gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/etablissement/eleves/passage">Passage de cohorte</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/etablissement/eleves/import">Import Excel</Link>
              </Button>
              <Button asChild>
                <Link href="/etablissement/eleves/nouvelle" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Nouvel élève
                </Link>
              </Button>
            </div>
          )}
        </div>

        <Card>
          <div className="border-b border-surface-border p-4">
            <ElevesFiltres defaultSearch={searchParams.q ?? ''} defaultStatut={searchParams.statut ?? ''} />
          </div>

          {eleves.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Users2 className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucun élève trouvé.</p>
              <p className="text-body-sm text-text-secondary">
                {canWrite
                  ? 'Créez votre premier élève pour commencer.'
                  : 'Aucun élève ne correspond à ces critères.'}
              </p>
              {canWrite && (
                <Button asChild size="sm">
                  <Link href="/etablissement/eleves/nouvelle">Nouvel élève</Link>
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
                {eleves.map((eleve) => (
                  <TableRow key={eleve.id}>
                    <TableCell data-mono>{eleve.matricule}</TableCell>
                    <TableCell className="font-medium">
                      {eleve.nom} {eleve.prenoms}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUT_BADGE[eleve.statut].variant} shape="pill">
                        {STATUT_BADGE[eleve.statut].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/etablissement/eleves/${eleve.id}`}
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
