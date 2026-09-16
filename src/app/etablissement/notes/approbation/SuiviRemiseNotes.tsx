import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EtatVide } from '@/components/ui/etat-vide';
import { cn } from '@/lib/utils';
import { periodesDuRegime, phrasePeriode, type RegimePeriodes } from '@/lib/periodes';
import type { CollecteNotes, EtatRemise } from '@/services/collecte-notes';

/**
 * « Qui ne m'a pas encore rendu ses notes ? »
 *
 * Le vocabulaire est celui de la salle des professeurs, pas celui de la base :
 * un directeur ne dit pas « affectation », il dit « la matière de M. Untel en
 * 6ème A ». Le mot n'apparaît donc nulle part ici, et le décompte de tête
 * porte sur les **enseignants**, parce que c'est à un enseignant qu'on
 * téléphone.
 *
 * Et jamais le mot « retard » : la plateforme ne connaît pas le calendrier de
 * l'école — ni la date des compositions, ni la fin du trimestre. Dire « en
 * retard » serait affirmer ce qu'on ignore, et poser du rouge sur le nom d'un
 * enseignant qui a peut-être encore trois semaines devant lui. D'où
 * `warning` sur la pastille, jamais `error`.
 *
 * La carte vient en **troisième** sur l'écran d'approbation, après ce qui est
 * arrivé. C'est une seule page pour la question entière : ce qui attend une
 * validation, ce qui attend une correction, et ce qui n'est pas encore là.
 */

const ETIQUETTE_ETAT: Record<EtatRemise, string> = {
  RIEN: 'Aucune note saisie',
  // Distinction utile : les notes sont là, il ne manque que la soumission.
  // Réclamer un travail déjà fait est le meilleur moyen de perdre la
  // confiance d'un enseignant.
  COMMENCE: 'Notes saisies, pas encore rendues',
  RENDU: 'Rendues',
};

function accord(nombre: number, singulier: string, pluriel: string) {
  return nombre > 1 ? pluriel : singulier;
}

export function SuiviRemiseNotes({
  collecte,
  base,
  regime,
}: {
  collecte: CollecteNotes;
  /** Chemin de la page, pour les liens de période. */
  base: string;
  /** Deux onglets pour un lycée au semestre, trois sinon. */
  regime: RegimePeriodes;
}) {
  const { periode, enAttente, enseignantsTotal, coursTotal, coursRendus } = collecte;
  const manquants = coursTotal - coursRendus;
  const enseignantsEnAttente = enAttente.length;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Notes pas encore rendues</CardTitle>
        <nav className="-mx-1 flex gap-1 overflow-x-auto" aria-label="Période">
          {periodesDuRegime(regime).map((p) => (
            <Link
              key={p}
              href={`${base}?periode=${p}`}
              aria-current={p === periode ? 'page' : undefined}
              className={cn(
                'flex h-row-standard items-center whitespace-nowrap rounded-lg px-3 text-body-sm transition-colors md:h-auto md:py-1.5',
                p === periode
                  ? 'bg-primary-container/10 font-semibold text-primary-container'
                  : 'text-text-secondary hover:bg-surface-container',
              )}
            >
              {phrasePeriode(p, regime)}
            </Link>
          ))}
        </nav>
      </CardHeader>

      <CardContent>
        {coursTotal === 0 ? (
          <EtatVide
            titre="Aucun enseignant n'a encore de matière attribuée."
            explication="Attribuez leurs matières à vos enseignants : cette liste vous dira ensuite, période par période, qui vous a rendu ses notes et qui ne les a pas encore rendues."
          />
        ) : enseignantsEnAttente === 0 ? (
          <EtatVide
            titre={`Tous vos enseignants ont rendu leurs notes pour le ${phrasePeriode(periode, regime)}.`}
            explication="Une matière sort de cette liste dès qu'une note y est rendue. Changez de période ci-dessus pour vérifier les autres."
          />
        ) : (
          <div className="space-y-4">
            <p className="text-body-md text-text-primary">
              <strong>
                {enseignantsEnAttente} {accord(enseignantsEnAttente, 'enseignant', 'enseignants')}{' '}
                sur {enseignantsTotal}
              </strong>{' '}
              {accord(enseignantsEnAttente, "n'a", "n'ont")} pas encore rendu toutes leurs notes
              pour le {phrasePeriode(periode, regime)}. Il manque les notes de {manquants}{' '}
              {accord(manquants, 'matière', 'matières')}.
            </p>

            <ul className="divide-y divide-surface-border">
              {enAttente.map((e) => (
                <li key={e.enseignantId} className="py-3 first:pt-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body-md font-medium text-text-primary">
                      {e.nomComplet}
                    </span>
                    <Badge variant="warning">
                      {e.manques.length} {accord(e.manques.length, 'matière', 'matières')}
                    </Badge>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {e.manques.map((m) => (
                      <li
                        key={`${m.classeId}-${m.matiereId}`}
                        className="flex flex-col gap-0.5 text-body-sm sm:flex-row sm:items-baseline sm:gap-2"
                      >
                        <span className="text-text-primary">
                          {m.matiereNom} — {m.classeNom}
                        </span>
                        <span className="text-text-secondary">{ETIQUETTE_ETAT[m.etat]}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            <p className="text-body-sm text-text-secondary">
              ScolarGest ne connaît pas vos dates de composition : c&apos;est un état des lieux, pas
              un retard.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
