'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Smartphone, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formaterFCFA } from '@/lib/tarifs';
import { souscrireAction } from './actions';

/**
 * Écran de paiement.
 *
 * Il n'y a **aucun champ de carte bancaire**, et ce n'est pas un manque : les
 * héberger ferait entrer ScolarGest dans le périmètre PCI-DSS. Le paiement
 * mobile ne demande de toute façon qu'un numéro de téléphone, la confirmation
 * se faisant sur le combiné.
 *
 * Deux moyens, dans cet ordre délibéré : le Mobile Money direct garde l'école
 * dans l'application ; la page hébergée FedaPay sert de repli pour les moyens
 * que l'API directe ne couvre pas.
 */

export interface OperateurChoix {
  code: string;
  libelle: string;
}

export function FormulaireSouscription({
  prixMensuel,
  prixAnnuel,
  nombreCycles,
  operateurs,
  renouvellement,
}: {
  prixMensuel: number;
  prixAnnuel: number;
  nombreCycles: number;
  operateurs: OperateurChoix[];
  renouvellement: boolean;
}) {
  const router = useRouter();
  const [periodicite, setPeriodicite] = React.useState<'MOIS' | 'AN'>('AN');
  const [moyen, setMoyen] = React.useState<'MOBILE' | 'HEBERGE'>('MOBILE');
  const [operateur, setOperateur] = React.useState(operateurs[0]?.code ?? '');
  const [telephone, setTelephone] = React.useState('');
  const [enCours, setEnCours] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [succes, setSucces] = React.useState<string | null>(null);

  const total = periodicite === 'AN' ? prixAnnuel : prixMensuel;
  const economie = prixMensuel * 12 - prixAnnuel;

  async function payer() {
    setErreur(null);
    setSucces(null);
    setEnCours(true);
    let resultat: Awaited<ReturnType<typeof souscrireAction>> | undefined;
    try {
      resultat = await souscrireAction({ periodicite, moyen, operateur, telephone });
    } catch {
      resultat = undefined;
    }
    setEnCours(false);

    // Une Server Action interrompue peut se résoudre sur `undefined` plutôt
    // que rejeter — motif déjà rencontré sur `/demarrage`. Sur une page de
    // paiement, laisser passer une erreur d'exécution brute serait le pire
    // moment pour perdre la confiance de l'utilisateur.
    if (!resultat || typeof resultat.ok !== 'boolean') {
      setErreur('Connexion interrompue. Vérifiez votre réseau et réessayez.');
      return;
    }
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    if (resultat.url) {
      window.location.href = resultat.url;
      return;
    }
    setSucces(resultat.message);
    // Le webhook fait foi : on rafraîchit pour que le statut d'abonnement
    // apparaisse dès que FedaPay a confirmé, sans que l'école ait à recharger.
    router.refresh();
  }

  if (succes) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-tertiary/30 bg-tertiary-fixed/40 p-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tertiary">
          <Smartphone className="h-7 w-7 text-white" aria-hidden />
        </span>
        <p className="text-body-md font-medium text-text-primary">{succes}</p>
        <p className="text-body-sm text-text-secondary">
          Votre abonnement s’activera automatiquement dès la confirmation, même si vous fermez
          cette page.
        </p>
        <Button variant="secondary" onClick={() => router.refresh()}>
          Actualiser l’état de mon abonnement
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
      {/* Colonne gauche : ce que l'on achète. */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Choisissez votre formule</h2>
          <p className="mt-1 text-body-sm text-text-secondary">
            {nombreCycles > 1
              ? `Votre établissement exploite ${nombreCycles} cycles.`
              : 'Votre établissement exploite un cycle.'}{' '}
            Le tarif en dépend.
          </p>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Périodicité</legend>
          <OptionFormule
            titre="Formule annuelle"
            detail={`Un an d’accès. Vous économisez ${formaterFCFA(economie)}.`}
            montant={formaterFCFA(prixAnnuel)}
            unite="/an"
            choisi={periodicite === 'AN'}
            onChoisir={() => setPeriodicite('AN')}
          />
          <OptionFormule
            titre="Formule mensuelle"
            detail="Sans engagement, renouvelable chaque mois."
            montant={formaterFCFA(prixMensuel)}
            unite="/mois"
            choisi={periodicite === 'MOIS'}
            onChoisir={() => setPeriodicite('MOIS')}
          />
        </fieldset>

        <div className="mt-2 rounded-xl border border-surface-border bg-surface-container-low p-5">
          <p className="mb-3 text-label-md uppercase tracking-wide text-text-secondary">
            Ce que vous gardez actif
          </p>
          <ul className="flex flex-col gap-2.5">
            {/* Ces lignes décrivent ce que la lecture seule retire, et rien de
                plus. L'essai étant à accès complet et sans restriction, toute
                mention d'un « filigrane d'essai » ou d'un plafond serait
                fausse — et la première école à le constater aurait raison de
                se méfier du reste. */}
            {[
              'Saisie et validation des notes',
              'Génération des bulletins et des reçus',
              'Facturation, encaissements et relances',
              'Inscription de nouveaux élèves',
            ].map((ligne) => (
              <li key={ligne} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" aria-hidden />
                <span className="text-body-sm text-text-secondary">{ligne}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Colonne droite : comment on paie. */}
      <div className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-container-lowest p-5 shadow-subtle sm:p-6">
        <h2 className="text-lg font-bold text-text-primary">Moyen de paiement</h2>

        <div className="grid grid-cols-2 gap-3">
          <ChoixMoyen
            titre="Mobile Money"
            icone={<Smartphone className="h-5 w-5" aria-hidden />}
            choisi={moyen === 'MOBILE'}
            onChoisir={() => setMoyen('MOBILE')}
          />
          <ChoixMoyen
            titre="Autre moyen"
            icone={<ExternalLink className="h-5 w-5" aria-hidden />}
            choisi={moyen === 'HEBERGE'}
            onChoisir={() => setMoyen('HEBERGE')}
          />
        </div>

        {moyen === 'MOBILE' ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="operateur">Opérateur</Label>
              <div className="flex flex-col gap-2">
                {operateurs.map((o) => (
                  <button
                    key={o.code}
                    type="button"
                    onClick={() => setOperateur(o.code)}
                    aria-pressed={operateur === o.code}
                    className={cn(
                      'rounded-lg border px-4 py-3 text-left text-body-sm transition-colors',
                      operateur === o.code
                        ? 'border-primary-container bg-primary-fixed/50 font-medium text-primary-container'
                        : 'border-surface-border text-text-secondary hover:border-primary-container/50',
                    )}
                  >
                    {o.libelle}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telephone-paiement">Numéro à débiter</Label>
              <Input
                id="telephone-paiement"
                name="telephone-paiement"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="90 12 34 56"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
              <p className="text-body-sm text-text-secondary">
                Vous recevrez une demande de confirmation sur ce numéro.
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-surface-border bg-surface-container-low p-4 text-body-sm text-text-secondary">
            Vous serez redirigé vers la page de paiement sécurisée de FedaPay, puis ramené ici une
            fois le règlement effectué.
          </p>
        )}

        <div className="mt-2 flex items-baseline justify-between border-t border-surface-border pt-4">
          <span className="text-body-md font-medium text-text-primary">Total à régler</span>
          <span className="text-2xl font-extrabold text-text-primary">
            {formaterFCFA(total)}
          </span>
        </div>

        {erreur && <p className="text-body-sm text-error">{erreur}</p>}

        <Button size="lg" className="w-full" onClick={payer} disabled={enCours}>
          {enCours
            ? 'Initialisation…'
            : renouvellement
              ? 'Renouveler mon abonnement'
              : 'Activer mon abonnement'}
        </Button>

        <p className="flex items-start gap-2 text-body-sm text-text-secondary">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" aria-hidden />
          ScolarGest ne conserve aucune coordonnée bancaire. Le règlement est traité par FedaPay.
        </p>
      </div>
    </div>
  );
}

function OptionFormule({
  titre,
  detail,
  montant,
  unite,
  choisi,
  onChoisir,
}: {
  titre: string;
  detail: string;
  montant: string;
  unite: string;
  choisi: boolean;
  onChoisir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoisir}
      aria-pressed={choisi}
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors',
        choisi
          ? 'border-primary-container bg-primary-fixed/40'
          : 'border-surface-border bg-surface-container-lowest hover:border-primary-container/50',
      )}
    >
      <span className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
            choisi ? 'border-primary-container' : 'border-outline-variant',
          )}
        >
          {choisi && <span className="h-2.5 w-2.5 rounded-full bg-primary-container" />}
        </span>
        <span>
          <span className="block text-body-md font-medium text-text-primary">{titre}</span>
          <span className="mt-0.5 block text-body-sm text-text-secondary">{detail}</span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-lg font-bold text-text-primary">{montant}</span>
        <span className="block text-body-sm text-text-secondary">{unite}</span>
      </span>
    </button>
  );
}

function ChoixMoyen({
  titre,
  icone,
  choisi,
  onChoisir,
}: {
  titre: string;
  icone: React.ReactNode;
  choisi: boolean;
  onChoisir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoisir}
      aria-pressed={choisi}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors',
        choisi
          ? 'border-primary-container bg-primary-fixed/40 text-primary-container'
          : 'border-surface-border text-text-secondary hover:border-primary-container/50',
      )}
    >
      {icone}
      <span className="text-body-sm font-medium">{titre}</span>
    </button>
  );
}
