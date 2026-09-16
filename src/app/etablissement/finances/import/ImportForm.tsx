'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ApercuImport } from '@/components/import/ApercuImport';
import { PreparerFichier } from '@/components/import/PreparerFichier';
import { ZoneDepot } from '@/components/import/ZoneDepot';
import type { AnalyseImport } from '@/lib/import/analyse';
import {
  analyserFichierPaiements,
  confirmerImportPaiements,
  type ImportActionResult,
} from './actions';

/**
 * Import des versements en deux temps : analyser, relire le bilan, confirmer.
 *
 * Le fichier reste **côté navigateur** entre les deux temps et il est renvoyé
 * à la confirmation. Rien n'est stocké en attente : pas de fichier temporaire à
 * expirer, pas d'analyse en session à réconcilier. Le serveur relit et
 * réanalyse au moment d'écrire, ce qui interdit de lui renvoyer une décision
 * fabriquée.
 */
export function ImportPaiementsForm({ anneeScolaireId }: { anneeScolaireId: string }) {
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
      let res: Awaited<ReturnType<typeof analyserFichierPaiements>> | undefined;
      try {
        res = await analyserFichierPaiements(formData);
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
      let res: Awaited<ReturnType<typeof confirmerImportPaiements>> | undefined;
      try {
        res = await confirmerImportPaiements(formData);
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
      <form onSubmit={analyser} className="flex flex-col gap-4">
        <ZoneDepot
          fichier={fichier}
          desactive={pending}
          onChoisir={(choisi) => {
            setFichier(choisi);
            setAnalyse(null);
            setResultat(null);
            setMessage(null);
          }}
        />
        {fichier && !analyse && (
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? 'Analyse en cours…' : 'Analyser le fichier'}
            </Button>
          </div>
        )}
      </form>

      {message && <p className="text-body-sm text-error">{message}</p>}

      {/* Le mode d'emploi vient après la zone de dépôt, et disparaît une fois
          le bilan affiché : il a servi, et il repousserait le résultat hors
          de l'écran. */}
      {!analyse && <PreparerFichier domaine="paiements" />}

      {analyse && (
        <ApercuImport
          analyse={analyse}
          rapport={resultat?.rapport}
          domaine="paiements"
          fichier={fichier}
          onConfirmer={confirmer}
          enCours={pending}
        />
      )}
    </div>
  );
}
