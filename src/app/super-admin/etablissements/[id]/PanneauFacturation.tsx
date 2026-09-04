'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { suspendre, reactiver, prolonger, definirRegime } from '@/app/super-admin/abonnements/actions';
import { formaterFCFA } from '@/lib/abonnement-formule';
import { placesRestantes, type PlacesFondatrices, type RegimeTarifaire } from '@/lib/fondateur';

/**
 * Gestes commerciaux de la plateforme sur une école : prolonger l'essai,
 * suspendre, lever une suspension.
 *
 * Ils vivent sur la fiche de l'école et non sur la liste des abonnements,
 * parce qu'ils portent sur l'école elle-même. La suspension notamment : posée
 * sur l'abonnement, elle s'effaçait au renouvellement suivant, si bien qu'une
 * école suspendue redevenait active en payant — une sanction qu'un paiement
 * suffit à lever n'en est pas une (migration `0026`).
 *
 * Chaque geste demande un motif. Celui de la suspension est **affiché à
 * l'école** ; celui de la prolongation reste dans le journal, parce qu'une
 * bonne nouvelle n'a pas à être justifiée auprès de son bénéficiaire.
 */
export function PanneauFacturation({
  etablissementId,
  essaiDemarre,
  suspension,
  regime,
  tarifFondateur,
  places,
}: {
  etablissementId: string;
  essaiDemarre: boolean;
  suspension: { le: string; motif: string } | null;
  regime: RegimeTarifaire;
  /** Fige a l'admission. `null` hors programme. */
  tarifFondateur: number | null;
  places: PlacesFondatrices;
}) {
  const [enCours, demarrer] = React.useTransition();
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [formulaire, setFormulaire] = React.useState<'aucun' | 'suspension' | 'prolongation'>(
    'aucun',
  );
  const [motif, setMotif] = React.useState('');
  const [jours, setJours] = React.useState('15');

  function lancer(action: () => Promise<string | null>) {
    setErreur(null);
    demarrer(async () => {
      const message = await action();
      if (message) setErreur(message);
      else {
        setFormulaire('aucun');
        setMotif('');
      }
    });
  }

  const fondatrice = regime === 'FONDATRICE';
  const restantes = placesRestantes(places);
  const complet = !fondatrice && restantes === 0;

  return (
    <div className="flex flex-col gap-4">
      {/*
        Le regime tarifaire est le premier bloc : il conditionne le montant de
        toutes les periodes ouvertes ensuite. Le decouvrir apres avoir saisi un
        tarif obligerait a recommencer.
      */}
      <div className="rounded-lg border border-surface-border bg-surface-container-lowest p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-body-md font-medium text-text-primary">
            {fondatrice ? 'École fondatrice' : 'Tarif standard'}
          </p>
          {fondatrice && tarifFondateur !== null && (
            <p className="text-body-sm text-text-secondary">
              {formaterFCFA(tarifFondateur)}/mois, forfait garanti à vie
            </p>
          )}
        </div>
        <p className="mt-1 text-body-sm text-text-secondary">
          {fondatrice
            ? 'Forfait par établissement, quel que soit le nombre de cycles. Le tarif est figé sur cette école : le catalogue peut évoluer sans la toucher.'
            : `Grille publique, facturée par cycle. ${
                restantes === null
                  ? ''
                  : complet
                    ? 'Le programme fondateur est complet.'
                    : `${restantes} place(s) encore ouverte(s) au programme fondateur.`
              }`}
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          disabled={enCours || complet}
          onClick={() => lancer(() => definirRegime(etablissementId, fondatrice ? 'STANDARD' : 'FONDATRICE'))}
        >
          {fondatrice ? 'Repasser au tarif standard' : 'Admettre au programme fondateur'}
        </Button>
      </div>

      {suspension ? (
        <div className="rounded-lg border border-error/20 bg-error/5 p-4">
          <p className="text-body-sm font-medium text-error">
            Suspendue depuis le {new Date(suspension.le).toLocaleDateString('fr-FR')}
          </p>
          <p className="mt-1 text-body-sm text-text-secondary">Motif : {suspension.motif}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            disabled={enCours}
            onClick={() => lancer(() => reactiver(etablissementId))}
          >
            Lever la suspension
          </Button>
        </div>
      ) : formulaire === 'suspension' ? (
        <div className="flex flex-col gap-3 rounded-lg border border-surface-border p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="motif-suspension">Motif de la suspension</Label>
            <Input
              id="motif-suspension"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Impayé de trois mois malgré relances"
            />
            <p className="text-body-sm text-text-secondary">
              Ce texte sera affiché au Directeur et à la Secrétaire de l&apos;école.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={enCours}
              onClick={() =>
                lancer(() => {
                  const donnees = new FormData();
                  donnees.set('etablissementId', etablissementId);
                  donnees.set('motif', motif);
                  return suspendre(null, donnees);
                })
              }
            >
              Confirmer la suspension
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFormulaire('aucun')}>
              Annuler
            </Button>
          </div>
        </div>
      ) : formulaire === 'prolongation' ? (
        <div className="flex flex-col gap-3 rounded-lg border border-surface-border p-4">
          <div className="flex gap-3">
            <div className="flex w-28 flex-col gap-1.5">
              <Label htmlFor="jours-essai">Jours</Label>
              <Input
                id="jours-essai"
                type="number"
                inputMode="numeric"
                min={1}
                max={180}
                value={jours}
                onChange={(e) => setJours(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="motif-prolongation">Motif</Label>
              <Input
                id="motif-prolongation"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Rentrée décalée, école pilote…"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={enCours}
              onClick={() =>
                lancer(() => {
                  const donnees = new FormData();
                  donnees.set('etablissementId', etablissementId);
                  donnees.set('jours', jours);
                  donnees.set('motif', motif);
                  return prolonger(null, donnees);
                })
              }
            >
              Prolonger l&apos;essai
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFormulaire('aucun')}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* Prolonger un essai qui n'a jamais démarré n'a pas de sens : le
              service le refuse, autant ne pas proposer le geste. */}
          {essaiDemarre && (
            <Button size="sm" variant="secondary" onClick={() => setFormulaire('prolongation')}>
              Prolonger l&apos;essai
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => setFormulaire('suspension')}>
            Suspendre l&apos;école
          </Button>
        </div>
      )}

      {erreur && <p className="text-body-sm text-error">{erreur}</p>}
    </div>
  );
}
