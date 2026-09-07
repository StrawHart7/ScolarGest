'use client';

import * as React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useConnectivity } from '@/components/connectivity/connectivity-context';
import { useSynchronisation } from './synchronisation-context';
import { TENTATIVES_AVANT_ABANDON } from '@/lib/offline/file-attente';
import { Button } from '@/components/ui/button';

/**
 * Bandeau des ecritures restant a envoyer.
 *
 * Une file invisible est une file oubliee : l'utilisateur fermerait
 * l'application en croyant son encaissement enregistre, et la deconnexion
 * effacerait tout. Le bandeau reste donc affiche tant qu'il reste quelque
 * chose, en ligne comme hors ligne.
 *
 * Il annonce un **nombre** et non un pourcentage de progression : ce qui
 * inquiete l'utilisateur est « combien de mon travail n'est pas encore parti »,
 * pas « ou en est la machine ».
 */
export function IndicateurFile() {
  const sync = useSynchronisation();
  const { enLigne } = useConnectivity();
  const [deplie, setDeplie] = React.useState(false);

  if (!sync || sync.enAttente === 0) return null;

  const pluriel = sync.enAttente > 1;
  const epuisees = sync.operations.filter((o) => o.tentatives >= TENTATIVES_AVANT_ABANDON);

  return (
    <div className="border-b border-surface-border bg-warning-container px-gutter py-2.5 md:px-container-pad">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <CloudOff className="h-4 w-4 shrink-0 text-text-primary" aria-hidden />
        <p className="text-body-sm text-text-primary">
          <strong>
            {sync.enAttente} ecriture{pluriel ? 's' : ''}
          </strong>{' '}
          n&apos;{pluriel ? 'ont' : 'a'} pas encore ete envoyee{pluriel ? 's' : ''} au serveur.
          {enLigne
            ? ' Envoi en cours des que possible.'
            : ' Elles partiront au retour de la connexion.'}
        </p>

        <div className="ms-auto flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setDeplie((v) => !v)}
          >
            {deplie ? 'Masquer le detail' : 'Voir le detail'}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void sync.synchroniser()}
            disabled={!enLigne || sync.enCours}
          >
            <RefreshCw className={sync.enCours ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
            {sync.enCours ? 'Envoi...' : 'Envoyer maintenant'}
          </Button>
        </div>
      </div>

      {deplie && (
        <ul className="mt-3 space-y-1.5 border-t border-surface-border/60 pt-3">
          {sync.operations.map((operation) => (
            <li key={operation.cle} className="text-body-sm text-text-primary">
              <span className="font-medium">{operation.intitule}</span>
              {operation.tentatives > 0 && (
                <span className="text-text-secondary">
                  {' '}
                  — {operation.tentatives} tentative{operation.tentatives > 1 ? 's' : ''}
                  {operation.dernierEchec ? ` : ${operation.dernierEchec}` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {epuisees.length > 0 && (
        <p className="mt-2 text-body-sm text-text-primary">
          {epuisees.length} ecriture{epuisees.length > 1 ? 's' : ''} n&apos;
          {epuisees.length > 1 ? 'ont' : 'a'} pas pu etre envoyee
          {epuisees.length > 1 ? 's' : ''} apres plusieurs tentatives. Elle
          {epuisees.length > 1 ? 's sont conservees' : ' est conservee'} sur cet appareil :
          utilisez « Envoyer maintenant » une fois le probleme corrige.
        </p>
      )}
    </div>
  );
}
