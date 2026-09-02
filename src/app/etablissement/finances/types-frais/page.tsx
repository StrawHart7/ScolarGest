import { Wallet } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { peutEcrire } from '@/services/abonnement';
import { listTypesFrais } from '@/services/type-frais';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { BarreOutilsListe } from '@/components/ui/actions-mobile';
import { FiltresMobile } from '@/components/ui/filtres-mobile';
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
    (ctx.role === 'COMPTABLE' || ctx.role === 'SECRETAIRE' || ctx.role === 'SUPER_ADMIN') &&
    (await peutEcrire());

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
      <div className="space-y-4 md:space-y-6">
        <LienRetour href="/etablissement/finances">Retour aux finances</LienRetour>

        {/* Sur mobile, le titre descend dans EnteteListe : le PageHeader ferait
            doublon avec la ligne de densité. */}
        <div className="hidden md:block">
          <PageHeader
            title="Types de frais"
            description="Catégories de frais de l'établissement (scolarité, inscription, cantine…). Elles servent de base aux tarifs par classe et aux lignes de facture."
          />
        </div>

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <BarreOutilsListe>
            <RechercheListe placeholder="Libellé ou description…" />
            <FiltresMobile nombreActifs={typeof statutFiltre === 'string' && statutFiltre ? 1 : 0}>
              <FiltreListe
                parametre="statut"
                libelle="Statut"
                options={[
                  { valeur: 'ACTIF', libelle: 'Actif' },
                  { valeur: 'INACTIF', libelle: 'Inactif' },
                ]}
                libelleTout="Tous les statuts"
              />
            </FiltresMobile>
            {canWrite && (
              <div className="md:ml-auto">
                <TypeFraisForm />
              </div>
            )}
          </BarreOutilsListe>

          <EnteteListe
            titre="Types de frais"
            compte={`${page.total} type${page.total > 1 ? 's' : ''}`}
          />

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
            <>
              <div className="hidden md:block">
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
              </div>

              <CarteListeMobile>
                {page.lignes.map((typeFrais) => (
                  <LigneCarteMobile
                    key={typeFrais.id}
                    icone={Wallet}
                    titre={typeFrais.nom}
                    sousTitre={typeFrais.description ?? undefined}
                    statut={{
                      libelle: typeFrais.statut === 'ACTIF' ? 'Actif' : 'Inactif',
                      ton: typeFrais.statut === 'ACTIF' ? 'succes' : 'neutre',
                    }}
                    actions={canWrite && <TypeFraisRowActions typeFrais={typeFrais} />}
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
            libelle="type(s) de frais"
          />
        </Card>
      </div>
    </AppLayout>
  );
}
