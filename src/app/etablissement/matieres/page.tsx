import { BookOpen } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listMatieres } from '@/services/matiere';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { MatiereForm } from './MatiereForm';
import { MatiereRowActions } from './MatiereRowActions';

export default async function MatieresPage() {
  const ctx = await getTenantContext();
  const matieres = await listMatieres();
  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Matières</h1>
          <p className="text-body-md text-text-secondary">
            Catalogue des matières de l&apos;établissement, utilisé par le programme et les affectations.
          </p>
        </div>

        {canWrite && (
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle matière</CardTitle>
            </CardHeader>
            <CardContent>
              <MatiereForm />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Liste des matières</CardTitle>
          </CardHeader>
          {matieres.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <BookOpen className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucune matière créée.</p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Statut</TableHead>
                  {canWrite && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matieres.map((matiere) => (
                  <TableRow key={matiere.id}>
                    <TableCell className="font-medium">{matiere.nom}</TableCell>
                    <TableCell data-mono>{matiere.code ?? '—'}</TableCell>
                    <TableCell className="text-text-secondary">{matiere.description ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={matiere.statut === 'ACTIF' ? 'success' : 'neutral'} shape="pill">
                        {matiere.statut === 'ACTIF' ? 'Actif' : 'Inactif'}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <MatiereRowActions matiere={matiere} />
                      </TableCell>
                    )}
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
