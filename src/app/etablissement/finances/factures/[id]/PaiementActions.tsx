'use client';

import { useId, useState, useTransition } from 'react';
import { FileText, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { annulerVersementAction, genererRecuAction } from './actions';

/**
 * Actions sur un versement encaissé : reçu PDF et annulation.
 * L'annulation demande un motif — c'est lui qui rend l'audit exploitable des
 * mois plus tard (chèque sans provision, erreur de saisie, doublon).
 *
 * Trois reprises du 2026-09-13 :
 *
 * - **« Annuler » devient « Annuler le versement ».** Seul, le mot désignait
 *   deux choses opposées sur le même écran : annuler l'encaissement, et
 *   renoncer à la saisie en cours. Le second bouton s'appelait « Retour »,
 *   ce qui ne levait l'ambiguïté que pour qui avait déjà cliqué.
 * - **La saisie du motif ne tient plus sur une ligne.** Un champ de 224px
 *   suivi de deux boutons, posé dans une cellule de tableau, poussait la
 *   rangée bien au-delà de la largeur disponible. Elle devient un panneau qui
 *   prend la largeur qu'on lui donne et passe à la ligne.
 * - **Le champ porte une étiquette reliée.** Il n'avait qu'un texte
 *   d'invite : un lecteur d'écran annonçait un champ sans nom, sur la seule
 *   action irréversible de l'écran.
 */
export function PaiementActions({
  paiementId,
  factureId,
  annule,
  recuReference,
}: {
  paiementId: string;
  factureId: string;
  annule: boolean;
  recuReference: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saisieMotif, setSaisieMotif] = useState(false);
  const [motif, setMotif] = useState('');
  // Plusieurs versements coexistent sur la même facture : un identifiant fixe
  // relierait toutes les étiquettes au premier champ de la page.
  const champMotif = useId();

  if (saisieMotif) {
    return (
      // Largeur fixe et non `w-full` : le conteneur qui reçoit ce panneau est
      // dimensionné par son contenu, `100%` comme `max-w-full` y seraient
      // circulaires — mesuré, 116px de débordement sur un écran de 390.
      //
      // 18rem tient dans ce qui reste d'un téléphone une fois retirées la
      // gouttière de page et celle de la rangée ; au-delà de `sm` la rangée a
      // de quoi le poser à côté du montant, ou le fait passer à la ligne
      // d'elle-même.
      <div className="w-72 rounded-lg border border-surface-border bg-surface-container-low p-3 sm:w-80">
        <Label htmlFor={champMotif}>Motif de l&apos;annulation</Label>
        <Input
          id={champMotif}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Chèque sans provision, erreur de saisie, doublon…"
          className="mt-1.5"
          autoFocus
        />
        {/* Dire ce qui va se passer, pas seulement demander confirmation : le
            versement n'est pas effacé, il reste au dossier, barré. Sans cette
            ligne, « annuler » se lit comme « supprimer », et on hésite à
            corriger une erreur de saisie. */}
        <p className="mt-2 text-body-sm text-text-secondary">
          Le versement reste au dossier, barré, et le solde de la facture est recalculé. Le motif
          est consigné au journal d&apos;audit.
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setSaisieMotif(false)}>
            Renoncer
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || motif.trim().length === 0}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const message = await annulerVersementAction(paiementId, factureId, motif.trim());
                if (message) setError(message);
                else setSaisieMotif(false);
              });
            }}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Confirmer l&apos;annulation
          </Button>
        </div>
        {error && <p className="mt-2 text-body-sm text-error">{error}</p>}
      </div>
    );
  }

  return (
    // Aligné à gauche sous `sm`, où la rangée d'actions occupe sa propre ligne
    // sous le montant ; à droite au-delà, où elle partage la ligne avec lui.
    <div className="flex w-full flex-col items-start gap-1 sm:w-auto sm:items-end">
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || annule}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await genererRecuAction(paiementId, factureId);
              if (result.error) setError(result.error);
              else if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
            });
          }}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileText className="h-4 w-4" aria-hidden />
          )}
          {recuReference ? 'Régénérer le reçu' : 'Générer le reçu'}
        </Button>

        {!annule && (
          <Button size="sm" variant="ghost" onClick={() => setSaisieMotif(true)}>
            <XCircle className="h-4 w-4" aria-hidden />
            Annuler le versement
          </Button>
        )}
      </div>
      {error && <p className="text-body-sm text-error">{error}</p>}
    </div>
  );
}
