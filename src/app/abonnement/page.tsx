import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getEtablissement } from '@/services/etablissement';
import {
  getAbonnementCourant,
  getEtatEtablissement,
  listPaiementsAbonnement,
} from '@/services/abonnement';
import { evaluerAcces, statutEffectif } from '@/services/abonnement-acces';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CarteListeMobile, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { getSidebarItems } from '@/lib/navigation';
import { LIBELLE_REGIME } from '@/lib/fondateur';

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
  const etat = await getEtatEtablissement(ctx.etablissementId);

  // Le regime tarifaire de l'ecole. Une fondatrice doit le voir : le programme
  // se vend comme un partenariat, pas comme une remise silencieuse, et une
  // ecole qui ignore qu'elle en fait partie ne peut ni s'en prevaloir ni
  // s'etonner si son tarif changeait.
  let fondatrice: { depuis: string | null; tarif: number | null } | null = null;
  try {
    const fiche = await getEtablissement(ctx.etablissementId);
    if (fiche.regimeTarifaire === 'FONDATRICE') {
      fondatrice = {
        depuis: fiche.fondatriceDepuisLe,
        tarif: fiche.tarifFondateurMensuel,
      };
    }
  } catch {
    // Un badge manquant est sans consequence ; une page d'abonnement
    // inaccessible en a, puisque c'est elle qui explique un acces bloque.
  }
  const acces = evaluerAcces({
    abonnement: abonnement ? { statut: abonnement.statut, dateFin: abonnement.dateFin } : null,
    essaiFinLe: etat.essaiFinLe,
    essaiDebuteLe: etat.essaiDebuteLe,
    suspension: etat.suspension,
  });

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-display-sm text-text-primary">Mon abonnement</h1>
            <p className="text-body-md text-text-secondary">
              État de l&apos;abonnement de votre établissement à ScolarGest et historique des
              règlements.
            </p>
          </div>
          {/* Souscrire engage une dépense : réservé au Directeur et au
              Comptable, comme la page elle-même. */}
          {/*
            Une fondatrice ne souscrit pas en libre-service : son tarif est un
            forfait fige, tandis que la page de paiement facture le catalogue
            public **par cycle**. Un complexe college-lycee y serait preleve de
            20 000 F au lieu des 15 000 F garantis — la promesse se romprait au
            premier renouvellement. Le refus est aussi pose dans le service
            (`creerIntentionPaiement`) : masquer le bouton informe, il ne
            protege pas.
          */}
          {(ctx.role === 'DIRECTEUR' || ctx.role === 'COMPTABLE') && !fondatrice && (
            <Button asChild>
              <Link href="/abonnement/souscrire">
                <CreditCard className="h-4 w-4" aria-hidden />
                {abonnement ? 'Renouveler' : 'Activer mon abonnement'}
              </Link>
            </Button>
          )}
        </div>

        {fondatrice && (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{LIBELLE_REGIME.FONDATRICE}</CardTitle>
              <Badge variant="success" shape="pill">
                Tarif garanti
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-body-sm text-text-secondary">
                Votre établissement fait partie des premières écoles partenaires de ScolarGest.
                Votre tarif préférentiel vous est acquis, sans limite de durée.
              </p>
              {fondatrice.tarif !== null && (
                <div className="flex justify-between">
                  <span className="text-body-sm text-text-secondary">Tarif mensuel</span>
                  <span className="text-body-md font-medium text-text-primary">
                    {fcfa(fondatrice.tarif)}
                  </span>
                </div>
              )}
              <p className="text-body-sm text-text-secondary">
                Votre renouvellement est établi par notre équipe. Écrivez-nous depuis{' '}
                <Link href="/profil/support" className="font-medium text-primary-container hover:underline">
                  le support
                </Link>{' '}
                et nous nous en occupons.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Situation actuelle</CardTitle>
            <Badge variant={etat.suspension ? 'error' : STATUT_BADGE[statut]} shape="pill">
              {etat.suspension
                ? 'Suspendu'
                : statut === 'AUCUN'
                  ? 'Aucun abonnement'
                  : statut}
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

            {/* Le motif est montré, pas seulement le fait d'être suspendu.
                Une école coupée sans explication appelle le support pour
                demander pourquoi ; celle qui lit le motif appelle pour le
                résoudre. */}
            {etat.suspension && (
              <div className="rounded-lg border border-error/20 bg-error/5 p-3">
                <p className="text-body-sm font-medium text-error">
                  Accès suspendu depuis le{' '}
                  {new Date(etat.suspension.le).toLocaleDateString('fr-FR')}
                </p>
                <p className="mt-1 text-body-sm text-text-secondary">
                  Motif : {etat.suspension.motif}
                </p>
              </div>
            )}

            {!etat.suspension && acces.message && (
              <p
                className={`rounded-lg border p-3 text-body-sm ${
                  acces.niveau === 'AVERTISSEMENT'
                    ? 'border-warning/30 bg-warning/10 text-warning-on-container'
                    : 'border-error/20 bg-error/5 text-error'
                }`}
              >
                {acces.message}
              </p>
            )}

            <p className="text-body-sm text-text-secondary">
              Le règlement se fait en Mobile Money depuis l&apos;application. L&apos;accès est
              rétabli dès la confirmation du paiement.
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
