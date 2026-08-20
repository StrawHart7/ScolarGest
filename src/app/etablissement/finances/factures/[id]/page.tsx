import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Wallet } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { peutEcrire } from '@/services/abonnement';
import { getFactureDetail, type StatutFacture } from '@/services/facture';
import { listTypesFrais } from '@/services/type-frais';
import { listDocumentsParType } from '@/services/document';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { LignesFactureEditor } from './LignesFactureEditor';
import { NouveauVersementForm } from './NouveauVersementForm';
import { PaiementActions } from './PaiementActions';

const fcfa = (montant: number) => `${Number(montant).toLocaleString('fr-FR')} FCFA`;

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

const MODE_LABEL: Record<string, string> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  AUTRE: 'Autre',
};

export default async function FactureDetailPage({ params }: { params: { id: string } }) {
  // Les cinq lectures sont indépendantes : en file indienne elles coûtaient
  // cinq allers-retours pour une page qui n'en demande qu'un.
  const [ctx, ecritureOuverte, factureOuNull, typesFrais, recus] = await Promise.all([
    getTenantContext(),
    peutEcrire(),
    getFactureDetail(params.id).catch(() => null),
    listTypesFrais(),
    listDocumentsParType('RECU'),
  ]);

  const canWrite = (ctx.role === 'COMPTABLE' || ctx.role === 'SUPER_ADMIN') && ecritureOuverte;
  if (!factureOuNull) notFound();
  const facture = factureOuNull;
  const recuParPaiement = new Map(
    recus.filter((d) => d.statut === 'GENERE').map((d) => [d.objetId, d.reference]),
  );

  const progression =
    facture.montantTotal > 0
      ? Math.min(Math.round((facture.totalPaye / facture.montantTotal) * 100), 100)
      : 0;

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/etablissement/finances/factures"
              className="inline-flex items-center gap-1.5 text-body-sm text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Suivi des paiements
            </Link>
            <h1 className="mt-1 text-display-sm text-text-primary">
              {facture.eleve.nom} {facture.eleve.prenoms}
            </h1>
            <p className="text-body-sm text-text-secondary">
              Matricule <span data-mono>{facture.eleve.matricule}</span>
              {facture.classeNom ? ` • ${facture.classeNom}` : ''}
              {facture.anneeLibelle ? ` • ${facture.anneeLibelle}` : ''}
            </p>
          </div>
          <Badge variant={STATUT_BADGE[facture.statut]} shape="pill">
            {STATUT_LABEL[facture.statut]}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Détail de la facture</CardTitle>
              </CardHeader>
              <CardContent>
                {canWrite && facture.lignesModifiables ? (
                  <LignesFactureEditor
                    factureId={facture.id}
                    lignesInitiales={facture.lignes.map((l) => ({
                      typeFraisId: l.typeFraisId,
                      designation: l.designation,
                      montant: Number(l.montant),
                    }))}
                    typesFrais={typesFrais.map((t) => ({ id: t.id, nom: t.nom }))}
                  />
                ) : (
                  <>
                    {facture.lignes.length === 0 ? (
                      <p className="text-body-sm text-text-secondary">
                        Aucune ligne : aucun tarif n&apos;était défini pour la classe au moment de
                        l&apos;inscription.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Désignation</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {facture.lignes.map((ligne) => (
                            <TableRow key={ligne.id}>
                              <TableCell>{ligne.designation}</TableCell>
                              <TableCell className="text-right" data-mono>
                                {fcfa(ligne.montant)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell className="font-semibold">Total facturé</TableCell>
                            <TableCell className="text-right font-semibold" data-mono>
                              {fcfa(facture.montantTotal)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                    {canWrite && !facture.lignesModifiables && facture.statut !== 'ANNULE' && (
                      <p className="mt-3 text-body-sm text-text-secondary">
                        Un versement a déjà été encaissé : les lignes ne sont plus modifiables.
                        Toute correction passe par un nouveau versement ou une annulation.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Versements</CardTitle>
              </CardHeader>
              {facture.paiements.length === 0 ? (
                <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                  <Wallet className="h-10 w-10 text-text-secondary/50" aria-hidden />
                  <p className="text-body-sm text-text-secondary">
                    Aucun versement encaissé sur cette facture.
                  </p>
                </CardContent>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Reçu</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facture.paiements.map((paiement) => (
                      <TableRow key={paiement.id}>
                        <TableCell>
                          {new Date(paiement.datePaiement).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell
                          className={`text-right ${paiement.statut === 'ANNULE' ? 'text-text-secondary line-through' : ''}`}
                          data-mono
                        >
                          {fcfa(paiement.montant)}
                        </TableCell>
                        <TableCell>{MODE_LABEL[paiement.modePaiement] ?? paiement.modePaiement}</TableCell>
                        <TableCell data-mono>{paiement.reference ?? '—'}</TableCell>
                        <TableCell data-mono>{recuParPaiement.get(paiement.id) ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          {canWrite ? (
                            <PaiementActions
                              paiementId={paiement.id}
                              factureId={facture.id}
                              annule={paiement.statut === 'ANNULE'}
                              recuReference={recuParPaiement.get(paiement.id) ?? null}
                            />
                          ) : (
                            <Badge
                              variant={paiement.statut === 'ANNULE' ? 'neutral' : 'success'}
                              shape="pill"
                            >
                              {paiement.statut === 'ANNULE' ? 'Annulé' : 'Encaissé'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            {canWrite && facture.statut !== 'ANNULE' && facture.solde > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Nouveau versement</CardTitle>
                </CardHeader>
                <CardContent>
                  <NouveauVersementForm factureId={facture.id} solde={facture.solde} />
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Synthèse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-body-sm text-text-secondary">Total facturé</span>
                <span className="text-body-md font-semibold" data-mono>
                  {fcfa(facture.montantTotal)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-body-sm text-text-secondary">Total réglé</span>
                <span className="text-body-md font-semibold text-tertiary" data-mono>
                  {fcfa(facture.totalPaye)}
                </span>
              </div>

              <div
                className="h-2 w-full overflow-hidden rounded-full bg-surface-container"
                role="progressbar"
                aria-valuenow={progression}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progression du règlement"
              >
                <div className="h-full rounded-full bg-tertiary" style={{ width: `${progression}%` }} />
              </div>

              <div className="border-t border-surface-border pt-4">
                <p className="text-body-sm text-text-secondary">Solde restant</p>
                <p
                  className={`text-display-sm ${facture.solde > 0 ? 'text-error' : 'text-tertiary'}`}
                  data-mono
                >
                  {fcfa(facture.solde)}
                </p>
              </div>

              <Link
                href={`/etablissement/eleves/${facture.eleveId}`}
                className="inline-block text-body-sm text-primary hover:underline"
              >
                Voir la fiche élève
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
