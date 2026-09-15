'use client';

import { useEffect, useState, useTransition } from 'react';
import { ShieldCheck, X, CheckCircle2, XCircle, Lock, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DetailSoumission, EvaluationSoumise } from '@/services/note';
import {
  validerSoumissionAction,
  rejeterSoumissionAction,
  chargerDetailSoumission,
} from './actions';

const TYPE_LABEL: Record<string, string> = {
  INTERROGATION: 'Interrogation',
  DEVOIR: 'Devoir',
  COMPOSITION: 'Composition',
};

type Mode = 'VALIDER' | 'REJETER';

/** Validation/rejet en bloc d'une évaluation soumise — même geste PIN que
 * l'approbation d'une demande de correction, mais sur toutes les notes de
 * l'évaluation à la fois (la soumission elle-même est déjà groupée). */
import { usePeriodes } from '@/components/layout/RegimeProvider';

export function SoumissionModal({
  soumission,
  onClose,
}: {
  soumission: EvaluationSoumise;
  onClose: () => void;
}) {
  // « 1er trimestre » ou « 1er semestre », selon le regime de l'ecole.
  const { nommer } = usePeriodes();
  const [mode, setMode] = useState<Mode>('VALIDER');
  const [pin, setPin] = useState('');
  const [motif, setMotif] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<DetailSoumission | null>(null);
  const [erreurDetail, setErreurDetail] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  // Chargé à l'ouverture, pas avec la liste : une file peut compter vingt
  // évaluations, et personne ne les ouvre toutes.
  useEffect(() => {
    let annule = false;
    setChargement(true);
    chargerDetailSoumission(soumission.evaluationId)
      .then((reponse) => {
        if (annule) return;
        if ('detail' in reponse) setDetail(reponse.detail);
        else setErreurDetail(reponse.erreur);
      })
      .catch(() => {
        if (!annule) setErreurDetail('Lecture impossible.');
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [soumission.evaluationId]);

  const pinValid = /^\d{6}$/.test(pin);

  function handleConfirm() {
    if (!pinValid) {
      setPinError('Le PIN doit contenir exactement 6 chiffres');
      return;
    }
    if (mode === 'REJETER' && motif.trim().length === 0) {
      setPinError('Le motif de rejet est requis');
      return;
    }
    setPinError(null);

    startTransition(async () => {
      const outcome =
        mode === 'VALIDER'
          ? await validerSoumissionAction(soumission.evaluationId, pin)
          : await rejeterSoumissionAction(soumission.evaluationId, pin, motif.trim());
      setResult(outcome);
      setPin('');
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-surface-border bg-surface-container-lowest shadow-lg">
        {result ? (
          <ConfirmationView result={result} onClose={onClose} onRetry={() => setResult(null)} />
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-surface-border bg-surface-container-low px-6 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1">
                <h2 className="text-headline-md text-text-primary">Validation sécurisée</h2>
                <p className="text-body-sm text-text-secondary">Validation par PIN requise</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-text-secondary hover:bg-surface-container-low"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="space-y-4 px-6 py-6">
              <div className="rounded-lg border border-surface-border bg-surface p-4">
                <p className="text-body-md font-medium text-text-primary">
                  {soumission.classeNom} — {soumission.matiereNom}
                </p>
                <p className="text-body-sm text-text-secondary">
                  {TYPE_LABEL[soumission.evaluationType]} · {nommer(soumission.periode)}
                </p>
              </div>

              {/*
                Les notes elles-mêmes. Avant, cette fenêtre n'affichait qu'un
                intitulé et un compteur : on demandait d'approuver sans rien
                montrer, alors que la validation est définitive — les notes
                entrent dans les moyennes et sur le bulletin. Un juge à qui on
                ne montre pas le dossier ne juge pas, il tamponne.
              */}
              <DetailNotes detail={detail} chargement={chargement} erreur={erreurDetail} />

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === 'VALIDER' ? 'primary' : 'secondary'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setMode('VALIDER')}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Valider
                </Button>
                <Button
                  type="button"
                  variant={mode === 'REJETER' ? 'destructive' : 'secondary'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setMode('REJETER')}
                >
                  <XCircle className="h-4 w-4" aria-hidden />
                  Rejeter
                </Button>
              </div>

              {mode === 'REJETER' && (
                <div className="space-y-1.5">
                  <Label htmlFor="motif">Motif du rejet</Label>
                  <Textarea
                    id="motif"
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    rows={2}
                    placeholder="Expliquez pourquoi cette évaluation est renvoyée à l'enseignant"
                  />
                  <p className="text-body-sm text-text-secondary">
                    Les notes repassent en brouillon chez l&apos;enseignant, avec ce motif visible, pour
                    correction puis nouvelle soumission.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="pin">PIN d&apos;approbation (6 chiffres)</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
                    aria-hidden
                  />
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="pl-9 tracking-[0.3em]"
                    placeholder="••••••"
                  />
                </div>
                {pinError && <p className="text-body-sm text-error">{pinError}</p>}
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-surface-border bg-surface-container p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
                <p className="text-body-sm text-text-secondary">
                  Cette action sera enregistrée dans le journal d&apos;audit de l&apos;établissement sous votre
                  identifiant.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-surface-border bg-surface px-6 py-4">
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                Annuler
              </Button>
              <Button
                type="button"
                variant={mode === 'REJETER' ? 'destructive' : 'primary'}
                onClick={handleConfirm}
                disabled={pending}
              >
                {pending ? 'Traitement...' : mode === 'VALIDER' ? 'Confirmer la validation' : 'Confirmer le rejet'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * La liste des notes soumises, plus les trois chiffres qu'on regarde en
 * relisant une classe : la moyenne, combien sont sous dix, et combien sont
 * hors de 0–20.
 *
 * Ce dernier ne devrait jamais arriver — la saisie borne — mais c'est
 * exactement le genre d'anomalie qu'une validation en aveugle laissait passer
 * jusqu'au bulletin.
 */
function DetailNotes({
  detail,
  chargement,
  erreur,
}: {
  detail: DetailSoumission | null;
  chargement: boolean;
  erreur: string | null;
}) {
  if (chargement) {
    return (
      <p className="rounded-lg border border-surface-border bg-surface p-4 text-body-sm text-text-secondary">
        Lecture des notes…
      </p>
    );
  }

  if (erreur || !detail) {
    return (
      <p className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-body-sm text-warning-on-container">
        {erreur ?? 'Notes illisibles.'} Vous pouvez tout de même décider, mais sans les avoir vues.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-surface-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-surface-border px-4 py-3">
        <span className="text-body-sm text-text-secondary">
          <strong className="text-text-primary">{detail.notes.length}</strong> note
          {detail.notes.length > 1 ? 's' : ''}
        </span>
        {detail.moyenne !== null && (
          <span className="text-body-sm text-text-secondary">
            Moyenne <strong className="text-text-primary">{detail.moyenne.toFixed(2)}</strong> / 20
          </span>
        )}
        <span className="text-body-sm text-text-secondary">
          {detail.sousLaMoyenne} sous 10
        </span>
      </div>

      {detail.aberrantes > 0 && (
        <p className="flex items-start gap-2 border-b border-surface-border bg-warning/10 px-4 py-3 text-body-sm text-warning-on-container">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {detail.aberrantes} note{detail.aberrantes > 1 ? 's sont' : ' est'} hors de 0 à 20.
            Renvoyez l&apos;évaluation plutôt que de la valider.
          </span>
        </p>
      )}

      <ul className="max-h-56 divide-y divide-surface-border overflow-y-auto">
        {detail.notes.map((n) => (
          <li key={n.eleveId} className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="min-w-0 truncate text-body-sm text-text-primary">
              {n.nom} {n.prenoms}
            </span>
            <span
              className={
                n.valeur !== null && n.valeur < 10
                  ? 'shrink-0 text-body-sm font-semibold text-warning-on-container'
                  : 'shrink-0 text-body-sm font-semibold text-text-primary'
              }
              data-mono
            >
              {n.valeur !== null ? `${n.valeur} / 20` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConfirmationView({
  result,
  onClose,
  onRetry,
}: {
  result: { success: boolean; message: string };
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <div
        className={
          result.success
            ? 'flex h-14 w-14 items-center justify-center rounded-full bg-tertiary/10 text-tertiary'
            : 'flex h-14 w-14 items-center justify-center rounded-full bg-error/10 text-error'
        }
      >
        {result.success ? (
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        ) : (
          <XCircle className="h-7 w-7" aria-hidden />
        )}
      </div>
      <div>
        <h2 className="text-headline-md text-text-primary">
          {result.success ? 'Action confirmée' : "Échec de l'opération"}
        </h2>
        <p className="mt-1 text-body-sm text-text-secondary">{result.message}</p>
      </div>
      <div className="mt-2 flex gap-3">
        {!result.success && (
          <Button type="button" variant="secondary" onClick={onRetry}>
            Réessayer
          </Button>
        )}
        <Button type="button" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}
