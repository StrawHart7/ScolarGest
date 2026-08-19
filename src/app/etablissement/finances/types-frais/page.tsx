import { Wallet } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listTypesFrais } from '@/services/type-frais';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { TypeFraisForm } from './TypeFraisForm';
import { TypeFraisRowActions } from './TypeFraisRowActions';

export default async function TypesFraisPage() {
  const ctx = await getTenantContext();
  const typesFrais = await listTypesFrais(true);
  const canWrite = ctx.role === 'COMPTABLE' || ctx.role === 'SUPER_ADMIN';

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Types de frais</h1>
          <p className="text-body-md text-text-secondary">
            Catégories de frais de l&apos;établissement (scolarité, inscription, cantine…). Elles
            servent de base aux tarifs par classe et aux lignes de facture.
          </p>
        </div>

        {canWrite && (
          <Card>
            <CardHeader>
              <CardTitle>Nouveau type de frais</CardTitle>
            </CardHeader>
            <CardContent>
              <TypeFraisForm />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Liste des types de frais</CardTitle>
          </CardHeader>
          {typesFrais.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Wallet className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucun type de frais créé.</p>
              <p className="text-body-sm text-text-secondary">
                Commencez par créer les catégories facturées par l&apos;école, puis définissez leur
                tarif classe par classe.
              </p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Statut</TableHead>
                  {canWrite && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {typesFrais.map((typeFrais) => (
                  <TableRow key={typeFrais.id}>
                    <TableCell className="font-medium">{typeFrais.nom}</TableCell>
                    <TableCell className="text-text-secondary">
                      {typeFrais.description ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={typeFrais.statut === 'ACTIF' ? 'success' : 'neutral'}
                        shape="pill"
                      >
                        {typeFrais.statut === 'ACTIF' ? 'Actif' : 'Inactif'}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <TypeFraisRowActions typeFrais={typeFrais} />
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
