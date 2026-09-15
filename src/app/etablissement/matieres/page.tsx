import { BookOpen } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listMatieres } from '@/services/matiere';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { PageHeader } from '@/components/layout/PageHeader';
import { SousTitreMobile } from '@/components/layout/SousTitreMobile';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { BarreListe } from '@/components/ui/barre-liste';
import { PaginationListe, TriColonne } from '@/components/ui/liste-toolbar';
import { lireParametresListe, preparerListe } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';
import { MatiereForm } from './MatiereForm';
import { MatiereRowActions } from './MatiereRowActions';
import { EtatVide } from '@/components/ui/etat-vide';

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
      <div className="space-y-4 md:space-y-6">
        <LienRetour href="/etablissement/configuration">Retour à la configuration</LienRetour>

        {/* Sur mobile, le titre descend dans EnteteListe : le PageHeader ferait
            doublon avec la ligne de densité. */}
        <div className="hidden md:block">
          <PageHeader
            title="Matières"
            description="Ce que votre école enseigne. Le programme national les apporte à la création de vos classes ; ajoutez ici celles qui vous sont propres."
          />
        </div>

        <SousTitreMobile>Ce que votre école enseigne. Le programme national les apporte à la création de vos classes.</SousTitreMobile>

        <BarreListe
          placeholderRecherche="Nom, code ou description…"
          filtres={[
            {
              parametre: 'statut',
              libelle: 'Statut',
              options: [
                { valeur: 'ACTIF', libelle: 'Actif' },
                { valeur: 'INACTIF', libelle: 'Inactif' },
              ],
              libelleTout: 'Tous les statuts',
            },
          ]}
          tri={[
            { cle: 'nom', libelle: 'Nom' },
            { cle: 'code', libelle: 'Code' },
            { cle: 'statut', libelle: 'Statut' },
          ]}
          actions={canWrite && <MatiereForm />}
        />

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <EnteteListe
            titre="Matières"
            compte={`${page.total} matière${page.total > 1 ? 's' : ''}`}
          />

          {page.total === 0 ? (
            <CardContent>
              <EtatVide
                icone={BookOpen}
                titre="Aucune matière"
                explication="Les matières du programme national arrivent toutes seules à la création de vos classes. Ajoutez-en une ici si votre école en enseigne une qui n’y figure pas."
                action={canWrite && <MatiereForm />}
              />
            </CardContent>
          ) : (
            <>
              <div className="hidden md:block">
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
              </div>

              <CarteListeMobile>
                {page.lignes.map((matiere) => (
                  <LigneCarteMobile
                    key={matiere.id}
                    icone={BookOpen}
                    titre={matiere.nom}
                    reference={matiere.code ?? undefined}
                    sousTitre={matiere.description ?? undefined}
                    statut={{
                      libelle: matiere.statut === 'ACTIF' ? 'Actif' : 'Inactif',
                      ton: matiere.statut === 'ACTIF' ? 'succes' : 'neutre',
                    }}
                    actions={canWrite && <MatiereRowActions matiere={matiere} />}
                  />
                ))}
              </CarteListeMobile>
            </>
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
