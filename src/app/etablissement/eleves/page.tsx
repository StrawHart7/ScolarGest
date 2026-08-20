import Link from 'next/link';
import { ArrowRightLeft, FileSpreadsheet, UserPlus, Users2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listEleves, type StatutEleve } from '@/services/eleve';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  FiltreListe,
  PaginationListe,
  RechercheListe,
  TriColonne,
} from '@/components/ui/liste-toolbar';
import { lireParametresListe, preparerListe } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';

const STATUT_BADGE: Record<StatutEleve, { label: string; variant: 'success' | 'neutral' | 'warning' }> = {
  ACTIF: { label: 'Actif', variant: 'success' },
  INACTIF: { label: 'Inactif', variant: 'neutral' },
  ARCHIVE: { label: 'Archivé', variant: 'neutral' },
  TRANSFERE: { label: 'Transféré', variant: 'warning' },
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
  const ctx = await getTenantContext();
  const lireUnique = (cle: string): string | undefined => {
    const brut = searchParams[cle];
    const valeur = Array.isArray(brut) ? brut[0] : brut;
    return valeur && valeur.length > 0 ? valeur : undefined;
  };

  // La recherche reste côté base (l'établissement peut compter des milliers
  // d'élèves) ; tri et pagination s'appliquent ensuite au résultat filtré.
  const eleves = await listEleves({
    search: lireUnique('q'),
    statut: lireUnique('statut') as StatutEleve | undefined,
  });
  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';

  const parametres = lireParametresListe(searchParams, { tri: 'nom' });
  const page = preparerListe(eleves, parametres, {
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
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-display-sm text-text-primary">Liste des élèves</h1>
          {canWrite && (
            <div className="flex items-center gap-2">
              {/* Le passage de cohorte se pilote par classe depuis la fiche de
                  la classe ; l'entrée globale reste le point d'accès. */}
              <Button asChild variant="secondary" size="sm">
                <Link href="/etablissement/eleves/passage">
                  <ArrowRightLeft className="h-4 w-4" aria-hidden />
                  Passage de cohorte
                </Link>
              </Button>
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
            </div>
          )}
        </div>

        <Card>
          <div className="flex flex-wrap items-center gap-4 border-b border-surface-border p-4">
            <RechercheListe placeholder="Nom, prénoms ou matricule…" />
            <FiltreListe
              parametre="statut"
              libelle="Statut"
              options={OPTIONS_STATUT}
              libelleTout="Tous les statuts"
            />
          </div>

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
    </AppLayout>
  );
}
