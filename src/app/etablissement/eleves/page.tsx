import Link from 'next/link';
import { FileSpreadsheet, GraduationCap, UserPlus, Users2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listElevesPage, type StatutEleve } from '@/services/eleve';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  CarteListeMobile,
  EnteteListe,
  LigneCarteMobile,
  type TonStatut,
} from '@/components/ui/carte-liste-mobile';
import { BarreOutilsListe, BoutonFlottant, BoutonOutilPrincipal } from '@/components/ui/actions-mobile';
import { FiltresMobile } from '@/components/ui/filtres-mobile';
import {
  FiltreListe,
  PaginationListe,
  RechercheListe,
  TriColonne,
} from '@/components/ui/liste-toolbar';
import { bornesPage, lireParametresListe, paginationDepuisBase } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';

const STATUT_BADGE: Record<
  StatutEleve,
  { label: string; variant: 'success' | 'neutral' | 'warning'; ton: TonStatut }
> = {
  ACTIF: { label: 'Actif', variant: 'success', ton: 'succes' },
  INACTIF: { label: 'Inactif', variant: 'neutral', ton: 'neutre' },
  ARCHIVE: { label: 'Archivé', variant: 'neutral', ton: 'neutre' },
  TRANSFERE: { label: 'Transféré', variant: 'warning', ton: 'alerte' },
};

const OPTIONS_STATUT = (Object.keys(STATUT_BADGE) as StatutEleve[]).map((statut) => ({
  valeur: statut,
  libelle: STATUT_BADGE[statut].label,
}));

export default async function ElevesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const lireUnique = (cle: string): string | undefined => {
    const brut = searchParams[cle];
    const valeur = Array.isArray(brut) ? brut[0] : brut;
    return valeur && valeur.length > 0 ? valeur : undefined;
  };

  // Recherche, tri **et** pagination sont délégués à la base : la page ne
  // rapatrie que les dix lignes affichées, quel que soit l'effectif de
  // l'établissement.
  const parametres = lireParametresListe(searchParams, { tri: 'nom' });
  const bornes = bornesPage(parametres.page, parametres.taillePage);

  const [ctx, resultat] = await Promise.all([
    getTenantContext(),
    listElevesPage(
      {
        search: lireUnique('q'),
        statut: lireUnique('statut') as StatutEleve | undefined,
      },
      { ...bornes, tri: parametres.tri, sens: parametres.sens },
    ),
  ]);

  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';
  const page = paginationDepuisBase(
    resultat.lignes,
    resultat.total,
    parametres.page,
    parametres.taillePage,
  );

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-4 md:space-y-6">
        {/* Sur mobile, le titre descend dans la ligne de densité au-dessus de
            la liste, et les actions deviennent bouton flottant + icône. */}
        <div className="hidden md:block">
          <PageHeader
            title="Liste des élèves"
            actions={
              canWrite && (
                <>
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/etablissement/eleves/import">
                      <FileSpreadsheet className="h-4 w-4" aria-hidden />
                      Import Excel
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/etablissement/eleves/nouvelle">
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Nouvel élève
                    </Link>
                  </Button>
                </>
              )
            }
          />
        </div>

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <BarreOutilsListe>
            <RechercheListe placeholder="Nom, prénoms ou matricule…" />
            <FiltresMobile nombreActifs={lireUnique('statut') ? 1 : 0}>
              <FiltreListe
                parametre="statut"
                libelle="Statut"
                options={OPTIONS_STATUT}
                libelleTout="Tous les statuts"
              />
            </FiltresMobile>
            {canWrite && (
              <BoutonOutilPrincipal
                href="/etablissement/eleves/import"
                libelle="Import Excel"
                icone={FileSpreadsheet}
              />
            )}
          </BarreOutilsListe>

          <EnteteListe
            titre="Liste des élèves"
            compte={`${page.total} élève${page.total > 1 ? 's' : ''}`}
          />

          {page.total === 0 ? (
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
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* Le matricule n'est plus en liste : il identifie un élève
                          sur sa fiche, pas dans un tableau de parcours. */}
                      <TriColonne cle="nom">Nom &amp; Prénoms</TriColonne>
                      <TriColonne cle="statut">Statut</TriColonne>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.lignes.map((eleve) => (
                      <TableRow key={eleve.id}>
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
                            className="text-text-secondary transition-colors hover:text-primary-container hover:underline"
                          >
                            Voir la fiche
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <CarteListeMobile>
                {page.lignes.map((eleve) => (
                  <LigneCarteMobile
                    key={eleve.id}
                    href={`/etablissement/eleves/${eleve.id}`}
                    icone={GraduationCap}
                    titre={`${eleve.nom} ${eleve.prenoms}`}
                    reference={eleve.matricule}
                    sousTitre={eleve.classeNom ?? undefined}
                    statut={{
                      libelle: STATUT_BADGE[eleve.statut].label,
                      ton: STATUT_BADGE[eleve.statut].ton,
                    }}
                  />
                ))}
              </CarteListeMobile>

              <PaginationListe
                page={page.page}
                nombrePages={page.nombrePages}
                debut={page.debut}
                fin={page.fin}
                total={page.total}
                libelle="élève(s)"
              />
            </>
          )}
        </Card>
      </div>

      {canWrite && (
        <BoutonFlottant
          href="/etablissement/eleves/nouvelle"
          libelle="Nouvel élève"
          icone={UserPlus}
        />
      )}
    </AppLayout>
  );
}
