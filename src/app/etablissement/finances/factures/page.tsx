import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listSuiviPaiements, totauxSuivi, type StatutFacture } from '@/services/facture';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { PageHeader } from '@/components/layout/PageHeader';
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
function ChiffreTotal({
  libelle,
  valeur,
  accent,
}: {
  libelle: string;
  valeur: number;
  accent?: 'regle' | 'reste';
}) {
  return (
    <div>
      <p className="text-console-eyebrow uppercase text-text-secondary">{libelle}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span
          className={
            accent === 'regle'
              ? 'text-console-figure-sm text-tertiary'
              : accent === 'reste' && valeur > 0
                ? 'text-console-figure-sm text-error'
                : 'text-console-figure-sm text-text-primary'
          }
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
        <LienRetour href="/etablissement/finances">Retour aux finances</LienRetour>

        <div className="hidden md:block">
          <PageHeader
            title="Suivi des paiements"
            description="Une ligne par facture élève : total dû, total encaissé et reste à recouvrer. Les statuts sont informatifs et ne bloquent rien dans le système."
          />
        </div>

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
            <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
              <ChiffreTotal libelle="Total dû" valeur={totaux.montantTotal} />
              <ChiffreTotal libelle="Encaissé" valeur={totaux.totalPaye} accent="regle" />
              <ChiffreTotal libelle="Reste à recouvrer" valeur={totaux.solde} accent="reste" />
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
              <p className="text-body-md text-text-primary">Aucune facture pour cette sélection.</p>
              <p className="text-body-sm text-text-secondary">
                Les factures sont créées automatiquement à l&apos;inscription d&apos;un élève.
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
                      {/* L'unité était déclarée une seule fois, dans la
                          parenthèse de la ligne de totaux — qui vient de
                          disparaître. Sans elle, trois colonnes de nombres nus
                          sur un écran de recouvrement. */}
                      <TriColonne cle="total" numerique>
                        Total dû (FCFA)
                      </TriColonne>
                      <TriColonne cle="paye" numerique>
                        Payé (FCFA)
                      </TriColonne>
                      <TriColonne cle="solde" numerique>
                        Reste à recouvrer (FCFA)
                      </TriColonne>
                      <TriColonne cle="statut">Statut</TriColonne>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.lignes.map((ligne) => (
                      <TableRow key={ligne.factureId}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/etablissement/finances/factures/${ligne.factureId}`}
                            className="text-text-primary transition-colors hover:text-primary-container hover:underline"
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
