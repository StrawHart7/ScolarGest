import { BookOpen } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listMatieres } from '@/services/matiere';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  FiltreListe,
  PaginationListe,
  RechercheListe,
  TriColonne,
} from '@/components/ui/liste-toolbar';
import { lireParametresListe, preparerListe } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';
import { MatiereForm } from './MatiereForm';
import { MatiereRowActions } from './MatiereRowActions';

export default async function MatieresPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await getTenantContext();
  const matieres = await listMatieres();
  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';

  const parametres = lireParametresListe(searchParams, { tri: 'nom' });
  const statutFiltre = searchParams.statut;
  const filtrees =
    typeof statutFiltre === 'string' && statutFiltre
      ? matieres.filter((m) => m.statut === statutFiltre)
      : matieres;
  const page = preparerListe(filtrees, parametres, {
    champsRecherche: (m) => [m.nom, m.code, m.description],
    valeursTri: {
      nom: (m) => m.nom,
      code: (m) => m.code,
      statut: (m) => m.statut,
    },
  });

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

        <Card>
          <div className="flex flex-wrap items-center gap-4 border-b border-surface-border p-4">
            <RechercheListe placeholder="Nom, code ou description…" />
            <FiltreListe
              parametre="statut"
              libelle="Statut"
              options={[
                { valeur: 'ACTIF', libelle: 'Actif' },
                { valeur: 'INACTIF', libelle: 'Inactif' },
              ]}
              libelleTout="Tous les statuts"
            />
            {canWrite && (
              <div className="ml-auto">
                <MatiereForm />
              </div>
            )}
          </div>

          {page.total === 0 ? (
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <BookOpen className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucune matière créée.</p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TriColonne cle="nom">Nom</TriColonne>
                  <TriColonne cle="code">Code</TriColonne>
                  <TableHead>Description</TableHead>
                  <TriColonne cle="statut">Statut</TriColonne>
                  {canWrite && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.lignes.map((matiere) => (
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

          <PaginationListe
            page={page.page}
            nombrePages={page.nombrePages}
            debut={page.debut}
            fin={page.fin}
            total={page.total}
            libelle="matière(s)"
          />
        </Card>
      </div>
    </AppLayout>
  );
}
