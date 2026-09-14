import Link from 'next/link';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cheminAutorise } from '@/lib/navigation';
import { TITRES_DOMAINE, type Domaine, type Prerequis } from '@/lib/configuration-domaines';
import type { Role } from '@/services/tenant';

/**
 * Ce qui s'affiche à la place d'une section qu'on ne peut pas encore utiliser.
 *
 * **Il remplace l'écran, il ne s'y ajoute pas.** Une liste vide surmontée d'un
 * avertissement laisserait croire qu'il manque des données ; ici il manque une
 * décision, et elle se prend en trois minutes.
 *
 * ## Le bouton ne s'affiche qu'à qui peut s'en servir
 *
 * `cheminAutorise` sait déjà quels rôles ouvrent quel écran. Proposer
 * « Affecter mes enseignants » à un Enseignant l'enverrait sur une page qui le
 * refuserait — soit exactement le mur qu'on retire. Il lit la même explication,
 * et on lui dit à qui s'adresser plutôt que de lui tendre une porte fermée.
 *
 * ## Ce n'est pas une erreur
 *
 * Ni ton `error`, ni rouge. Une configuration inachevée n'est pas une faute :
 * c'est l'état normal d'une école de trois jours. Le rouge inquiéterait sans
 * rien proposer — la leçon de la bannière hors-ligne.
 */
export function DomaineVerrouille({
  domaine,
  manques,
  role,
}: {
  domaine: Domaine;
  manques: Prerequis[];
  role: Role;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
            <Lock className="h-5 w-5 text-warning" aria-hidden />
          </span>
          <h2 className="text-display-sm text-text-primary">{TITRES_DOMAINE[domaine]}</h2>
          <p className="max-w-prose text-body-sm text-text-secondary">
            {manques.length > 1
              ? 'Deux réglages manquent. Comptez trois minutes.'
              : 'Un seul réglage manque. Comptez une minute.'}
          </p>
        </div>

        <ol className="mx-auto flex w-full max-w-xl flex-col gap-3">
          {manques.map((manque, index) => {
            const peutCorriger = cheminAutorise(manque.href, role);
            return (
              <li
                key={manque.sonde}
                className="flex flex-col gap-3 rounded-lg border border-surface-border bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-label-md text-primary"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <p className="text-body-md font-medium text-text-primary">{manque.titre}</p>
                    <p className="text-body-sm text-text-secondary">{manque.pourquoi}</p>
                  </div>
                </div>

                {peutCorriger ? (
                  <Button asChild variant="primary" className="shrink-0 sm:ml-4">
                    <Link href={manque.href}>
                      {manque.action}
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <p className="shrink-0 text-body-sm text-text-secondary sm:ml-4">
                    À faire par la direction.
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        <p className="mx-auto flex max-w-prose items-center gap-2 text-body-sm text-text-secondary">
          <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          Cette section s’ouvrira d’elle-même une fois ces réglages faits.
        </p>
      </CardContent>
    </Card>
  );
}
