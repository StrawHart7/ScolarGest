'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { desactiver, reactiver } from './actions';

/**
 * Couper et rendre l'accès d'un compte.
 *
 * La désactivation **bannit le compte Auth** depuis le 2026-09-11. Avant, elle
 * n'écrivait qu'une colonne que rien ne lisait : ni `requireRole`, ni le
 * middleware. Un employé parti gardait donc un accès complet. Elle a maintenant
 * un effet réel, d'où la confirmation — ce bouton vit dans une colonne de
 * tableau, à un clic de distance de la ligne voisine.
 *
 * La réactivation existe **parce que** la désactivation est devenue effective.
 * Sans elle, un clic de trop serait sans retour : le bannissement Auth ne se
 * lève pas depuis le produit.
 */
export function DesactiverButton({
  utilisateurId,
  nomComplet,
}: {
  utilisateurId: string;
  nomComplet?: string;
}) {
  const [pending, startTransition] = useTransition();

  const confirmer = () => {
    const message =
      `Désactiver ${nomComplet ?? 'ce compte'} ?\n\n` +
      `La personne ne pourra plus se connecter, et sa session en cours prendra fin ` +
      `dans l'heure. Vous pourrez lui rendre l'accès depuis cette même liste.`;
    if (window.confirm(message)) startTransition(() => desactiver(utilisateurId));
  };

  return (
    <Button variant="destructive" size="sm" disabled={pending} onClick={confirmer}>
      {pending ? 'Désactivation…' : 'Désactiver'}
    </Button>
  );
}

export function ReactiverButton({ utilisateurId }: { utilisateurId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => reactiver(utilisateurId))}
    >
      {pending ? 'Réactivation…' : 'Réactiver'}
    </Button>
  );
}
