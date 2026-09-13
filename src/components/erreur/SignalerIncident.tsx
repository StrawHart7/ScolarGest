'use client';

import * as React from 'react';
import { LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { enfiler } from '@/lib/offline/file-attente';
import { lireIdentite } from '@/lib/offline/identite-locale';
import {
  decrireIncident,
  formaterIncident,
  type ContexteIncident,
} from '@/lib/support-incident';
import { signalerIncidentAction } from '@/app/profil/support/actions';

/**
 * Troisieme choix de la page d'erreur : transmettre la panne au support.
 *
 * L'ecran affichait deja une reference, et personne ne savait quoi en faire —
 * ni l'utilisateur, qui la recopiait dans un message ecrit de memoire, ni le
 * support, qui recevait « ca ne marche pas » sans savoir sur quelle page.
 *
 * ## Trois decisions
 *
 * **On montre exactement ce qui part.** Le bloc technique est affiche, pas
 * resume, et la meme fonction produit l'affichage et l'envoi — deux fonctions
 * finiraient par diverger, et la promesse faite a l'utilisateur avec elles.
 * C'est la reponse a la question de confidentialite : elle se traite ici, sous
 * ses yeux, pas dans des conditions generales.
 *
 * **Pas de capture d'ecran.** Voir `src/lib/support-incident.ts` : un
 * navigateur ne se photographie pas lui-meme, et une capture ScolarGest
 * contient des noms d'eleves.
 *
 * **L'envoi peut partir en differe.** Une panne survient souvent *parce que*
 * le reseau est mauvais ; un signalement qui exigerait le reseau echouerait
 * exactement quand il sert. Il rejoint alors la file d'ecritures differees,
 * avec sa cle d'idempotence — le support recoit un ticket, pas trois.
 */

type Etat = 'ferme' | 'formulaire' | 'envoi' | 'envoye' | 'differe' | 'echec';

const MOTIF_SANS_IDENTITE =
  "Vous êtes hors ligne et cet appareil n'a pas gardé de session : le signalement ne peut pas être mis en attente. Reconnectez-vous puis écrivez depuis Profil, Support.";

export function SignalerIncident({ error }: { error: Error & { digest?: string } }) {
  const [etat, setEtat] = React.useState<Etat>('ferme');
  const [description, setDescription] = React.useState('');
  const [motif, setMotif] = React.useState<string | null>(null);
  const [contexte, setContexte] = React.useState<ContexteIncident | null>(null);

  // Le contexte est fige a l'ouverture du panneau, pas a l'envoi : entre les
  // deux, l'utilisateur peut avoir change d'onglet ou de reseau, et
  // l'horodatage doit rester celui de la panne.
  const ouvrir = () => {
    setContexte(decrireIncident({ message: error.message, digest: error.digest }));
    setEtat('formulaire');
  };

  /** Depose dans la file locale. Rend `true` si le depot a reussi. */
  const differer = async (ctx: ContexteIncident): Promise<boolean> => {
    const identite = lireIdentite();
    if (!identite) return false;
    await enfiler({
      userId: identite.userId,
      etablissementId: identite.etablissementId,
      type: 'SIGNALEMENT_INCIDENT',
      charge: { description, contexte: ctx },
      intitule: `Signalement d'erreur sur ${ctx.chemin}`,
    });
    return true;
  };

  /** Repli commun : mettre en file, ou dire pourquoi ce n'est pas possible. */
  const replier = async (ctx: ContexteIncident) => {
    if (await differer(ctx)) {
      setEtat('differe');
      return;
    }
    setMotif(MOTIF_SANS_IDENTITE);
    setEtat('echec');
  };

  const envoyer = async () => {
    const ctx = contexte ?? decrireIncident({ message: error.message, digest: error.digest });
    setEtat('envoi');
    setMotif(null);

    // Hors ligne : on ne tente meme pas. Un aller-retour condamne d'avance
    // couterait quelques secondes d'attente a quelqu'un qui est deja bloque.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await replier(ctx);
      return;
    }

    try {
      const resultat = await signalerIncidentAction({ description, contexte: ctx });

      // Une Server Action interrompue peut se **resoudre sur `undefined`** au
      // lieu de rejeter (voir `CLAUDE.md`). Ici le succes vaut `null` : lire
      // `undefined` comme un succes perdrait le signalement en annoncant
      // qu'il est parti. On le traite comme une coupure, donc on differe.
      if (typeof resultat === 'undefined') {
        await replier(ctx);
        return;
      }
      if (resultat === null) {
        setEtat('envoye');
        return;
      }
      // Le serveur a repondu et a refuse : rejouer ne ferait que rejouer le
      // refus. On le dit, on ne met pas en file.
      setMotif(resultat);
      setEtat('echec');
    } catch {
      await replier(ctx);
    }
  };

  if (etat === 'ferme') {
    return (
      <Button variant="ghost" size="sm" onClick={ouvrir}>
        <LifeBuoy className="mr-2 h-4 w-4" aria-hidden />
        Signaler au support
      </Button>
    );
  }

  if (etat === 'envoye' || etat === 'differe') {
    return (
      <p className="w-full rounded-lg border border-surface-border bg-surface-container-lowest px-4 py-3 text-body-sm text-text-secondary">
        {etat === 'envoye'
          ? 'Signalement envoyé. Vous le retrouvez dans Profil, Support, avec la réponse dès qu’elle arrive.'
          : 'Signalement conservé sur cet appareil. Il partira dès le retour de la connexion — vous n’avez rien d’autre à faire.'}
      </p>
    );
  }

  const bloc = contexte ? formaterIncident(contexte) : '';

  return (
    <div className="w-full space-y-3 text-left">
      <label htmlFor="incident-description" className="block text-label-md text-text-primary">
        Que faisiez-vous au moment de l’erreur ? (facultatif)
      </label>
      <Textarea
        id="incident-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="J’enregistrais un versement pour un élève de 3ème."
        disabled={etat === 'envoi'}
      />

      <details className="rounded-lg border border-surface-border bg-surface-container-lowest">
        <summary className="cursor-pointer px-3 py-2 text-label-md text-text-primary">
          Voir ce qui sera envoyé
        </summary>
        <pre
          className="overflow-x-auto whitespace-pre-wrap break-words border-t border-surface-border px-3 py-2 text-label-md text-text-secondary"
          data-mono
        >
          {bloc}
        </pre>
      </details>

      <p className="text-label-md text-text-secondary">
        Aucune capture d’écran, aucun nom d’élève et aucun montant ne sont transmis : seuls le
        chemin de la page et les informations techniques ci-dessus.
      </p>

      {etat === 'echec' && (
        <p className="text-label-md text-error">
          {motif ?? "Envoi impossible, et rien n'a pu être conservé sur cet appareil. Reconnectez-vous puis écrivez depuis Profil, Support."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void envoyer()} chargement={etat === 'envoi'}>
          Envoyer au support
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEtat('ferme')}
          disabled={etat === 'envoi'}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
