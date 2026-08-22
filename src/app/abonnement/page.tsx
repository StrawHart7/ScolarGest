import { CreditCard } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getAbonnementCourant, listPaiementsAbonnement } from '@/services/abonnement';
import { evaluerAcces, statutEffectif } from '@/services/abonnement-acces';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CarteListeMobile, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { getSidebarItems } from '@/lib/navigation';

const fcfa = (montant: number) => `${Number(montant).toLocaleString('fr-FR')} FCFA`;

const STATUT_BADGE = {
  ACTIF: 'success',
  EXPIRE: 'error',
  SUSPENDU: 'neutral',
  AUCUN: 'neutral',
} as const;

const MODE_LABEL: Record<string, string> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  AUTRE: 'Autre',
};

/**
 * Vue de l'école sur son propre abonnement. Reste accessible même quand
 * l'accès applicatif est bloqué (voir `PATHS_TOUJOURS_ACCESSIBLES` dans le
 * middleware) : c'est la page qui explique pourquoi et quoi faire.
 */
export default async function AbonnementPage() {
  const ctx = await getTenantContext();
  const abonnement = ctx.etablissementId ? await getAbonnementCourant(ctx.etablissementId) : null;

  // La page reste ouverte à tous les rôles — c'est elle qui explique un accès
  // bloqué, l'enfermer priverait justement l'utilisateur de l'explication. En
  // revanche l'historique des règlements est une information de direction :
  // seul le Directeur le voit, les autres gardent le statut et l'échéance.
  const voitLesReglements = ctx.role === 'DIRECTEUR' || ctx.role === 'SUPER_ADMIN';
  const paiements =
    abonnement && voitLesReglements ? await listPaiementsAbonnement(abonnement.id) : [];

  const statut = statutEffectif(
    abonnement ? { statut: abonnement.statut, dateFin: abonnement.dateFin } : null,
  );
  const acces = evaluerAcces(
    abonnement ? { statut: abonnement.statut, dateFin: abonnement.dateFin } : null,
  );

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Mon abonnement</h1>
          <p className="text-body-md text-text-secondary">
            État de l&apos;abonnement de votre établissement à ScolarGest et historique des
            règlements enregistrés par notre équipe.
          </p>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Situation actuelle</CardTitle>
            <Badge variant={STATUT_BADGE[statut]} shape="pill">
              {statut === 'AUCUN' ? 'Aucun abonnement' : statut}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {!abonnement ? (
              <p className="text-body-sm text-text-secondary">
                Aucun abonnement n&apos;est enregistré pour votre établissement. Contactez
                ScolarGest pour régulariser.
              </p>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-body-sm text-text-secondary">Formule</span>
                  <span className="text-body-md font-medium">
                    {abonnement.plan.nom} — {fcfa(abonnement.plan.prix)}
                    {abonnement.plan.duree === 'AN' ? ' / an' : ' / mois'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-body-sm text-text-secondary">Période</span>
                  <span className="text-body-md" data-mono>
                    {new Date(abonnement.dateDebut).toLocaleDateString('fr-FR')} →{' '}
                    {new Date(abonnement.dateFin).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                {acces.joursRestants !== null && (
                  <div className="flex justify-between">
                    <span className="text-body-sm text-text-secondary">Échéance</span>
                    <span className="text-body-md">
                      {acces.joursRestants > 0
                        ? `dans ${acces.joursRestants} jour${acces.joursRestants > 1 ? 's' : ''}`
                        : `dépassée depuis ${Math.abs(acces.joursRestants)} jour${Math.abs(acces.joursRestants) > 1 ? 's' : ''}`}
                    </span>
                  </div>
                )}
              </>
            )}

            {acces.message && (
              <p
                className={`rounded-lg border p-3 text-body-sm ${
                  acces.niveau === 'AVERTISSEMENT'
                    ? 'border-amber-500/20 bg-amber-500/5 text-amber-700'
                    : 'border-error/20 bg-error/5 text-error'
                }`}
              >
                {acces.message}
              </p>
            )}

            <p className="text-body-sm text-text-secondary">
              Le règlement se fait par virement ou Mobile Money, puis notre équipe l&apos;enregistre
              manuellement — l&apos;accès est rétabli dès la validation.
            </p>
          </CardContent>
        </Card>

        {voitLesReglements && (
        <Card>
          <CardHeader>
            <CardTitle>Règlements enregistrés</CardTitle>
          </CardHeader>
          {paiements.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <CreditCard className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">
                Aucun règlement enregistré pour cette période.
              </p>
            </CardContent>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Référence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paiements.map((paiement) => (
                      <TableRow key={paiement.id}>
                        <TableCell>{new Date(paiement.date).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell className="text-right" data-mono>
                          {fcfa(paiement.montant)}
                        </TableCell>
                        <TableCell>
                          {MODE_LABEL[paiement.modePaiement] ?? paiement.modePaiement}
                        </TableCell>
                        <TableCell data-mono>{paiement.reference ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <CarteListeMobile>
                {paiements.map((paiement) => (
                  <LigneCarteMobile
                    key={paiement.id}
                    icone={CreditCard}
                    titre={fcfa(paiement.montant)}
                    sousTitre={`${new Date(paiement.date).toLocaleDateString('fr-FR')} · ${MODE_LABEL[paiement.modePaiement] ?? paiement.modePaiement}`}
                    valeurSecondaire={paiement.reference ?? undefined}
                  />
                ))}
              </CarteListeMobile>
            </>
          )}
        </Card>
        )}
      </div>
    </AppLayout>
  );
}
