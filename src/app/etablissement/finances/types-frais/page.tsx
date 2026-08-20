import { Wallet } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { peutEcrire } from '@/services/abonnement';
import { listTypesFrais } from '@/services/type-frais';
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
import { TypeFraisForm } from './TypeFraisForm';
import { TypeFraisRowActions } from './TypeFraisRowActions';

export default async function TypesFraisPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await getTenantContext();
  const typesFrais = await listTypesFrais(true);
  const canWrite =
    (ctx.role === 'COMPTABLE' || ctx.role === 'SUPER_ADMIN') && (await peutEcrire());

  const parametres = lireParametresListe(searchParams, { tri: 'nom' });
  const statutFiltre = searchParams.statut;
  const filtres =
    typeof statutFiltre === 'string' && statutFiltre
      ? typesFrais.filter((t) => t.statut === statutFiltre)
      : typesFrais;
  const page = preparerListe(filtres, parametres, {
    champsRecherche: (t) => [t.nom, t.description],
    valeursTri: { nom: (t) => t.nom, statut: (t) => t.statut },
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
          <h1 className="text-display-sm text-text-primary">Types de frais</h1>
          <p className="text-body-md text-text-secondary">
            Catégories de frais de l&apos;établissement (scolarité, inscription, cantine…). Elles
            servent de base aux tarifs par classe et aux lignes de facture.
          </p>
        </div>

        <Card>
          <div className="flex flex-wrap items-center gap-4 border-b border-surface-border p-4">
            <RechercheListe placeholder="Libellé ou description…" />
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
                <TypeFraisForm />
              </div>
            )}
          </div>

          {page.total === 0 ? (
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
                  <TriColonne cle="nom">Libellé</TriColonne>
                  <TableHead>Description</TableHead>
                  <TriColonne cle="statut">Statut</TriColonne>
                  {canWrite && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.lignes.map((typeFrais) => (
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

          <PaginationListe
            page={page.page}
            nombrePages={page.nombrePages}
            debut={page.debut}
            fin={page.fin}
            total={page.total}
            libelle="type(s) de frais"
          />
        </Card>
      </div>
    </AppLayout>
  );
}
