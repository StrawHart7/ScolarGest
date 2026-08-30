'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Briques d'interaction communes aux étapes du questionnaire de démarrage.
 *
 * Le fil conversationnel a laissé place à une carte flottante ne montrant
 * qu'une étape à la fois (voir `FilDemarrage`) : les bulles d'assistant et de
 * réponse n'ont plus d'objet, la progression étant portée par `RailEtapes`.
 * Restent les deux briques réellement partagées par les étapes.
 */

/** Choix cliquable façon puce, pour les sélections multiples. */
export function PuceChoix({
  selectionne,
  onClick,
  desactive,
  children,
}: {
  selectionne: boolean;
  onClick: () => void;
  desactive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      aria-pressed={selectionne}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-body-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selectionne
          ? 'border-primary-container bg-primary-container text-white'
          : 'border-surface-border bg-surface-container-lowest text-text-primary hover:border-primary-container/50 hover:bg-primary-fixed/40',
      )}
    >
      {selectionne && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}

/** Message d'erreur d'une étape. */
export function ErreurEtape({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mt-3 text-body-sm text-error">{message}</p>;
}
