'use client';

import * as React from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

/**
 * L'identifiant et le mot de passe d'un compte qu'on vient d'ouvrir.
 *
 * ## Pourquoi c'est rouge
 *
 * La première version était bleue, comme une information. Elle n'en est pas
 * une : **ce mot de passe ne se réaffichera jamais.** Le relire supposerait de
 * le garder en clair quelque part, et le récupérer passe par une
 * réinitialisation — donc par un second papier, un second appel, et la
 * personne qui ne peut pas se connecter entre-temps.
 *
 * Un fond bleu se lit comme « bon à savoir » et se survole. Le rouge dit qu'il
 * y a quelque chose à faire **maintenant**, avant de quitter l'écran.
 *
 * ## Pourquoi la confirmation
 *
 * Les deux boutons qui font quitter cette page demandent d'abord « avez-vous
 * noté le mot de passe ? ». Ce n'est pas un clic de trop : c'est le clic qui
 * évite au directeur de refaire toute la manœuvre plus tard, et à l'enseignant
 * de ne pas pouvoir se connecter le jour où il en a besoin.
 *
 * ## Le bouton « copier »
 *
 * `navigator.clipboard` n'existe pas partout — il exige un contexte sécurisé,
 * et certains navigateurs anciens ne l'ont pas du tout. Le bouton disparaît
 * alors au lieu de rester là sans rien faire, et les valeurs restent
 * sélectionnables d'un geste (`select-all`). Sur téléphone, le directeur
 * recopie de toute façon plus souvent sur du papier qu'il ne colle.
 */
export function IdentifiantsRemis({
  identifiant,
  motDePasse,
  destinataire,
  actions,
}: {
  identifiant: string;
  motDePasse: string;
  /** Nom de la personne à qui remettre ces informations. */
  destinataire: string;
  /** Rendu avec un garde-fou : chaque action demande confirmation d'abord. */
  actions: (props: { confirmer: (poursuivre: () => void) => void }) => React.ReactNode;
}) {
  const [demandeConfirmation, setDemandeConfirmation] = React.useState(false);
  const enAttente = React.useRef<(() => void) | null>(null);

  const confirmer = (poursuivre: () => void) => {
    enAttente.current = poursuivre;
    setDemandeConfirmation(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border-2 border-error">
        <p className="flex items-start gap-2 bg-error/10 px-4 py-3 text-body-sm font-semibold text-error">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Notez ces deux lignes maintenant et remettez-les à {destinataire}. Le mot de passe ne
            s&apos;affichera plus jamais.
          </span>
        </p>

        <div className="flex flex-col gap-4 p-4">
          <Champ etiquette="Identifiant" valeur={identifiant} />
          <Champ etiquette="Mot de passe provisoire" valeur={motDePasse} />
        </div>
      </div>

      {demandeConfirmation ? (
        <div className="flex flex-col gap-3 rounded-lg border border-error/40 bg-error/5 p-4">
          <p className="text-body-md font-medium text-text-primary">
            Avez-vous noté le mot de passe ?
          </p>
          <p className="text-body-sm text-text-secondary">
            Il n&apos;est plus affiché après cette page. S&apos;il est perdu, il faudra en générer
            un nouveau depuis la liste des utilisateurs.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => {
                const suite = enAttente.current;
                enAttente.current = null;
                setDemandeConfirmation(false);
                suite?.();
              }}
            >
              Oui, c&apos;est noté
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                enAttente.current = null;
                setDemandeConfirmation(false);
              }}
            >
              Pas encore
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">{actions({ confirmer })}</div>
      )}
    </div>
  );
}

function Champ({ etiquette, valeur }: { etiquette: string; valeur: string }) {
  const [copie, setCopie] = React.useState(false);
  const [copiePossible, setCopiePossible] = React.useState(false);

  // Évalué après le montage : `navigator` n'existe pas au rendu serveur, et un
  // bouton rendu puis retiré ferait sauter la mise en page.
  React.useEffect(() => {
    setCopiePossible(typeof navigator !== 'undefined' && Boolean(navigator.clipboard));
  }, []);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Refus du navigateur : la valeur reste sélectionnable à la main, il n'y
      // a rien d'utile à annoncer.
      setCopiePossible(false);
    }
  };

  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <span className="block text-label-md uppercase tracking-wide text-text-secondary">
          {etiquette}
        </span>
        <span className="block select-all break-all font-mono text-headline-sm text-text-primary">
          {valeur}
        </span>
      </div>
      {copiePossible && (
        <button
          type="button"
          onClick={copier}
          aria-label={`Copier ${etiquette.toLowerCase()}`}
          className={cn(
            'grid h-row-standard w-row-standard shrink-0 place-items-center rounded-lg transition-colors md:h-9 md:w-9',
            copie
              ? 'text-tertiary'
              : 'text-text-secondary hover:bg-surface-container hover:text-text-primary',
          )}
        >
          {copie ? (
            <Check className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <Copy className="h-[18px] w-[18px]" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
