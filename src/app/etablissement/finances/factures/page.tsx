import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listSuiviPaiements, totauxSuivi, type StatutFacture } from '@/services/facture';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
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

const STATUTS: StatutFacture[] = ['PAYE', 'PARTIEL', 'IMPAYE', 'ANNULE'];

export default async function SuiviPaiementsPage({
  searchParams,
}: {
  searchParams: { anneeScolaireId?: string; classeId?: string; statut?: string };
}) {
  const ctx = await getTenantContext();

  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = searchParams.anneeScolaireId || anneeActive?.id || annees[0]?.id;
  const classes = anneeScolaireId ? await listClasses(anneeScolaireId) : [];

  const statut = STATUTS.includes(searchParams.statut as StatutFacture)
    ? (searchParams.statut as StatutFacture)
    : undefined;

  const lignes = anneeScolaireId
    ? await listSuiviPaiements(anneeScolaireId, { classeId: searchParams.classeId, statut })
    : [];
  const totaux = totauxSuivi(lignes);

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Suivi des paiements</h1>
          <p className="text-body-md text-text-secondary">
            Une ligne par facture élève : total dû, total encaissé et reste à recouvrer. Les statuts
            sont informatifs et ne bloquent rien dans le système.
          </p>
        </div>

        <Card>
          <div className="border-b border-surface-border p-4">
            <SuiviFiltres
              annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
              classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
              defaultAnneeScolaireId={anneeScolaireId ?? ''}
              defaultClasseId={searchParams.classeId ?? ''}
              defaultStatut={statut ?? ''}
            />
          </div>

          {lignes.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Receipt className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucune facture pour cette sélection.</p>
              <p className="text-body-sm text-text-secondary">
                Les factures sont créées automatiquement à l&apos;inscription d&apos;un élève.
              </p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Nom de l&apos;élève</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead className="text-right">Total dû</TableHead>
                  <TableHead className="text-right">Total payé</TableHead>
                  <TableHead className="text-right">Reste à recouvrer</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((ligne) => (
                  <TableRow key={ligne.factureId}>
                    <TableCell data-mono>{ligne.matricule}</TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/etablissement/finances/factures/${ligne.factureId}`}
                        className="text-primary hover:underline"
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
                  <TableCell className="font-semibold" colSpan={3}>
                    Totaux ({lignes.length} facture{lignes.length > 1 ? 's' : ''}, FCFA)
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
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
