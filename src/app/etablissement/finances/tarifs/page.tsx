import { AlertTriangle, Coins } from 'lucide-react';
import Link from 'next/link';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listTypesFrais } from '@/services/type-frais';
import { listTarifs, totalTarifs } from '@/services/tarif';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { TarifsFiltres } from './TarifsFiltres';
import { TarifForm } from './TarifForm';

const fcfa = (montant: number) => `${Number(montant).toLocaleString('fr-FR')} FCFA`;

export default async function TarifsPage({
  searchParams,
}: {
  searchParams: { anneeScolaireId?: string; classeId?: string };
}) {
  const ctx = await getTenantContext();
  const canWrite = ctx.role === 'COMPTABLE' || ctx.role === 'SUPER_ADMIN';

  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = searchParams.anneeScolaireId || anneeActive?.id || annees[0]?.id;

  const classes = anneeScolaireId ? await listClasses(anneeScolaireId) : [];
  const typesFrais = await listTypesFrais();
  const classeId = searchParams.classeId;
  const tarifs = anneeScolaireId ? await listTarifs(anneeScolaireId, classeId) : [];

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Configuration des tarifs</h1>
          <p className="text-body-md text-text-secondary">
            Montant de chaque type de frais, classe par classe et année par année. Ce sont ces
            tarifs qui alimentent automatiquement la facture d&apos;un élève à son inscription.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-error/20 bg-error/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" aria-hidden />
          <div>
            <p className="text-label-md font-semibold text-error">Attention</p>
            <p className="text-body-sm text-text-secondary">
              Un tarif est immuable une fois créé : il ne peut être ni modifié ni supprimé, pour
              préserver l&apos;intégrité des factures déjà émises. Pour corriger un montant, ajustez
              les lignes des factures concernées tant qu&apos;aucun versement n&apos;a été encaissé.
            </p>
          </div>
        </div>

        <Card>
          <div className="border-b border-surface-border p-4">
            <TarifsFiltres
              annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
              classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
              defaultAnneeScolaireId={anneeScolaireId ?? ''}
              defaultClasseId={classeId ?? ''}
            />
          </div>

          {tarifs.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Coins className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucun tarif défini.</p>
              <p className="text-body-sm text-text-secondary">
                Sans tarif, la facture générée à l&apos;inscription reste à 0.
              </p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classe</TableHead>
                  <TableHead>Type de frais</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Créé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tarifs.map((tarif) => (
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
          )}
        </Card>

        {canWrite && anneeScolaireId && (
          <Card>
            <CardHeader>
              <CardTitle>Nouveau tarif</CardTitle>
            </CardHeader>
            <CardContent>
              {typesFrais.length === 0 ? (
                <p className="text-body-sm text-text-secondary">
                  Créez d&apos;abord au moins un{' '}
                  <Link
                    href="/etablissement/finances/types-frais"
                    className="text-primary hover:underline"
                  >
                    type de frais
                  </Link>
                  .
                </p>
              ) : classes.length === 0 ? (
                <p className="text-body-sm text-text-secondary">
                  Aucune classe sur cette année scolaire.
                </p>
              ) : (
                <TarifForm
                  anneeScolaireId={anneeScolaireId}
                  classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
                  typesFrais={typesFrais.map((t) => ({ id: t.id, nom: t.nom }))}
                  defaultClasseId={classeId ?? ''}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
