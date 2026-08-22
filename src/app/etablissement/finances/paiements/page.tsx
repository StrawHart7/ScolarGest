import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listPaiements, type StatutPaiement } from '@/services/paiement';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
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
import { PaiementsFiltres } from './PaiementsFiltres';

const fcfa = (montant: number) => Number(montant).toLocaleString('fr-FR');

const MODE_LABEL: Record<string, string> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  AUTRE: 'Autre',
};

export default async function HistoriqueVersementsPage({
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

  const statutDemande = lireUnique('statut');
  const statut =
    statutDemande === 'PAYE' || statutDemande === 'ANNULE'
      ? (statutDemande as StatutPaiement)
      : undefined;

  const paiements = anneeScolaireId ? await listPaiements(anneeScolaireId, { statut }) : [];
  // Total sur la sélection entière, pas sur la page affichée.
  const totalEncaisse = paiements
    .filter((p) => p.statut !== 'ANNULE')
    .reduce((somme, p) => somme + p.montant, 0);

  const parametres = lireParametresListe(searchParams, { tri: 'date', sens: 'desc' });
  const page = preparerListe(paiements, parametres, {
    champsRecherche: (p) => [p.eleveNom, p.elevePrenoms, p.eleveMatricule, p.reference, p.recuReference],
    valeursTri: {
      date: (p) => p.datePaiement,
      eleve: (p) => `${p.eleveNom} ${p.elevePrenoms}`,
      montant: (p) => p.montant,
      mode: (p) => p.modePaiement,
      statut: (p) => p.statut,
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
        <div className="hidden md:block">
          <PageHeader
            title="Historique des versements"
            description="Tous les encaissements de l'année scolaire, du plus récent au plus ancien. Un versement annulé reste visible : il n'est jamais supprimé."
          />
        </div>

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <BarreOutilsListe className="md:justify-between">
            <RechercheListe placeholder="Élève, matricule ou référence…" />
            <FiltresMobile nombreActifs={statut ? 1 : 0}>
              <PaiementsFiltres
                annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
                defaultAnneeScolaireId={anneeScolaireId ?? ''}
                defaultStatut={statut ?? ''}
              />
            </FiltresMobile>
          </BarreOutilsListe>

          <EnteteListe
            titre="Versements"
            compte={`${page.total} versement${page.total > 1 ? 's' : ''}`}
          />

          {page.total === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Wallet className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucun versement enregistré.</p>
            </CardContent>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TriColonne cle="date">Date</TriColonne>
                      <TriColonne cle="eleve">Élève</TriColonne>
                      <TriColonne cle="montant" numerique>
                        Montant
                      </TriColonne>
                      <TriColonne cle="mode">Mode</TriColonne>
                      <TableHead>Référence</TableHead>
                      <TableHead>Reçu</TableHead>
                      <TriColonne cle="statut">Statut</TriColonne>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.lignes.map((paiement) => (
                      <TableRow key={paiement.id}>
                        <TableCell>
                          {new Date(paiement.datePaiement).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={`/etablissement/finances/factures/${paiement.factureId}`}
                            className="text-text-primary transition-colors hover:text-primary-container hover:underline"
                          >
                            {paiement.eleveNom} {paiement.elevePrenoms}
                          </Link>
                          <span className="ml-2 text-body-sm text-text-secondary" data-mono>
                            {paiement.eleveMatricule}
                          </span>
                        </TableCell>
                        <TableCell
                          className={`text-right ${paiement.statut === 'ANNULE' ? 'text-text-secondary line-through' : ''}`}
                          data-mono
                        >
                          {fcfa(paiement.montant)}
                        </TableCell>
                        <TableCell>{MODE_LABEL[paiement.modePaiement] ?? paiement.modePaiement}</TableCell>
                        <TableCell data-mono>{paiement.reference ?? '—'}</TableCell>
                        <TableCell data-mono>{paiement.recuReference ?? '—'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={paiement.statut === 'ANNULE' ? 'neutral' : 'success'}
                            shape="pill"
                          >
                            {paiement.statut === 'ANNULE' ? 'Annulé' : 'Encaissé'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-semibold" colSpan={2}>
                        Total encaissé sur la sélection (hors annulés, FCFA)
                      </TableCell>
                      <TableCell className="text-right font-semibold" data-mono>
                        {fcfa(totalEncaisse)}
                      </TableCell>
                      <TableCell colSpan={4} />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <CarteListeMobile>
                {page.lignes.map((paiement) => (
                  <LigneCarteMobile
                    key={paiement.id}
                    href={`/etablissement/finances/factures/${paiement.factureId}`}
                    titre={`${paiement.eleveNom} ${paiement.elevePrenoms}`}
                    reference={paiement.eleveMatricule}
                    sousTitre={`${new Date(paiement.datePaiement).toLocaleDateString('fr-FR')} · ${MODE_LABEL[paiement.modePaiement] ?? paiement.modePaiement}`}
                    statut={{
                      libelle: paiement.statut === 'ANNULE' ? 'Annulé' : 'Encaissé',
                      ton: paiement.statut === 'ANNULE' ? 'neutre' : 'succes',
                    }}
                    valeurSecondaire={
                      <span className={paiement.statut === 'ANNULE' ? 'line-through' : undefined}>
                        {fcfa(paiement.montant)}
                      </span>
                    }
                  />
                ))}
              </CarteListeMobile>

              <div className="border-t border-surface-border p-4 text-body-sm text-text-secondary md:hidden">
                Total encaissé (hors annulés) —{' '}
                <span className="font-semibold text-text-primary">{fcfa(totalEncaisse)} F</span>
              </div>
            </>
          )}

          <PaginationListe
            page={page.page}
            nombrePages={page.nombrePages}
            debut={page.debut}
            fin={page.fin}
            total={page.total}
            libelle="versement(s)"
          />
        </Card>
      </div>
    </AppLayout>
  );
}
