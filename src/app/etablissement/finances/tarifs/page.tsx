import { Coins } from 'lucide-react';
import Link from 'next/link';
import { getTenantContext } from '@/services/tenant';
import { peutEcrire } from '@/services/abonnement';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listTypesFrais } from '@/services/type-frais';
import { listTarifs, totalTarifs } from '@/services/tarif';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { BarreOutilsListe } from '@/components/ui/actions-mobile';
import { FiltresMobile } from '@/components/ui/filtres-mobile';
import {
  PaginationListe,
  RechercheListe,
  TriColonne,
} from '@/components/ui/liste-toolbar';
import { lireParametresListe, preparerListe } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';
import { TarifsFiltres } from './TarifsFiltres';
import { TarifForm } from './TarifForm';

const fcfa = (montant: number) => `${Number(montant).toLocaleString('fr-FR')} FCFA`;

export default async function TarifsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const lireUnique = (cle: string): string | undefined => {
    const brut = searchParams[cle];
    const valeur = Array.isArray(brut) ? brut[0] : brut;
    return valeur && valeur.length > 0 ? valeur : undefined;
  };
  // Vague 1 : tout ce qui ne dépend d'aucune donnée déjà chargée part ensemble.
  // En file indienne, ces quatre requêtes coûtaient quatre allers-retours.
  const [ctx, ecritureOuverte, annees, typesFrais] = await Promise.all([
    getTenantContext(),
    peutEcrire(),
    listAnneesScolaires(),
    listTypesFrais(),
  ]);
  const canWrite = (ctx.role === 'COMPTABLE' || ctx.role === 'SUPER_ADMIN') && ecritureOuverte;

  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = lireUnique('anneeScolaireId') || anneeActive?.id || annees[0]?.id;
  const classeId = lireUnique('classeId');

  // Vague 2 : dépend de l'année retenue ci-dessus, mais les deux vont ensemble.
  const [classes, tarifs] = await Promise.all([
    anneeScolaireId ? listClasses(anneeScolaireId) : [],
    anneeScolaireId ? listTarifs(anneeScolaireId, classeId) : [],
  ]);

  const parametres = lireParametresListe(searchParams, { tri: 'classe' });
  const page = preparerListe(tarifs, parametres, {
    champsRecherche: (t) => [t.classe?.nom, t.typeFrais?.nom],
    valeursTri: {
      classe: (t) => t.classe?.nom,
      type: (t) => t.typeFrais?.nom,
      montant: (t) => Number(t.montant),
      date: (t) => t.createdAt,
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
        <PageHeader
          title="Configuration des tarifs"
          description="Montant de chaque type de frais, classe par classe et année par année. Ce sont ces tarifs qui alimentent automatiquement la facture d'un élève à son inscription."
        />

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <BarreOutilsListe className="md:justify-between">
            <RechercheListe placeholder="Rechercher un tarif…" />
            <FiltresMobile nombreActifs={classeId ? 1 : 0}>
              <TarifsFiltres
                annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
                classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
                defaultAnneeScolaireId={anneeScolaireId ?? ''}
                defaultClasseId={classeId ?? ''}
              />
            </FiltresMobile>
            {canWrite && anneeScolaireId && typesFrais.length > 0 && classes.length > 0 && (
              <TarifForm
                anneeScolaireId={anneeScolaireId}
                classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
                typesFrais={typesFrais.map((t) => ({ id: t.id, nom: t.nom }))}
                defaultClasseId={classeId ?? ''}
              />
            )}
          </BarreOutilsListe>

          <EnteteListe titre="Tarifs" compte={`${page.total} tarif${page.total > 1 ? 's' : ''}`} />

          {tarifs.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Coins className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucun tarif défini.</p>
              <p className="text-body-sm text-text-secondary">
                Sans tarif, la facture générée à l&apos;inscription reste à 0.
              </p>
              {typesFrais.length === 0 && (
                <p className="text-body-sm text-text-secondary">
                  Créez d&apos;abord au moins un{' '}
                  <Link
                    href="/etablissement/finances/types-frais"
                    className="text-primary-container hover:underline"
                  >
                    type de frais
                  </Link>
                  .
                </p>
              )}
              {classes.length === 0 && (
                <p className="text-body-sm text-text-secondary">
                  Aucune classe n&apos;existe sur cette année scolaire.
                </p>
              )}
            </CardContent>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TriColonne cle="classe">Classe</TriColonne>
                      <TriColonne cle="type">Type de frais</TriColonne>
                      <TriColonne cle="montant" numerique>
                        Montant
                      </TriColonne>
                      <TriColonne cle="date">Créé le</TriColonne>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.lignes.map((tarif) => (
                      <TableRow key={tarif.id}>
                        <TableCell className="font-medium">{tarif.classe?.nom ?? '—'}</TableCell>
                        <TableCell>{tarif.typeFrais?.nom ?? '—'}</TableCell>
                        <TableCell className="text-right" data-mono>
                          {fcfa(tarif.montant)}
                        </TableCell>
                        <TableCell className="text-text-secondary">
                          {new Date(tarif.createdAt).toLocaleDateString('fr-FR')}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-semibold" colSpan={2}>
                        {classeId ? 'Total de la classe' : 'Total affiché'}
                      </TableCell>
                      <TableCell className="text-right font-semibold" data-mono>
                        {fcfa(totalTarifs(tarifs))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <CarteListeMobile>
                {page.lignes.map((tarif) => (
                  <LigneCarteMobile
                    key={tarif.id}
                    titre={tarif.classe?.nom ?? '—'}
                    sousTitre={tarif.typeFrais?.nom ?? undefined}
                    valeurSecondaire={fcfa(tarif.montant)}
                  />
                ))}
              </CarteListeMobile>

              <div className="border-t border-surface-border p-4 text-body-sm text-text-secondary md:hidden">
                {classeId ? 'Total de la classe' : 'Total affiché'} —{' '}
                <span className="font-semibold text-text-primary">{fcfa(totalTarifs(tarifs))}</span>
              </div>
            </>
          )}

          <PaginationListe
            page={page.page}
            nombrePages={page.nombrePages}
            debut={page.debut}
            fin={page.fin}
            total={page.total}
            libelle="tarif(s)"
          />
        </Card>

      </div>
    </AppLayout>
  );
}
