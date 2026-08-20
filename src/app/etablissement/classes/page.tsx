import Link from 'next/link';
import { School } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listCyclesActifs, listNiveauxParCycle, listSeriesParCycle } from '@/services/structure';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  PaginationListe,
  RechercheListe,
  TriColonne,
} from '@/components/ui/liste-toolbar';
import { lireParametresListe, preparerListe } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';
import { ClasseForm, type CycleOption } from './ClasseForm';

export default async function ClassesPage({
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

  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = lireUnique('anneeScolaireId') ?? anneeActive?.id;
  const classes = anneeScolaireId ? await listClasses(anneeScolaireId) : [];
  const peutCreer = ctx.role === 'DIRECTEUR' && Boolean(anneeScolaireId);

  // Cycles, niveaux et séries ne sont chargés que si le formulaire est
  // affichable : trois requêtes inutiles sinon, sur chaque consultation.
  let cycles: CycleOption[] = [];
  if (peutCreer) {
    const actifs = await listCyclesActifs();
    cycles = await Promise.all(
      actifs.map(async (actif) => ({
        id: actif.cycle.id,
        nom: actif.cycle.nom,
        estLycee: actif.cycle.nom === 'LYCEE',
        niveaux: (await listNiveauxParCycle(actif.cycle.id)).map((n) => ({ id: n.id, nom: n.nom })),
        series: (await listSeriesParCycle(actif.cycle.id)).map((s) => ({ id: s.id, nom: s.nom })),
      })),
    );
  }

  const parametres = lireParametresListe(searchParams, { tri: 'nom' });
  const page = preparerListe(classes, parametres, {
    champsRecherche: (c) => [c.nom, c.niveau.nom, c.serie?.nom],
    valeursTri: {
      nom: (c) => c.nom,
      niveau: (c) => c.niveau.nom,
      serie: (c) => c.serie?.nom,
      capacite: (c) => c.capacite,
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
          <h1 className="text-display-sm text-text-primary">Classes</h1>
          <p className="text-body-md text-text-secondary">
            {anneeActive ? `Année active : ${anneeActive.libelle}` : 'Aucune année active'}
          </p>
        </div>

        {!anneeScolaireId ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm text-text-secondary">
                Créez et activez une année scolaire avant de créer des classes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="flex flex-wrap items-center gap-4 border-b border-surface-border p-4">
              <RechercheListe placeholder="Nom, niveau ou série…" />
              {peutCreer && cycles.length > 0 && (
                <div className="ml-auto">
                  <ClasseForm anneeScolaireId={anneeScolaireId} cycles={cycles} />
                </div>
              )}
            </div>

            {page.total === 0 ? (
              <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
                <School className="h-10 w-10 text-text-secondary/50" aria-hidden />
                <p className="text-body-md text-text-primary">Aucune classe pour cette année.</p>
              </CardContent>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TriColonne cle="nom">Nom</TriColonne>
                      <TriColonne cle="niveau">Niveau</TriColonne>
                      <TriColonne cle="serie">Série</TriColonne>
                      <TriColonne cle="capacite" numerique>
                        Capacité
                      </TriColonne>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.lignes.map((classe) => (
                      <TableRow key={classe.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/etablissement/classes/${classe.id}`}
                            className="text-text-primary transition-colors hover:text-primary-container hover:underline"
                          >
                            {classe.nom}
                          </Link>
                        </TableCell>
                        <TableCell className="text-text-secondary">{classe.niveau.nom}</TableCell>
                        <TableCell className="text-text-secondary">
                          {classe.serie?.nom ?? '—'}
                        </TableCell>
                        <TableCell className="text-right text-text-secondary" data-mono>
                          {classe.capacite ?? '—'}
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
                  libelle="classe(s)"
                />
              </>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
