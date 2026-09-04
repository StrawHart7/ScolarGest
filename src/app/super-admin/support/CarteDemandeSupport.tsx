'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Clock, MapPin, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  libelleCategorie,
  LIBELLES_STATUT_SUPPORT,
  type DemandeSupportPlateforme,
  type StatutSupport,
} from '@/lib/support';
import {
  repondreAction,
  changerStatutSupportAction,
  lienPieceJointeAction,
} from './actions';

const TON: Record<StatutSupport, 'neutral' | 'primary' | 'success' | 'warning'> = {
  NOUVELLE: 'primary',
  EN_COURS: 'warning',
  RESOLUE: 'success',
  FERMEE: 'neutral',
};

function ilYA(iso: string): string {
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return 'hier';
  return `il y a ${jours} jours`;
}

/**
 * Une demande de support, avec sa réponse.
 *
 * Répondre écrit la réponse **et** le statut en un seul geste : un support qui
 * répond sans avancer le statut fait retraiter la demande par le collègue
 * suivant, et un statut avancé sans réponse laisse l'école devant un ticket
 * clos qu'elle ne comprend pas.
 *
 * Une demande déjà répondue reste modifiable — le champ est prérempli. Les
 * corrections d'une réponse hâtive sont la norme, pas l'exception.
 */
