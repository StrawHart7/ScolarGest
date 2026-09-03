import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Actions sur une ligne d'abonnement.
 *
 * Il n'y en a plus qu'une : aller à la fiche de l'école. Les deux gestes qui
 * vivaient ici ont été retirés pour des raisons distinctes.
 *
 * **Le renouvellement** créait la période suivante en `SUSPENDU` en attendant
 * le règlement — or `SUSPENDU` fermait l'accès. Préparer l'échéance d'une
 * école parfaitement à jour la mettait donc dehors. Une période n'existe
 * désormais que si elle est acquise : elle s'ouvre par le paiement de l'école,
 * ou par « Ouvrir une période » sur sa fiche.
 *
 * **La suspension** porte sur l'établissement depuis la migration `0026`, et
 * non sur une période : posée sur l'abonnement, elle disparaissait au
 * renouvellement suivant. Elle exige de surcroît un motif, ce qui appelle un
 * formulaire plutôt qu'un bouton dans un tableau.
 *
 * Composant serveur : plus aucun état, plus aucune transition.
 */
export function AbonnementRowActions({ etablissementId }: { etablissementId: string }) {
  return (
    <div className="flex justify-end">
      <Button asChild size="sm" variant="secondary">
        <Link href={`/super-admin/etablissements/${etablissementId}`}>Gérer l&apos;école</Link>
      </Button>
    </div>
  );
}
