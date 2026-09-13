import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { peutEcrire } from '@/services/abonnement';
import { getFactureDetail, type StatutFacture } from '@/services/facture';
import { listTypesFrais } from '@/services/type-frais';
import { listDocumentsParType } from '@/services/document';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
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

  const canWrite =
    (ctx.role === 'COMPTABLE' || ctx.role === 'SECRETAIRE' || ctx.role === 'SUPER_ADMIN') &&
    ecritureOuverte;
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
            <LienRetour href="/etablissement/finances/factures">
              Retour au suivi des paiements
            </LienRetour>
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

        {/* La synthèse est bornée en largeur au lieu de prendre un tiers de
            la page. Elle porte cinq lignes ; `1fr` lui donnait 350px sur un
            écran de 1440 et n'en laissait que 700 au bloc de gauche, où le
            tableau des versements se retrouvait à faire défiler ses six
            colonnes horizontalement. Une colonne de contexte se dimensionne
            sur son contenu, pas sur une fraction de l'écran. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* min-w-0 : sans lui, une grid track ne rétrécit jamais sous la
              largeur intrinsèque de son contenu (ici le tableau des lignes) —
              c'est toute la page qui s'élargissait et se dézoomait sur
              mobile au lieu de laisser le tableau défiler localement dans
              son propre `overflow-x-auto`. */}
          <div className="min-w-0 space-y-6">
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
              <CardHeader className="flex-row items-baseline justify-between gap-4">
                <CardTitle>Versements</CardTitle>
                {facture.paiements.length > 0 && (
                  <span className="text-body-sm text-text-secondary">
                    {facture.paiements.length} versement
                    {facture.paiements.length > 1 ? 's' : ''}
                  </span>
                )}
              </CardHeader>
              {facture.paiements.length === 0 ? (
                <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                  <Wallet className="h-10 w-10 text-text-secondary/50" aria-hidden />
                  <p className="text-body-sm text-text-secondary">
                    Aucun versement encaissé sur cette facture.
                  </p>
                </CardContent>
              ) : (
                /*
                  Un versement n'est pas une donnée tabulaire.

                  Le bloc portait six colonnes — date, montant, mode, référence,
                  reçu, actions — dans une piste de grille de 700px, dont une
                  cellule d'actions qui contient deux boutons. Le tableau
                  débordait et se mettait à défiler horizontalement à l'intérieur
                  de sa carte : « 300 000 FCFA » se coupait en deux lignes,
                  « REC-2025-000005 » en trois, et il fallait faire glisser le
                  tableau pour atteindre « Annuler ». Deux des six colonnes
                  affichaient un tiret la plupart du temps.

                  Une facture porte un, deux, parfois trois versements. On ne
                  les compare pas colonne par colonne — on lit un montant, puis
                  on vérifie de quand il date et comment il est entré. D'où une
                  rangée : le montant seul sur la première ligne, tout le reste
                  en dessous.

                  Une seule présentation pour toutes les largeurs. La version
                  précédente en maintenait deux, un tableau et des cartes, qui
                  disaient la même chose de deux façons.
                */
                <ul>
                  {facture.paiements.map((paiement) => {
                    const annule = paiement.statut === 'ANNULE';
                    const recu = recuParPaiement.get(paiement.id) ?? null;
                    // Chaque jeton reste insécable ; c'est la ligne qui passe
                    // à la suivante, jamais une référence coupée en son milieu.
                    const contexte = [
                      new Date(paiement.datePaiement).toLocaleDateString('fr-FR'),
                      MODE_LABEL[paiement.modePaiement] ?? paiement.modePaiement,
                      paiement.reference ? `réf. ${paiement.reference}` : null,
                      recu ? `reçu ${recu}` : null,
                    ].filter((v): v is string => Boolean(v));

                    return (
                      <li
                        key={paiement.id}
                        className="flex flex-wrap items-start gap-x-4 gap-y-3 border-t border-surface-border px-4 py-4 first:border-t-0 md:px-6"
                      >
                        <div className="min-w-0 flex-1 basis-48">
                          {/* Le statut est collé au montant qu'il qualifie. Posé
                              à l'autre bout de la rangée, il se retrouvait sur
                              téléphone seul sur une ligne, au-dessus des
                              boutons — donc rattaché visuellement aux actions
                              plutôt qu'à la somme dont il dit l'état. */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p
                              className={cn(
                                'text-headline-md',
                                annule ? 'text-text-secondary line-through' : 'text-text-primary',
                              )}
                              data-mono
                            >
                              {fcfa(paiement.montant)}
                            </p>
                            <Badge variant={annule ? 'neutral' : 'success'} shape="pill">
                              {annule ? 'Annulé' : 'Encaissé'}
                            </Badge>
                          </div>
                          {/* Le point de séparation est accroché au jeton qui le
                              précède, jamais à celui qui le suit : porté par le
                              suivant, il se retrouvait en tête de ligne dès que
                              le contexte passait à la ligne — « 13/09/2026 ·
                              Espèces » puis « · reçu REC-2025-000005 ». Un
                              point en fin de ligne se lit, un point en début de
                              ligne se remarque. */}
                          <p className="mt-1 flex flex-wrap items-center gap-y-0.5 text-body-sm text-text-secondary">
                            {contexte.map((jeton, i) => (
                              <span key={jeton} className="whitespace-nowrap">
                                {jeton}
                                {i < contexte.length - 1 && (
                                  <span
                                    className="mx-2 inline-block h-1 w-1 rounded-full bg-outline-variant align-middle"
                                    aria-hidden
                                  />
                                )}
                              </span>
                            ))}
                          </p>
                        </div>

                        {/* Pas de `shrink-0` : il empêchait précisément le `flex-wrap` de se
                              déclencher — le conteneur restait dimensionné sur ses deux
                              boutons, soit 380px là où un téléphone n'en offre que 342.
                              Mesuré : 108px de débordement.

                              Sur téléphone la rangée d'actions prend sa propre ligne et
                              s'aligne à gauche, sous le montant : alignée à droite, elle
                              produisait un escalier de boutons de largeurs inégales. */}
                        {canWrite && (
                          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
                            <PaiementActions
                              paiementId={paiement.id}
                              factureId={facture.id}
                              annule={annule}
                              recuReference={recu}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
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
                <div
                  className="h-full rounded-full bg-tertiary"
                  style={{ width: `${progression}%` }}
                />
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