export function CarteDemandeSupport({
  demande,
  visuel,
}: {
  demande: DemandeSupportPlateforme;
  /**
   * Icône et teinte de la catégorie, décidées par la file qui rend la carte.
   * Passer le composant d'icône depuis un parent client est sans risque — la
   * frontière serveur/client, elle, interdirait de le faire depuis une page.
   */
  visuel?: { Icone: typeof Mail; classe: string };
}) {
  const router = useRouter();
  const [statut, setStatut] = React.useState<StatutSupport>(demande.statut);
  const [reponse, setReponse] = React.useState(demande.reponseSupport ?? '');
  const [ouvert, setOuvert] = React.useState(false);
  const [enCours, setEnCours] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);

  async function telechargerPieceJointe() {
    setErreur(null);
    const resultat = await appeler(() => lienPieceJointeAction(demande.id));
    if (!resultat || !resultat.ok || !resultat.url) {
      setErreur(resultat?.message ?? 'Lien indisponible. Reessayez.');
      return;
    }
    // Ouverture dans un onglet : le bucket est prive, l'URL signee expire vite,
    // et la faire transiter par un lien rendu dans la page la perimerait.
    window.open(resultat.url, '_blank', 'noopener,noreferrer');
  }

  async function appeler<T>(appel: () => Promise<T | undefined>): Promise<T | undefined> {
    // Une Server Action interrompue peut se résoudre sur `undefined` sans
    // rejeter. Sans cette enveloppe, l'appelant lirait `.ok` sur `undefined`.
    try {
      return await appel();
    } catch {
      return undefined;
    }
  }

  async function envoyerReponse(cible: StatutSupport) {
    setErreur(null);
    setEnCours(true);
    const resultat = await appeler(() => repondreAction(demande.id, reponse, cible));
    setEnCours(false);
    if (!resultat || !resultat.ok) {
      setErreur(resultat?.message ?? 'Connexion interrompue. Votre réponse est conservée.');
      return;
    }
    setStatut(cible);
    setOuvert(false);
    router.refresh();
  }

  async function changerStatut(cible: StatutSupport) {
    const precedent = statut;
    setErreur(null);
    setStatut(cible);
    setEnCours(true);
    const resultat = await appeler(() => changerStatutSupportAction(demande.id, cible));
    setEnCours(false);
    if (!resultat || !resultat.ok) {
      setStatut(precedent);
      setErreur(resultat?.message ?? 'Connexion interrompue. Réessayez.');
      return;
    }
    router.refresh();
  }

  // Une demande sans réponse depuis plus de deux jours est celle sur laquelle
  // une école est en train de perdre confiance.
  const enRetard =
    statut === 'NOUVELLE' && Date.now() - new Date(demande.createdAt).getTime() > 2 * 86_400_000;

  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-surface-container-lowest p-5',
        enRetard ? 'border-warning/30' : 'border-surface-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {visuel && (
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                visuel.classe,
              )}
              aria-hidden
            >
              <visuel.Icone className="h-4.5 w-4.5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-body-md font-semibold text-text-primary">{demande.sujet}</p>
            <p className="text-body-sm text-text-secondary">
              {demande.etablissementNom} — {demande.auteurNom} ({demande.auteurRole})
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {enRetard && (
            <Badge shape="pill" variant="warning">
              Sans réponse
            </Badge>
          )}
          <Badge shape="pill" variant={TON[statut]}>
            {LIBELLES_STATUT_SUPPORT[statut]}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-body-sm">
        <a
          href={`mailto:${demande.auteurEmail}?subject=${encodeURIComponent(`ScolarGest — ${demande.sujet}`)}`}
          className="flex items-center gap-1.5 text-primary-container hover:underline"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          {demande.auteurEmail}
        </a>
        <span className="flex items-center gap-1.5 text-text-secondary">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {ilYA(demande.createdAt)}
        </span>
        <span className="flex items-center gap-1.5 text-text-secondary">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {libelleCategorie(demande.categorie)}
          {demande.pageOrigine ? ` · ${demande.pageOrigine}` : ''}
        </span>
      </div>

      <p className="whitespace-pre-wrap rounded-lg border-l-2 border-surface-border bg-surface-container-low p-3 text-body-sm leading-relaxed text-text-secondary">
        {demande.message}
      </p>

      {demande.fichierChemin && (
        <Button size="sm" variant="secondary" className="self-start" onClick={telechargerPieceJointe}>
          <Paperclip className="h-4 w-4" aria-hidden />
          {demande.fichierNom ?? 'Telecharger la piece jointe'}
        </Button>
      )}

      {demande.reponseSupport && !ouvert && (
        <div className="rounded-lg border-l-2 border-primary-container bg-primary-fixed/40 p-3">
          <p className="text-label-md font-semibold text-primary-container">Réponse envoyée</p>
          <p className="mt-1 whitespace-pre-wrap text-body-sm leading-relaxed text-text-primary">
            {demande.reponseSupport}
          </p>
        </div>
      )}

      {ouvert && (
        <div className="space-y-3">
          <Textarea
            rows={5}
            value={reponse}
            onChange={(e) => setReponse(e.target.value)}
            maxLength={4000}
            placeholder="Réponse visible par l’école sur sa page Support."
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={enCours || reponse.trim() === ''}
              onClick={() => envoyerReponse('RESOLUE')}
            >
              Répondre et marquer résolue
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={enCours || reponse.trim() === ''}
              onClick={() => envoyerReponse('EN_COURS')}
            >
              Répondre, demande en cours
            </Button>
            <Button size="sm" variant="ghost" disabled={enCours} onClick={() => setOuvert(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {erreur && <p className="text-body-sm text-error">{erreur}</p>}

      {!ouvert && (
        <div className="flex flex-wrap gap-2 border-t border-surface-border pt-3">
          <Button size="sm" variant="primary" disabled={enCours} onClick={() => setOuvert(true)}>
            {demande.reponseSupport ? 'Modifier la réponse' : 'Répondre'}
          </Button>
          {statut === 'NOUVELLE' && (
            <Button
              size="sm"
              variant="secondary"
              disabled={enCours}
              onClick={() => changerStatut('EN_COURS')}
            >
              Prendre en charge
            </Button>
          )}
          {statut !== 'FERMEE' && (
            <Button
              size="sm"
              variant="ghost"
              disabled={enCours}
              onClick={() => changerStatut('FERMEE')}
            >
              Fermer sans réponse
            </Button>
          )}
          {statut === 'FERMEE' && (
            <Button
              size="sm"
              variant="secondary"
              disabled={enCours}
              onClick={() => changerStatut('NOUVELLE')}
            >
              Rouvrir
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
