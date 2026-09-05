'use client';

import { useState, useTransition } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApercuImport } from '@/components/import/ApercuImport';
import { ELEVE_IMPORT_COLUMNS } from '@/lib/import/eleve-import-schema';
import type { AnalyseImport } from '@/lib/import/analyse';
import {
  analyserFichierEleves,
  confirmerImportEleves,
  type ImportActionResult,
} from './actions';

/**
 * Import des élèves en deux temps : analyser, relire le bilan, confirmer.
 *
 * Le fichier reste **côté navigateur** entre les deux temps et il est renvoyé
 * à la confirmation. Rien n'est stocké en attente : pas de fichier temporaire à
 * expirer, pas d'analyse en session à réconcilier. Le serveur relit et
 * réanalyse au moment d'écrire, ce qui interdit de lui renvoyer une décision
 * fabriquée.
 */
export function ImportForm({ anneeScolaireId }: { anneeScolaireId: string }) {
  const [pending, startTransition] = useTransition();
  const [fichier, setFichier] = useState<File | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseImport | null>(null);
  const [resultat, setResultat] = useState<ImportActionResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function formDataAvecFichier(): FormData | null {
    if (!fichier) return null;
    const formData = new FormData();
    formData.set('fichier', fichier);
    formData.set('anneeScolaireId', anneeScolaireId);
    return formData;
  }

  function analyser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = formDataAvecFichier();
    if (!formData) {
      setMessage('Aucun fichier sélectionné');
      return;
    }
    setMessage(null);
    setResultat(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof analyserFichierEleves>> | undefined;
      try {
        res = await analyserFichierEleves(formData);
      } catch {
        res = undefined;
      }
      if (!res) {
        setMessage('Connexion interrompue. Votre fichier est conservé, réessayez.');
        return;
      }
      if (!res.ok || !res.analyse) {
        setMessage(res.message ?? "Analyse impossible");
        setAnalyse(null);
        return;
      }
      setAnalyse(res.analyse);
    });
  }

  function confirmer() {
    const formData = formDataAvecFichier();
    if (!formData) return;
    setMessage(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof confirmerImportEleves>> | undefined;
      try {
        res = await confirmerImportEleves(formData);
      } catch {
        res = undefined;
      }
      if (!res) {
        setMessage(
          'Connexion interrompue. Rien ne garantit que l’enregistrement a eu lieu : relancez l’analyse pour voir l’état réel avant de réessayer.',
        );
        return;
      }
      if (!res.ok) {
        setMessage(res.message ?? "Enregistrement impossible");
        return;
      }
      setResultat(res);
      if (res.analyse) setAnalyse(res.analyse);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-surface-border bg-surface-container-low p-4">
        <p className="mb-2 text-body-md font-medium text-text-primary">Gabarit de colonnes attendu</p>
        <p className="text-body-sm text-text-secondary">
          La première ligne du fichier Excel doit reprendre ces en-têtes. L&apos;ordre et la casse
          n&apos;ont pas d&apos;importance.
        </p>
        <code
          className="mt-2 block overflow-x-auto rounded bg-surface-container-lowest p-2 text-body-sm"
          data-mono
        >
          {ELEVE_IMPORT_COLUMNS.join(' | ')}
        </code>
      </div>

      <form onSubmit={analyser} className="flex flex-col gap-4">
        {/* Un champ de fichier natif porte le bouton du systeme et le nom du
            fichier, donc une largeur minimale intrinseque que le navigateur
            refuse de reduire : dans une rangee flex il ne retrecit pas, et il
            poussait la page a 395px dans un ecran de 390 — les 5px de
            debordement des trois ecrans d'import releves le 2026-09-04. C'est
            le seul champ non stylable du produit ; faute de pouvoir le
            remplacer, `min-w-0` l'autorise a se comprimer. */}
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-surface-border p-4">
          <UploadCloud className="h-6 w-6 shrink-0 text-text-secondary" aria-hidden />
          <input
            type="file"
            name="fichier"
            accept=".xlsx,.xls"
            required
            className="min-w-0 flex-1 text-body-sm text-text-primary"
            onChange={(e) => {
              setFichier(e.target.files?.[0] ?? null);
              setAnalyse(null);
              setResultat(null);
              setMessage(null);
            }}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || !fichier}>
            {pending && !analyse ? 'Analyse en cours…' : 'Analyser le fichier'}
          </Button>
        </div>
      </form>

      {message && <p className="text-body-sm text-error">{message}</p>}

      {analyse && (
        <ApercuImport
          analyse={analyse}
          rapport={resultat?.rapport}
          domaine="eleves"
          fichier={fichier}
          detecteDoublons
          onConfirmer={confirmer}
          enCours={pending}
        />
      )}
    </div>
  );
}
