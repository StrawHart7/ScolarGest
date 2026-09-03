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
import { lireParametresListe, preparerListe } from '@/lib/liste';
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
  // Les totaux portent sur l'intégralité de la sélection, pas sur la page
  // affichée : un total qui changerait en tournant les pages serait trompeur.
  const totaux = totauxSuivi(lignes);

  const parametres = lireParametresListe(searchParams, { tri: 'solde', sens: 'desc' });
  const page = preparerListe(lignes, parametres, {
    champsRecherche: (l) => [l.nom, l.prenoms, l.matricule, l.classeNom],
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
                      <TriColonne cle="total" numerique>
                        Total dû
                      </TriColonne>
                      <TriColonne cle="paye" numerique>
                        Total payé
                      </TriColonne>
                      <TriColonne cle="solde" numerique>
                        Reste à recouvrer
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
                    <TableRow>
                      <TableCell className="font-semibold" colSpan={2}>
                        Totaux de la sélection ({lignes.length} facture
                        {lignes.length > 1 ? 's' : ''}, FCFA)
                      </TableCell>
                      <TableCell className="text-right font-semibold" data-mono>
                        {fcfa(totaux.montantTotal)}
                      </TableCell>
                      <TableCell className="text-right font-semibold" data-mono>
                        {fcfa(totaux.totalPaye)}
                      </TableCell>
                      <TableCell className="text-right font-semibold" data-mono>
                        {fcfa(totaux.solde)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
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

              <div className="border-t border-surface-border p-4 text-body-sm text-text-secondary md:hidden">
                Totaux de la sélection ({lignes.length} facture{lignes.length > 1 ? 's' : ''}, FCFA) —{' '}
                <span className="font-semibold text-text-primary">
                  {fcfa(totaux.montantTotal)} dû, {fcfa(totaux.totalPaye)} payé, {fcfa(totaux.solde)}{' '}
                  restant
                </span>
              </div>
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
