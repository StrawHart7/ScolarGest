'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, CopyMinus, LifeBuoy, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { compter, aQuelqueChoseAEcrire, type AnalyseImport } from '@/lib/import/analyse';
import { resumeEntetesPourSupport } from '@/lib/import/entetes';
import { signalerEntetesAuSupport } from '@/app/etablissement/import-support-actions';

/**
 * Bilan d'un import, avant et après écriture.
 *
 * Trois états, dans l'ordre où l'utilisateur les rencontre :
 *
 * 1. **Colonnes non reconnues** — le fichier n'est même pas lisible. On
 *    n'affiche aucune ligne : elles produiraient toutes la même erreur, et
 *    noyer un problème unique sous 230 répétitions le rend invisible. Sortie
 *    proposée : envoyer le fichier au support.
 * 2. **Bilan avant confirmation** — ce qui sera écrit, ce qui est ignoré, ce
 *    qui est refusé. **Rien n'a encore été écrit.**
 * 3. **Rapport final** — ce qui a réellement été écrit.
 *
 * Les doublons ont leur propre compteur, distinct des refus. Un fichier
 * redéposé pour corriger trois lignes affiche « 230 déjà présentes » et non
 * « 230 échecs » : un bilan alarmant sur une opération réussie apprend vite à
 * ne plus lire les bilans.
 */

export type DomaineImport = 'eleves' | 'enseignants' | 'paiements';

export interface RapportFinal {
  succes: number;
  echecs: number;
  /**
   * Absent quand le domaine ne detecte pas de doublons. Seul l'import des
   * eleves le fait : un versement identique le meme jour est legitime — deux
   * tranches reglees le matin et l'apres-midi — et le refuser ferait
   * disparaitre de l'argent reellement encaisse.
   */
  doublons?: number;
  details: { ligne: number; ok: boolean; message: string }[];
}

interface Props {
  analyse: AnalyseImport;
  rapport?: RapportFinal;
  domaine: DomaineImport;
  /** Le fichier analysé, renvoyé tel quel au support ou à la confirmation. */
  fichier: File | null;
  /**
   * Le domaine détecte-t-il les doublons ? Faux pour enseignants et paiements.
   * Afficher « 0 déjà présentes » y promettrait un contrôle qui n'existe pas.
   */
  detecteDoublons?: boolean;
  onConfirmer: () => void;
  enCours: boolean;
}

