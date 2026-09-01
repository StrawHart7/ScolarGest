import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Carte dont le contenu se deplie.
 *
 * Bati sur `<details>` / `<summary>` natifs, sans etat React ni `'use client'` :
 * le pli est du ressort du navigateur, il fonctionne avant meme que le
 * JavaScript n'ait charge, et il est accessible au clavier sans qu'on ait a
 * l'ecrire.
 *
 * Sert aux blocs qui meritent d'exister sans meriter la place qu'ils prennent —
 * un detail par classe, par exemple : precieux quand on le cherche, encombrant
 * quand on ne le cherche pas. Le resume porte donc l'essentiel, pour qu'on
 * puisse decider de deplier sans deplier.
 */
export function CarteRepliable({
  titre,
  resume,
  children,
  ouverteParDefaut = false,
  className,
}: {
  titre: string;
  /** Ce qu'on lit sans deplier. Doit suffire a decider si l'on deplie. */
  resume?: string;
  children: React.ReactNode;
  ouverteParDefaut?: boolean;
  className?: string;
}) {
  return (
    <details
      open={ouverteParDefaut}
      className={cn(
        'group overflow-hidden rounded-xl border border-surface-border bg-surface-container-lowest',
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-container-low [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-headline-sm text-text-primary">{titre}</span>
          {resume && (
            <span className="mt-0.5 block text-body-sm text-text-secondary">{resume}</span>
          )}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-text-secondary transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-surface-border px-5 py-4">{children}</div>
    </details>
  );
}
