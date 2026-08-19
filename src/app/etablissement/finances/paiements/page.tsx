import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listPaiements, type StatutPaiement } from '@/services/paiement';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
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
  searchParams: { anneeScolaireId?: string; statut?: string };
}) {
  const ctx = await getTenantContext();

  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = searchParams.anneeScolaireId || anneeActive?.id || annees[0]?.id;

  const statut =
    searchParams.statut === 'PAYE' || searchParams.statut === 'ANNULE'
      ? (searchParams.statut as StatutPaiement)
      : undefined;

  const paiements = anneeScolaireId ? await listPaiements(anneeScolaireId, { statut }) : [];
  const totalEncaisse = paiements
    .filter((p) => p.statut !== 'ANNULE')
    .reduce((somme, p) => somme + p.montant, 0);

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Historique des versements</h1>
          <p className="text-body-md text-text-secondary">
            Tous les encaissements de l&apos;année scolaire, du plus récent au plus ancien. Un
            versement annulé reste visible : il n&apos;est jamais supprimé.
          </p>
        </div>

        <Card>
          <div className="border-b border-surface-border p-4">
            <PaiementsFiltres
              annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
              defaultAnneeScolaireId={anneeScolaireId ?? ''}
              defaultStatut={statut ?? ''}
            />
          </div>

          {paiements.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Wallet className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucun versement enregistré.</p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Reçu</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paiements.map((paiement) => (
                  <TableRow key={paiement.id}>
                    <TableCell>
                      {new Date(paiement.datePaiement).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/etablissement/finances/factures/${paiement.factureId}`}
                        className="text-primary hover:underline"
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
                    Total encaissé (hors annulés, FCFA)
                  </TableCell>
                  <TableCell className="text-right font-semibold" data-mono>
                    {fcfa(totalEncaisse)}
                  </TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
