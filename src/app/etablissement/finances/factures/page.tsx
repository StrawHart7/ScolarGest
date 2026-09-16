import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listSuiviPaiements, totauxSuivi, type StatutFacture } from '@/services/facture';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarreSection } from '@/components/layout/BarreSection';
import { PageHeader } from '@/components/layout/PageHeader';
import { SousTitreMobile } from '@/components/layout/SousTitreMobile';
import { VuesPaiements } from '../VuesPaiements';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import {
  CarteListeMobile,
  EnteteListe,
  LigneCarteMobile,
  type TonStatut,
} from '@/components/ui/carte-liste-mobile';
import { BarreListe } from '@/components/ui/barre-liste';
import { PaginationListe, TriColonne } from '@/components/ui/liste-toolbar';
import { lireParametresListe, preparerListe, rechercher } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';
import { SuiviFiltres } from './SuiviFiltres';
import { etatDomaine } from '@/services/configuration';
import { PageVerrouillee } from '@/components/configuration/PageVerrouillee';

const fcfa = (montant: number) => Number(montant).toLocaleString('fr-FR');

const STATUT_LABEL: Record<StatutFacture, string> = {
  PAYE: 'Payé',
  PARTIEL: 'Partiel',
  IMPAYE: 'Impayé',
  ANNULE: 'Annulé',
};

const STATUT_BADGE: Record<StatutFacture, 'success' | 'warning' | 'error' | 'neutral'> = {
  PAYE: 'success',
  PARTIEL: 'warning',
  IMPAYE: 'error',
  ANNULE: 'neutral',
};

const STATUT_TON: Record<StatutFacture, TonStatut> = {
  PAYE: 'succes',
  PARTIEL: 'alerte',
  IMPAYE: 'erreur',
  ANNULE: 'neutre',
};

const STATUTS: StatutFacture[] = ['PAYE', 'PARTIEL', 'IMPAYE', 'ANNULE'];

/**
 * Un chiffre de la bande de totaux : intitulé en cartouche, montant à chasse
 * tabulaire, unité détachée.
 *
 * L'unité est en retrait parce qu'elle se répète trois fois : elle doit être
 * lisible sans peser autant que le montant. C'est le traitement déjà retenu
 * pour le bandeau de la console plateforme.
 */
/**
 * Un chiffre de la bande de totaux — et deux densités, pas deux composants.
 *
 * Trois chiffres à 28px empilés prenaient 180px du premier écran du téléphone,
 * avant même la première facture, et leurs intitulés en capitales espacées
 * criaient trois fois. Sous `sm`, « Total dû » et « Encaissé » deviennent donc
 * deux lignes de relevé — intitulé à gauche, montant à droite — et seul « Reste à
 * recouvrer » garde sa taille : c'est le seul des trois sur lequel on agit, les
 * deux autres le situent.
 *
 * L'ordre ne change pas d'un écran à l'autre, seule la densité : quelqu'un qui
 * passe du bureau au téléphone retrouve ses chiffres au même rang.
 */
function ChiffreTotal({
  libelle,
  valeur,
  accent,
  vedette,
}: {
  libelle: string;
  valeur: number;
  accent?: 'regle' | 'reste';
  /** Garde la grande taille sous `sm`, sur sa propre ligne. */
  vedette?: boolean;
}) {
  const couleur =
    accent === 'regle'
      ? 'text-tertiary'
      : accent === 'reste' && valeur > 0
        ? 'text-error'
        : 'text-text-primary';

  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 sm:block',
        vedette && 'max-sm:block max-sm:border-t max-sm:border-surface-border max-sm:pt-3',
      )}
    >
      <p className="text-touch-meta text-text-secondary sm:text-body-sm">{libelle}</p>
      <p className="flex items-baseline gap-1.5 sm:mt-1">
        <span
          className={cn(
            'text-body-md font-semibold sm:text-console-figure-sm sm:font-normal',
            vedette && 'max-sm:mt-1 max-sm:text-console-figure-sm max-sm:font-normal',
            couleur,
          )}
          data-mono
        >
          {fcfa(valeur)}
        </span>
        <span className="text-body-sm text-text-secondary">FCFA</span>
      </p>
    </div>
  );
}

