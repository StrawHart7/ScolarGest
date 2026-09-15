import { Coins } from 'lucide-react';
import Link from 'next/link';
import { getTenantContext } from '@/services/tenant';
import { peutEcrire } from '@/services/abonnement';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listTypesFrais } from '@/services/type-frais';
import { listTarifs, totalTarifs } from '@/services/tarif';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarreSection } from '@/components/layout/BarreSection';
import { PageHeader } from '@/components/layout/PageHeader';
import { SousTitreMobile } from '@/components/layout/SousTitreMobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { BarreListe } from '@/components/ui/barre-liste';
import { PaginationListe, TriColonne } from '@/components/ui/liste-toolbar';
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
  const canWrite =
    (ctx.role === 'DIRECTEUR' ||
      ctx.role === 'SECRETAIRE' ||
      ctx.role === 'COMPTABLE' ||
      ctx.role === 'SUPER_ADMIN') &&
    ecritureOuverte;

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
      <div className="space-y-4 md:space-y-6">
        <BarreSection chemin="/etablissement/finances" role={ctx.role} actif="/etablissement/finances/tarifs" />

        {/* Sur mobile, le titre descend dans EnteteListe : le PageHeader ferait
            doublon avec la ligne de densité. */}
        <div className="hidden md:block">
          <PageHeader
            title="Tarifs"
            description="Combien coûte chaque frais, classe par classe. C'est d'ici que la facture d'un élève est calculée quand vous l'inscrivez."
          />
        </div>

        <SousTitreMobile>Combien coûte chaque frais, classe par classe. C’est d’ici que la facture d’un élève est calculée quand vous l’inscrivez.</SousTitreMobile>

        <BarreListe
          placeholderRecherche="Rechercher un tarif…"
          filtresLibres={
            <TarifsFiltres
              annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
              classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
              defaultAnneeScolaireId={anneeScolaireId ?? ''}
              defaultClasseId={classeId ?? ''}
            />
          }
          nombreFiltresLibresActifs={classeId ? 1 : 0}
          tri={[
            { cle: 'classe', libelle: 'Classe' },
            { cle: 'type', libelle: 'Type de frais' },
            { cle: 'montant', libelle: 'Montant' },
            { cle: 'date', libelle: 'Date de création' },
          ]}
          actions={
            <>
              {/* « Types de frais » n'est plus une entrée de menu : un tarif,
                  c'est « ce frais coûte X en 6ème », et le type de frais est un
                  attribut de cette phrase, pas une entité de la vie du
                  Directeur. L'écran existe toujours — il a simplement cessé
                  d'occuper le même niveau visuel que le tarif, et il se règle
                  depuis l'écran qui l'emploie. */}
              {canWrite && (
                <Button asChild variant="secondary" size="sm">
                  <Link href="/etablissement/finances/types-frais">Types de frais</Link>
                </Button>
              )}
              {canWrite && anneeScolaireId && typesFrais.length > 0 && classes.length > 0 ? (
                <TarifForm
                  anneeScolaireId={anneeScolaireId}
                  classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
                  typesFrais={typesFrais.map((t) => ({ id: t.id, nom: t.nom }))}
                  defaultClasseId={classeId ?? ''}
                />
              ) : null}
            </>
          }
        />

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">

          <EnteteListe titre="Tarifs" compte={`${page.total} tarif${page.total > 1 ? 's' : ''}`} />

          {tarifs.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Coins className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucun tarif fixé</p>
              <p className="text-body-sm text-text-secondary">
                Sans tarif, la facture d&apos;un élève est créée à 0 franc quand vous l&apos;inscrivez.
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
