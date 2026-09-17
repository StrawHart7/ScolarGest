'use client';

import { useState, useTransition } from 'react';
import { CopyCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApercuReconduction } from '@/services/reconduction';
import { reprendreAnneePrecedente } from './actions';

/**
 * Reprendre d'un clic ce que l'année précédente avait déjà réglé.
 *
 * L'aperçu est **chiffré avant le clic**, pas après : « reprendre 113
 * affectations » et « reprendre » ne demandent pas la même confiance, et
 * personne ne devrait découvrir l'ampleur d'une action une fois qu'elle est
 * faite.
 *
 * Les tarifs ne sont pas ici. Ils se **proposent** sur leur propre écran, parce
 * qu'un tarif est immuable une fois créé : les poser d'un bouton enfermerait
 * l'école dans les prix de l'an dernier pour toute l'année.
 */
export function ReprendreAnnee({
  anneeScolaireId,
  apercu,
}: {
  anneeScolaireId: string;
  apercu: ApercuReconduction;
}) {
  const [enCours, demarrer] = useTransition();
  const [resultat, setResultat] = useState<{ ok: boolean; message: string } | null>(null);

  const total = apercu.affectations + apercu.titularites + apercu.creneaux;

  const lignes: string[] = [];
  if (apercu.affectations > 0) lignes.push(`${apercu.affectations} affectation(s) d'enseignants`);
  if (apercu.titularites > 0) lignes.push(`${apercu.titularites} professeur(s) principal(aux)`);
  if (apercu.creneaux > 0) lignes.push(`${apercu.creneaux} créneau(x) d'emploi du temps`);

  return (
    <div className="flex flex-col gap-4 border-t border-surface-border pt-4">
      <div>
        <h2 className="text-body-md font-semibold text-text-primary">
          Reprendre {apercu.source?.libelle}
        </h2>
        <p className="mt-1 text-body-sm text-text-secondary">
          {total > 0
            ? `${lignes.join(', ')} peuvent être repris tels quels sur ${apercu.classesAppariees} classe(s) retrouvée(s).`
            : "Rien à reprendre : l'année précédente n'avait ni affectation, ni professeur principal, ni emploi du temps sur ces classes."}
        </p>
      </div>

      {apercu.classesOrphelines.length > 0 && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-body-sm text-warning-on-container">
          Sans équivalent l&apos;an dernier, donc à remplir à la main :{' '}
          {apercu.classesOrphelines.join(', ')}.
        </p>
      )}

      {resultat && (
        <p
          // Pas de token `success` dans ce projet — et c'est un test qui me l'a
          // appris, pas une relecture : une classe inventée ne casse rien, elle
          // s'affiche sans effet. La réussite emprunte donc la couleur
          // primaire, employée partout ailleurs pour ce rôle.
          className={`rounded-lg p-3 text-body-sm ${
            resultat.ok
              ? 'border border-primary-container/30 bg-primary-container/10 text-primary-container'
              : 'border border-error/30 bg-error/10 text-error-on-container'
          }`}
          role="status"
        >
          {resultat.message}
        </p>
      )}

      {total > 0 && (
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const reponse = await reprendreAnneePrecedente(anneeScolaireId);
                // Une Server Action interrompue peut se résoudre sur
                // `undefined` sans rejeter : sans ce repli, l'écran tomberait
                // sur une erreur d'exécution brute au lieu d'un message.
                setResultat(
                  reponse ?? {
                    ok: false,
                    message: 'La connexion a été interrompue. Réessayez.',
                  },
                );
              })
            }
          >
            <CopyCheck className="h-4 w-4" aria-hidden />
            {enCours ? 'Reprise en cours…' : `Reprendre ces ${total} éléments`}
          </Button>
          <p className="mt-2 text-label-md text-text-secondary">
            Rien n&apos;est écrasé : ce qui existe déjà sur cette année est laissé tel quel, et
            l&apos;opération peut être relancée sans créer de doublon.
          </p>
        </div>
      )}
    </div>
  );
}