export default async function SuiviPaiementsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await getTenantContext();

  // Le verrou avant les lectures : afficher une liste vide sans dire
  // pourquoi est le defaut qu'on repare, et les requetes qui la
  // remplissent n'ont rien a ramener tant que la section n'est pas prete.
  const verrou = await etatDomaine('FINANCES');
  if (!verrou.ouvert) {
    return (
      <PageVerrouillee
        domaine="FINANCES"
        titre="Suivi des paiements"
        retour={{ href: '/dashboard', libelle: 'Retour au tableau de bord' }}
        manques={verrou.manques}
      />
    );
  }
  const lireUnique = (cle: string): string | undefined => {
    const brut = searchParams[cle];
    const valeur = Array.isArray(brut) ? brut[0] : brut;
    return valeur && valeur.length > 0 ? valeur : undefined;
  };

  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = lireUnique('anneeScolaireId') || anneeActive?.id || annees[0]?.id;
  const classes = anneeScolaireId ? await listClasses(anneeScolaireId) : [];

  const statutDemande = lireUnique('statut');
  const statut = STATUTS.includes(statutDemande as StatutFacture)
    ? (statutDemande as StatutFacture)
    : undefined;

  const lignes = anneeScolaireId
    ? await listSuiviPaiements(anneeScolaireId, { classeId: lireUnique('classeId'), statut })
    : [];

  const parametres = lireParametresListe(searchParams, { tri: 'solde', sens: 'desc' });

  // La recherche est appliquée **ici**, avant les totaux, et non déléguée à
  // `preparerListe` comme auparavant.
  //
  // Les totaux portaient sur `lignes`, c'est-à-dire sur la sélection des
  // filtres **avant** la recherche : taper « KODJO » ramenait trois lignes à
  // l'écran sous une bande annonçant « 48 factures » et les montants des
  // quarante-huit. Un total qui ne correspond pas aux lignes affichées ment,
  // et sur un écran de recouvrement il ment sur de l'argent.
  //
  // Le même `rechercher` sert aux deux, donc les deux ne peuvent pas diverger ;
  // `preparerListe` ne reçoit plus `champsRecherche` pour ne pas filtrer deux
  // fois.
  const lignesRetenues = rechercher(lignes, parametres.recherche, (l) => [
    l.nom,
    l.prenoms,
    l.matricule,
    l.classeNom,
  ]);
  const totaux = totauxSuivi(lignesRetenues);

  // « Aucune facture » et « aucune facture qui corresponde » ne se reparent
  // pas du meme geste : le premier attend une inscription, le second attend
  // qu'on retire un filtre.
  const filtreActif = Boolean(parametres.recherche || lireUnique('classeId') || statut);

  const page = preparerListe(lignesRetenues, parametres, {
    valeursTri: {
      eleve: (l) => `${l.nom} ${l.prenoms}`,
      classe: (l) => l.classeNom,
      total: (l) => l.montantTotal,
      paye: (l) => l.totalPaye,
      solde: (l) => l.solde,
      statut: (l) => l.statut,
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
        {/* Plus de « Retour aux finances » : c'est cet écran-là, désormais. Il
            porte à la place les autres écrans du domaine, à un niveau visuel
            inférieur — les tarifs et les types de frais se règlent une fois
            l'an, le suivi se regarde toutes les semaines. */}
        <BarreSection
          chemin="/etablissement/finances"
          role={ctx.role}
          actif="/etablissement/finances/factures"
        />

        <div className="hidden md:block">
          <PageHeader
            title="Suivi des paiements"
            description="Qui a payé, qui doit encore. Une ligne par élève : total dû, déjà encaissé, reste à recouvrer."
          />
        </div>

        <SousTitreMobile>Qui a payé, qui doit encore. Une ligne par élève : total dû, déjà encaissé, reste à recouvrer.</SousTitreMobile>

        <VuesPaiements actif="/etablissement/finances/factures" />

        <BarreListe
          placeholderRecherche="Élève, matricule ou classe…"
          filtresLibres={
            <SuiviFiltres
              annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
              classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
              defaultAnneeScolaireId={anneeScolaireId ?? ''}
              defaultClasseId={lireUnique('classeId') ?? ''}
              defaultStatut={statut ?? ''}
            />
          }
          nombreFiltresLibresActifs={(lireUnique('classeId') ? 1 : 0) + (statut ? 1 : 0)}
          tri={[
            { cle: 'eleve', libelle: 'Nom de l’élève' },
            { cle: 'classe', libelle: 'Classe' },
            { cle: 'total', libelle: 'Total dû' },
          ]}
        />

        {/* La bande vient **après** les filtres et **avant** la liste : c'est
            l'ordre de lecture réel — je restreins, je vois combien ça pèse,
            je travaille les lignes. Et sa position juste sous la barre lui
            attache visuellement le mot « sélection », qui n'est pas un détail :
            ces trois montants ne sont pas ceux de l'école, ce sont ceux de ce
            qui est filtré à l'écran.

            Ils vivaient jusqu'ici en dernière ligne du tableau, sous les dix
            factures de la page courante — donc après la pagination, à l'endroit
            exact où l'on ne regarde plus. Or c'est le premier chiffre que
            cherche un comptable en ouvrant cet écran. */}
        {page.total > 0 && (
          <section
            className="rounded-xl border border-surface-border bg-surface-container-lowest p-4 shadow-subtle md:p-5"
            aria-label="Totaux de la sélection"
          >
            <p className="text-body-sm text-text-secondary">
              Totaux de la sélection —{' '}
              <span className="font-medium text-text-primary">
                {page.total} facture{page.total > 1 ? 's' : ''}
              </span>
              {parametres.recherche ? ' correspondant à la recherche' : ''}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-3 sm:gap-y-4">
              <ChiffreTotal libelle="Total dû" valeur={totaux.montantTotal} />
              <ChiffreTotal libelle="Encaissé" valeur={totaux.totalPaye} accent="regle" />
              <ChiffreTotal
                libelle="Reste à recouvrer"
                valeur={totaux.solde}
                accent="reste"
                vedette
              />
            </div>
          </section>
        )}

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <EnteteListe
            titre="Suivi des paiements"
            compte={`${page.total} facture${page.total > 1 ? 's' : ''}`}
          />

          {page.total === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Receipt className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">
                {filtreActif ? 'Aucune facture ne correspond' : 'Aucune facture pour le moment'}
              </p>
              <p className="text-body-sm text-text-secondary">
                {filtreActif
                  ? 'Modifiez la recherche ou retirez les filtres pour voir toute la liste.'
                  : 'La facture d’un élève est créée toute seule quand vous l’inscrivez en classe.'}
              </p>
            </CardContent>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TriColonne cle="eleve">Nom de l&apos;élève</TriColonne>
                      <TriColonne cle="classe">Classe</TriColonne>
                      {/* Pas de « (FCFA) » dans ces trois intitulés.
                          Mesuré : le suffixe coûte 135px et fait passer le
                          tableau de 876 à 1011px, pour 972px disponibles sur un
                          écran de 1280 — les deux dernières colonnes sortaient
                          du cadre. Un écran de 1920 à 150 % d'agrandissement,
                          ce qui est le réglage par défaut de beaucoup de
                          portables, vaut précisément 1280.

                          L'unité n'est pas perdue : la bande de totaux la
                          répète trois fois, en gros, juste au-dessus. La
                          déclarer une quatrième fois par colonne coûtait une
                          colonne entière. */}
                      <TriColonne cle="total" numerique>
                        Total dû
                      </TriColonne>
                      <TriColonne cle="paye" numerique>
                        Payé
                      </TriColonne>
                      <TriColonne cle="solde" numerique>
                        Reste à recouvrer
                      </TriColonne>
                      <TriColonne cle="statut">Statut</TriColonne>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.lignes.map((ligne) => (
                      <TableRow key={ligne.factureId} className="group relative">
                        <TableCell className="font-medium">
                          <Link
                            href={`/etablissement/finances/factures/${ligne.factureId}`}
                            className="text-text-primary transition-colors after:absolute after:inset-0 after:z-10 after:content-[''] group-hover:text-primary-container group-hover:underline"
                          >
                            {ligne.nom} {ligne.prenoms}
                          </Link>
                        </TableCell>
                        <TableCell>{ligne.classeNom ?? '—'}</TableCell>
                        <TableCell className="text-right" data-mono>
                          {fcfa(ligne.montantTotal)}
                        </TableCell>
                        <TableCell className="text-right" data-mono>
                          {fcfa(ligne.totalPaye)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${ligne.solde > 0 ? 'font-semibold text-error' : ''}`}
                          data-mono
                        >
                          {fcfa(ligne.solde)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUT_BADGE[ligne.statut]} shape="pill">
                            {STATUT_LABEL[ligne.statut]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <CarteListeMobile>
                {page.lignes.map((ligne) => (
                  <LigneCarteMobile
                    key={ligne.factureId}
                    href={`/etablissement/finances/factures/${ligne.factureId}`}
                    titre={`${ligne.nom} ${ligne.prenoms}`}
                    reference={ligne.matricule}
                    sousTitre={ligne.classeNom ?? undefined}
                    statut={{
                      libelle: STATUT_LABEL[ligne.statut],
                      ton: STATUT_TON[ligne.statut],
                    }}
                    valeurSecondaire={
                      <span className={ligne.solde > 0 ? 'text-error' : undefined}>
                        {fcfa(ligne.solde)}
                      </span>
                    }
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
            libelle="facture(s)"
          />
        </Card>
      </div>
    </AppLayout>
  );
}