function Compteur({
  valeur,
  libelle,
  ton,
  Icone,
}: {
  valeur: number;
  libelle: string;
  ton: 'success' | 'neutral' | 'error';
  Icone: typeof CheckCircle2;
}) {
  const couleur =
    ton === 'success' ? 'text-tertiary' : ton === 'error' ? 'text-error' : 'text-text-secondary';
  return (
    <div className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-container-lowest px-4 py-3">
      <Icone className={`h-5 w-5 shrink-0 ${couleur}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-body-md font-semibold text-text-primary">{valeur}</p>
        <p className="text-body-sm text-text-secondary">{libelle}</p>
      </div>
    </div>
  );
}

function BlocEntetes({
  analyse,
  domaine,
  fichier,
}: {
  analyse: AnalyseImport;
  domaine: DomaineImport;
  fichier: File | null;
}) {
  const [envoi, setEnvoi] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, setEnCours] = React.useState(false);
  const resume = resumeEntetesPourSupport(analyse.entetes);

  async function envoyer() {
    if (!fichier) return;
    setEnCours(true);
    setEnvoi(null);
    const formData = new FormData();
    formData.set('fichier', fichier);
    formData.set('resume', resume);
    formData.set('domaine', domaine);
    let resultat: Awaited<ReturnType<typeof signalerEntetesAuSupport>> | undefined;
    try {
      resultat = await signalerEntetesAuSupport(formData);
    } catch {
      // Une Server Action interrompue peut se résoudre sur `undefined` sans
      // rejeter : sans cette enveloppe, l'appelant lirait `.ok` sur `undefined`.
      resultat = undefined;
    }
    setEnCours(false);
    setEnvoi(
      resultat ?? {
        ok: false,
        message: 'Connexion interrompue. Votre fichier est toujours sélectionné, réessayez.',
      },
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <div>
          <p className="text-body-md font-semibold text-text-primary">
            Les colonnes du fichier ne correspondent pas
          </p>
          <p className="text-body-sm text-text-secondary">
            Aucune ligne n&apos;a été lue et rien n&apos;a été écrit. Corrigez la première ligne du
            fichier, ou envoyez-le au support qui s&apos;en chargera.
          </p>
        </div>
      </div>

      <div className="space-y-2 text-body-sm">
        <div>
          <p className="font-medium text-text-primary">Colonnes manquantes</p>
          <code className="mt-1 block overflow-x-auto rounded bg-surface-container-lowest p-2 text-text-secondary">
            {analyse.entetes.manquantes.join(' | ') || 'aucune'}
          </code>
        </div>
        <div>
          <p className="font-medium text-text-primary">Colonnes trouvées dans votre fichier</p>
          <code className="mt-1 block overflow-x-auto rounded bg-surface-container-lowest p-2 text-text-secondary">
            {analyse.entetes.trouvees.join(' | ') || 'aucune'}
          </code>
        </div>
      </div>

      {envoi ? (
        <p className={`text-body-sm ${envoi.ok ? 'text-tertiary' : 'text-error'}`}>{envoi.message}</p>
      ) : (
        <Button variant="secondary" onClick={envoyer} disabled={enCours || !fichier}>
          <LifeBuoy className="h-4 w-4" aria-hidden />
          {enCours ? 'Envoi en cours…' : 'Envoyer le fichier au support'}
        </Button>
      )}
    </div>
  );
}

export function ApercuImport({
  analyse,
  rapport,
  domaine,
  fichier,
  onConfirmer,
  enCours,
  detecteDoublons = false,
}: Props) {
  if (!analyse.entetes.conforme) {
    return <BlocEntetes analyse={analyse} domaine={domaine} fichier={fichier} />;
  }

  const decompte = compter(analyse.lignes);
  const confirmable = aQuelqueChoseAEcrire(analyse.lignes);
  const aSignaler = analyse.lignes.filter((l) => l.statut !== 'PRETE');

  return (
    <div className="space-y-5">
      {!rapport && (
        <p className="rounded-lg border border-surface-border bg-surface-container-low px-4 py-3 text-body-sm text-text-secondary">
          Rien n&apos;a encore été enregistré. Vérifiez le bilan ci-dessous, puis confirmez.
        </p>
      )}

      <div
        className={`grid grid-cols-1 gap-3 ${detecteDoublons ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
      >
        <Compteur
          valeur={rapport ? rapport.succes : decompte.pretes}
          libelle={rapport ? 'enregistrées' : 'prêtes à enregistrer'}
          ton="success"
          Icone={CheckCircle2}
        />
        {detecteDoublons && (
          <Compteur
            valeur={rapport ? (rapport.doublons ?? 0) : decompte.doublons}
            libelle="déjà présentes, ignorées"
            ton="neutral"
            Icone={CopyMinus}
          />
        )}
        <Compteur
          valeur={rapport ? rapport.echecs : decompte.refusees}
          libelle="refusées"
          ton="error"
          Icone={XCircle}
        />
      </div>

      {aSignaler.length > 0 && (
        <div className="rounded-lg border border-surface-border">
          <p className="border-b border-surface-border px-4 py-3 text-body-md font-medium text-text-primary">
            Lignes non enregistrées
          </p>
          <ul className="divide-y divide-surface-border">
            {aSignaler.map((l) => (
              <li key={l.ligne} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2">
                <Badge shape="pill" variant={l.statut === 'DOUBLON' ? 'neutral' : 'error'}>
                  {l.statut === 'DOUBLON' ? 'Déjà présente' : 'Refusée'}
                </Badge>
                <span className="text-body-sm font-medium text-text-primary">
                  Ligne {l.ligne} — {l.libelle}
                </span>
                <span className="text-body-sm text-text-secondary">{l.motif}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rapport && rapport.details.some((d) => !d.ok) && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-4">
          <p className="mb-2 text-body-md font-medium text-error">
            Échecs survenus pendant l&apos;enregistrement
          </p>
          <ul className="space-y-1 text-body-sm text-text-secondary">
            {rapport.details
              .filter((d) => !d.ok)
              .map((d) => (
                <li key={d.ligne}>
                  Ligne {d.ligne} — {d.message}
                </li>
              ))}
          </ul>
        </div>
      )}

      {!rapport && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {!confirmable && (
            <p className="text-body-sm text-text-secondary">
              Aucune ligne à enregistrer : tout est déjà présent ou refusé.
            </p>
          )}
          <Button onClick={onConfirmer} disabled={enCours || !confirmable}>
            {enCours
              ? 'Enregistrement en cours…'
              : `Enregistrer ${decompte.pretes} ligne${decompte.pretes > 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </div>
  );
}
