'use client';

import * as React from 'react';
import { Check, GraduationCap, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Briques visuelles du fil de démarrage.
 *
 * Le questionnaire se présente comme une conversation : l'assistant pose une
 * question, l'utilisateur répond en cliquant, et l'échange se replie en un
 * résumé compact une fois l'étape franchie. Ce n'est pas un modèle de langage
 * — les réponses possibles sont connues d'avance — mais la forme
 * conversationnelle rend la progression lisible là où un formulaire de douze
 * sections découragerait.
 */

/** Message de l'assistant : question et aide contextuelle. */
export function BulleAssistant({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span
        aria-hidden
        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-container to-primary text-white"
      >
        <GraduationCap className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-surface-border bg-surface-container-lowest p-4 shadow-subtle">
        {children}
      </div>
    </div>
  );
}

/** Réponse déjà donnée, repliée en résumé. */
export function BulleReponse({ resume }: { resume: string }) {
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[85%] items-center gap-2 rounded-xl rounded-br-sm bg-primary-container px-4 py-2 text-body-sm text-white">
        <Check className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0">{resume}</span>
      </div>
    </div>
  );
}

export function QuestionEtape({
  question,
  aide,
  irreversible,
}: {
  question: string;
  aide?: string;
  irreversible?: string;
}) {
  return (
    <>
      <p className="text-body-md font-medium text-text-primary">{question}</p>
      {aide && <p className="mt-1 text-body-sm text-text-secondary">{aide}</p>}
      {irreversible && (
        <p className="mt-3 flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-body-sm text-amber-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{irreversible}</span>
        </p>
      )}
    </>
  );
}

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
