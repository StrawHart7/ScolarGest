import Link from 'next/link';
import { FileSpreadsheet, UserPlus, Users2, UsersRound } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listEnseignants, type StatutEnseignant } from '@/services/enseignant';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
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
import { lireParametresListe, preparerListe } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';

const STATUT_BADGE: Record<
  StatutEnseignant,
  { label: string; variant: 'success' | 'neutral' | 'warning'; ton: TonStatut }
> = {
  ACTIF: { label: 'Actif', variant: 'success', ton: 'succes' },
  INACTIF: { label: 'Inactif', variant: 'neutral', ton: 'neutre' },
  CONGE: { label: 'Congé', variant: 'warning', ton: 'alerte' },
  DEPART: { label: 'Départ', variant: 'neutral', ton: 'neutre' },
};

const OPTIONS_STATUT = (Object.keys(STATUT_BADGE) as StatutEnseignant[]).map((statut) => ({
  valeur: statut,
  libelle: STATUT_BADGE[statut].label,
}));

export default async function EnseignantsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await getTenantContext();
  const lireUnique = (cle: string): string | undefined => {
    const brut = searchParams[cle];
    const valeur = Array.isArray(brut) ? brut[0] : brut;
    return valeur && valeur.length > 0 ? valeur : undefined;
  };

  const enseignants = await listEnseignants({
    search: lireUnique('q'),
    statut: lireUnique('statut') as StatutEnseignant | undefined,
  });
  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';

  const parametres = lireParametresListe(searchParams, { tri: 'nom' });
  const page = preparerListe(enseignants, parametres, {
    valeursTri: {
      nom: (e) => `${e.nom} ${e.prenoms}`,
      statut: (e) => STATUT_BADGE[e.statut].label,
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
        <LienRetour href="/etablissement">Retour à l&apos;établissement</LienRetour>

        <div className="hidden md:block">
          <PageHeader
            title="Liste des enseignants"
            actions={
              canWrite && (
                <>
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/etablissement/enseignants/import">
                      <FileSpreadsheet className="h-4 w-4" aria-hidden />
                      Import Excel
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/etablissement/enseignants/nouveau">
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Nouvel enseignant
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
                href="/etablissement/enseignants/import"
                libelle="Import Excel"
                icone={FileSpreadsheet}
              />
            )}
          </BarreOutilsListe>

          <EnteteListe
            titre="Liste des enseignants"
            compte={`${page.total} enseignant${page.total > 1 ? 's' : ''}`}
          />

          {page.total === 0 ? (
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
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TriColonne cle="nom">Nom &amp; Prénoms</TriColonne>
                      <TriColonne cle="statut">Statut</TriColonne>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {page.lignes.map((enseignant) => (
                    <TableRow key={enseignant.id}>
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
                {page.lignes.map((enseignant) => (
                  <LigneCarteMobile
                    key={enseignant.id}
                    href={`/etablissement/enseignants/${enseignant.id}`}
                    icone={UsersRound}
                    titre={`${enseignant.nom} ${enseignant.prenoms}`}
                    reference={enseignant.matricule}
                    statut={{
                      libelle: STATUT_BADGE[enseignant.statut].label,
                      ton: STATUT_BADGE[enseignant.statut].ton,
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
                libelle="enseignant(s)"
              />
            </>
          )}
        </Card>
      </div>

      {canWrite && (
        <BoutonFlottant
          href="/etablissement/enseignants/nouveau"
          libelle="Nouvel enseignant"
          icone={UserPlus}
        />
      )}
    </AppLayout>
  );
}
