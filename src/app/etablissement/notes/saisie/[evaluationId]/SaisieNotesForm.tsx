'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Info, Lock, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Eleve } from '@/services/eleve';
import type { Note } from '@/services/note';
import { saisirNoteAction, soumettreNotesAction } from './actions';

interface RowState {
  valeur: string;
  observation: string;
  dirty: boolean;
}

function buildInitialRows(eleves: Eleve[], notes: Note[]): Record<string, RowState> {
  const byEleve = new Map(notes.map((n) => [n.eleveId, n]));
  const rows: Record<string, RowState> = {};
  for (const eleve of eleves) {
    const note = byEleve.get(eleve.id);
    rows[eleve.id] = {
      valeur: note?.valeur !== null && note?.valeur !== undefined ? String(note.valeur) : '',
      observation: note?.observation ?? '',
      dirty: false,
    };
  }
  return rows;
}

export function SaisieNotesForm({
  evaluationId,
  eleves,
  notes,
  verrouille,
}: {
  evaluationId: string;
  eleves: Eleve[];
  notes: Note[];
  verrouille: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowState>>(() => buildInitialRows(eleves, notes));
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasDirty = useMemo(() => Object.values(rows).some((r) => r.dirty), [rows]);

  function updateValeur(eleveId: string, valeur: string) {
    setRows((prev) => ({
      ...prev,
      [eleveId]: { valeur, observation: prev[eleveId]?.observation ?? '', dirty: true },
    }));
  }

  function updateObservation(eleveId: string, observation: string) {
    setRows((prev) => ({
      ...prev,
      [eleveId]: { valeur: prev[eleveId]?.valeur ?? '', observation, dirty: true },
    }));
  }

  function enregistrerBrouillon() {
    setError(null);
    const aEnvoyer = eleves.filter((e) => rows[e.id]?.dirty && rows[e.id]?.valeur !== '');
    if (aEnvoyer.length === 0) return;

    startTransition(async () => {
      for (const eleve of aEnvoyer) {
        const row = rows[eleve.id] ?? { valeur: '', observation: '', dirty: false };
        const valeurNum = Number(row.valeur.replace(',', '.'));
        if (Number.isNaN(valeurNum)) {
          setError(`Note invalide pour ${eleve.nom} ${eleve.prenoms}`);
          continue;
        }
        const result = await saisirNoteAction({
          evaluationId,
          eleveId: eleve.id,
          valeur: valeurNum,
          observation: row.observation || undefined,
        });
        if (result) {
          setError(result);
          return;
        }
      }
      setRows((prev) => {
        const next = { ...prev };
        for (const eleve of aEnvoyer) {
          const current = next[eleve.id];
          if (current) next[eleve.id] = { ...current, dirty: false };
        }
        return next;
      });
      setLastSaved(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
      router.refresh();
    });
  }

  function soumettre() {
    if (
      !window.confirm(
        'Soumettre ces notes verrouille définitivement la saisie (toute correction ultérieure passera par une demande de modification approuvée par la secrétaire avec PIN). Confirmer la soumission ?',
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await soumettreNotesAction(evaluationId);
      if (result) {
        setError(result);
        return;
      }
      router.refresh();
    });
  }

  if (verrouille) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-4 rounded-lg border border-surface-border bg-surface-container-low p-4">
          <Lock className="mt-0.5 h-5 w-5 text-text-secondary" aria-hidden />
          <div>
            <h3 className="text-headline-sm text-text-primary">Les notes sont verrouillées</h3>
            <p className="text-body-sm text-text-secondary">
              Ces notes ont déjà été soumises. Pour toute correction, utilisez la demande de
              modification (traitée par la secrétaire avec PIN).
            </p>
          </div>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="h-row-standard border-b border-surface-border bg-surface-container-low">
                  <th className="border-r border-surface-border px-4 py-2 text-label-md uppercase text-text-secondary">
                    Élève
                  </th>
                  <th className="border-r border-surface-border px-4 py-2 text-center text-label-md uppercase text-text-secondary">
                    Note
                  </th>
                  <th className="px-4 py-2 text-label-md uppercase text-text-secondary">Observation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-body-sm text-text-primary">
                {eleves.map((eleve) => {
                  const row = rows[eleve.id] ?? { valeur: '', observation: '', dirty: false };
                  return (
                    <tr key={eleve.id} className="h-row-dense hover:bg-surface-container-low/50">
                      <td className="border-r border-surface-border px-4 py-2 font-medium">
                        {eleve.nom} {eleve.prenoms}
                      </td>
                      <td className="border-r border-surface-border px-4 py-2 text-center font-mono text-data-mono text-text-secondary">
                        {row.valeur || '—'}
                      </td>
                      <td className="px-4 py-2 italic text-text-secondary">{row.observation || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-border bg-surface p-4">
        <div className="flex items-center gap-2 text-text-secondary">
          <Info className="h-4 w-4" aria-hidden />
          <span className="text-body-sm">Note maximale : 20. Les cellules vides ne seront pas calculées.</span>
        </div>
        <Badge variant="neutral" shape="pill">
          Brouillon
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-surface-border bg-surface-container">
              <th className="sticky left-0 z-10 w-52 bg-surface-container px-4 py-3 text-label-md text-text-secondary">
                Nom &amp; Prénoms
              </th>
              <th className="border-l border-surface-border px-3 py-3 text-center text-label-md text-primary-container">
                Note / 20
              </th>
              <th className="border-l border-surface-border px-3 py-3 text-left text-label-md text-text-secondary">
                Observation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border text-body-sm">
            {eleves.map((eleve) => {
              const row = rows[eleve.id] ?? { valeur: '', observation: '', dirty: false };
              return (
                <tr key={eleve.id} className="group h-row-dense transition-colors hover:bg-surface-container-low">
                  <td className="sticky left-0 z-10 bg-surface-container-lowest px-4 py-2 font-medium text-text-primary group-hover:bg-surface-container-low">
                    {eleve.nom} {eleve.prenoms}
                  </td>
                  <td className="border-l border-surface-border px-2 py-1 text-center">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step={0.25}
                      value={row.valeur}
                      onChange={(e) => updateValeur(eleve.id, e.target.value)}
                      placeholder="--"
                      className="h-8 w-20 rounded border border-transparent bg-transparent px-1 text-center font-mono text-data-mono text-text-primary transition-all hover:border-outline focus:border-primary-container focus:bg-surface-bright focus:outline-none"
                    />
                  </td>
                  <td className="border-l border-surface-border px-2 py-1">
                    <input
                      type="text"
                      value={row.observation}
                      onChange={(e) => updateObservation(eleve.id, e.target.value)}
                      placeholder="Observation (facultatif)"
                      className="h-8 w-full rounded border border-transparent bg-transparent px-2 text-body-sm text-text-primary transition-all hover:border-outline focus:border-primary-container focus:bg-surface-bright focus:outline-none"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="px-4 pt-3 text-body-sm text-error">{error}</p>}

      <div className="sticky bottom-0 flex items-center justify-end gap-4 border-t border-surface-border bg-surface-container-lowest p-4">
        {lastSaved && (
          <span className="mr-auto text-label-md text-text-secondary">Dernière sauvegarde : {lastSaved}</span>
        )}
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !hasDirty}
          onClick={enregistrerBrouillon}
          className="gap-2"
        >
          <Save className="h-4 w-4" aria-hidden />
          Enregistrer (brouillon)
        </Button>
        <Button type="button" disabled={pending} onClick={soumettre} className="gap-2">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Soumettre
        </Button>
      </div>
    </Card>
  );
}
