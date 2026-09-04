'use client';

import { useState, useTransition } from 'react';
import { ShieldCheck, X, CheckCircle2, XCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { EvaluationSoumise } from '@/services/note';
import { validerSoumissionAction, rejeterSoumissionAction } from './actions';

const PERIODE_LABEL: Record<string, string> = {
  TRIMESTRE_1: 'Trimestre 1',
  TRIMESTRE_2: 'Trimestre 2',
  TRIMESTRE_3: 'Trimestre 3',
};

const TYPE_LABEL: Record<string, string> = {
  INTERROGATION: 'Interrogation',
  DEVOIR: 'Devoir',
  COMPOSITION: 'Composition',
};

type Mode = 'VALIDER' | 'REJETER';

/** Validation/rejet en bloc d'une évaluation soumise — même geste PIN que
 * l'approbation d'une demande de correction, mais sur toutes les notes de
 * l'évaluation à la fois (la soumission elle-même est déjà groupée). */
export function SoumissionModal({
  soumission,
  onClose,
}: {
  soumission: EvaluationSoumise;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('VALIDER');
  const [pin, setPin] = useState('');
  const [motif, setMotif] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

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
                  {TYPE_LABEL[soumission.evaluationType]} · {PERIODE_LABEL[soumission.periode]} n°
                  {soumission.numero}
                </p>
                <p className="mt-2 text-body-sm text-text-secondary">
                  {soumission.nombreNotes} note(s) soumise(s)
                </p>
              </div>

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
