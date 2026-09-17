import { Coins } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { peutEcrire } from '@/services/abonnement';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listTypesFrais } from '@/services/type-frais';
import { listTarifs } from '@/services/tarif';
import { tarifsAProposer } from '@/services/reconduction';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarreSection } from '@/components/layout/BarreSection';
import { PageHeader } from '@/components/layout/PageHeader';
import { SousTitreMobile } from '@/components/layout/SousTitreMobile';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { BarreListe } from '@/components/ui/barre-liste';
import { PaginationListe, TriColonne } from '@/components/ui/liste-toolbar';
import { lireParametresListe, preparerListe } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';
import { TarifsFiltres } from './TarifsFiltres';
import { TarifForm } from './TarifForm';
import { PropositionTarifs } from './PropositionTarifs';

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

  // Vague 2 : dépend de l'année retenue ci-dessus, mais les trois vont ensemble.
  // `tarifsAProposer` rend une liste vide dès que l'année porte déjà un tarif :
  // le coût est une requête de comptage, et l'écran n'a rien à décider.
  const [classes, tarifs, reprise] = await Promise.all([
    anneeScolaireId ? listClasses(anneeScolaireId) : [],
    anneeScolaireId ? listTarifs(anneeScolaireId, classeId) : [],
    anneeScolaireId
      ? tarifsAProposer(anneeScolaireId)
      : { source: null, propositions: [], conflits: [] },
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

        {/* Avant la liste, et non après : une année sans tarif n'a rien à
            montrer dessous, et c'est précisément le moment où l'école a besoin
            qu'on lui tende les montants de l'an dernier plutôt qu'un tableau
            vide. */}
        {canWrite && reprise.source && reprise.propositions.length > 0 && anneeScolaireId && (
          <PropositionTarifs
            anneeScolaireId={anneeScolaireId}
            sourceLibelle={reprise.source.libelle}
            propositions={reprise.propositions}
            conflits={reprise.conflits}
          />
        )}

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
              {/*
                Le bouton « Types de frais » est parti le 2026-09-15, et avec
                lui le détour. Un tarif, c'est « ce frais coûte X en 6ème » : le
                frais se nomme **dans** le formulaire du tarif, et l'écran
                séparé n'a plus de raison d'être sur ce chemin. Il survit à son
                URL pour renommer ou retirer un frais existant, ce qui est rare.

                Conséquence : plus besoin d'un type de frais préexistant pour
                voir le bouton. C'était exactement le mur du testeur d'EPL — un
                écran de tarifs sans aucun moyen d'en créer un.
              */}
              {canWrite && anneeScolaireId && classes.length > 0 ? (
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
              {/*
                Plus de « créez d'abord un type de frais » : il n'y a plus de
                préalable. Le premier tarif nomme son frais au passage.
              */}
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
                    {/*
                      La ligne « Total » est partie le 2026-09-15, et c'était un
                      chiffre faux. Elle additionnait des montants qui ne
                      s'additionnent pas : des tarifs de classes différentes, ou
                      des frais qui ne s'appliquent pas au même élève. Personne
                      ne doit jamais ce total-là. Ce qu'un directeur veut
                      vraiment savoir — ce qu'un élève de 6ème A doit sur
                      l'année — se lit sur sa facture, où le calcul est réel.
                    */}
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
