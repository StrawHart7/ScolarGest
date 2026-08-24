'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, Info, Lock, Save, TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Eleve } from '@/services/eleve';
import type { Note, StatutNote } from '@/services/note';
import { saisirNoteAction, soumettreNotesAction, demanderModificationAction } from './actions';

const STATUT_BADGE: Partial<
  Record<StatutNote, { label: string; variant: 'neutral' | 'warning' | 'success' | 'error' }>
> = {
  SOUMISE: { label: 'En attente de validation', variant: 'warning' },
  VALIDE: { label: 'Validée', variant: 'success' },
  EN_ATTENTE: { label: 'Modification en attente', variant: 'warning' },
  REJETE: { label: 'Modification rejetée', variant: 'error' },
};

function DemandeModificationForm({
  noteId,
  evaluationId,
  valeurActuelle,
  onDone,
}: {
  noteId: string;
  evaluationId: string;
  valeurActuelle: number | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [nouvelleValeur, setNouvelleValeur] = useState(valeurActuelle !== null ? String(valeurActuelle) : '');
  const [observation, setObservation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmer() {
    const valeurNum = Number(nouvelleValeur.replace(',', '.'));
    if (Number.isNaN(valeurNum) || valeurNum < 0 || valeurNum > 20) {
      setError('La note doit être comprise entre 0 et 20.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await demanderModificationAction({
        noteId,
        evaluationId,
        nouvelleValeur: valeurNum,
        observation: observation || undefined,
      });
      if (result) {
        setError(result);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-surface-border bg-surface-container-low p-2">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          step={0.25}
          value={nouvelleValeur}
          onChange={(e) => setNouvelleValeur(e.target.value)}
          className="h-8 w-20"
          placeholder="Nouvelle note"
        />
        <Input
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          className="h-8 flex-1"
          placeholder="Motif de la correction"
        />
      </div>
      {error && <p className="text-body-sm text-error">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={confirmer}>
          {pending ? 'Envoi...' : 'Envoyer la demande'}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onDone}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

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
  const [modificationOuverte, setModificationOuverte] = useState<string | null>(null);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);

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

  function confirmerSoumission() {
    setError(null);
    startTransition(async () => {
      const result = await soumettreNotesAction(evaluationId);
      if (result) {
        setError(result);
        return;
      }
      setConfirmationOuverte(false);
      router.refresh();
    });
  }

  if (verrouille) {
    const noteParEleve = new Map(notes.map((n) => [n.eleveId, n]));
    const toutesSoumises = notes.length > 0 && notes.every((n) => n.statut === 'SOUMISE');

    return (
      <div className="space-y-4">
        <div className="flex items-start gap-4 rounded-lg border border-surface-border bg-surface-container-low p-4">
          {toutesSoumises ? (
            <Clock className="mt-0.5 h-5 w-5 text-text-secondary" aria-hidden />
          ) : (
            <Lock className="mt-0.5 h-5 w-5 text-text-secondary" aria-hidden />
          )}
          <div>
            <h3 className="text-headline-sm text-text-primary">
              {toutesSoumises ? 'En attente de validation' : 'Les notes sont verrouillées'}
            </h3>
            <p className="text-body-sm text-text-secondary">
              {toutesSoumises
                ? "Ces notes ont été soumises et attendent la validation de la secrétaire. Elles ne comptent pas encore dans les moyennes."
                : 'Ces notes sont validées. Pour toute correction, utilisez « Demander une modification » (traitée par la secrétaire avec PIN).'}
            </p>
          </div>
        </div>

        <Card>
          <div className="hidden min-w-0 overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="h-row-standard border-b border-surface-border bg-surface-container-low">
                  <th className="border-r border-surface-border px-4 py-2 text-label-md uppercase text-text-secondary">
                    Élève
                  </th>
                  <th className="border-r border-surface-border px-4 py-2 text-center text-label-md uppercase text-text-secondary">
                    Note
                  </th>
                  <th className="border-r border-surface-border px-4 py-2 text-label-md uppercase text-text-secondary">
                    Statut
                  </th>
                  <th className="px-4 py-2 text-right text-label-md uppercase text-text-secondary">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-body-sm text-text-primary">
                {eleves.map((eleve) => {
                  const note = noteParEleve.get(eleve.id);
                  const badge = note ? STATUT_BADGE[note.statut] : undefined;
                  const enModification = modificationOuverte === note?.id;
                  return (
                    <tr key={eleve.id} className="hover:bg-surface-container-low/50">
                      <td className="border-r border-surface-border px-4 py-2 font-medium">
                        {eleve.nom} {eleve.prenoms}
                      </td>
                      <td className="border-r border-surface-border px-4 py-2 text-center font-mono text-data-mono text-text-secondary">
                        {note?.valeur ?? '—'}
                        {note?.statut === 'EN_ATTENTE' && note.valeurProposee !== null && (
                          <span className="ml-1 text-primary-container">→ {note.valeurProposee}</span>
                        )}
                      </td>
                      <td className="border-r border-surface-border px-4 py-2">
                        {badge && (
                          <Badge variant={badge.variant} shape="pill">
                            {badge.label}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {note?.statut === 'VALIDE' && !enModification && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setModificationOuverte(note.id)}
                          >
                            Demander une modification
                          </Button>
                        )}
                        {enModification && note && (
                          <DemandeModificationForm
                            noteId={note.id}
                            evaluationId={evaluationId}
                            valeurActuelle={note.valeur}
                            onDone={() => setModificationOuverte(null)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-surface-border md:hidden">
            {eleves.map((eleve) => {
              const note = noteParEleve.get(eleve.id);
              const badge = note ? STATUT_BADGE[note.statut] : undefined;
              const enModification = modificationOuverte === note?.id;
              return (
                <div key={eleve.id} className="flex flex-col gap-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-text-primary">
                      {eleve.nom} {eleve.prenoms}
                    </span>
                    {badge && (
                      <Badge variant={badge.variant} shape="pill">
                        {badge.label}
                      </Badge>
                    )}
                  </div>
                  <div className="font-mono text-data-mono text-text-secondary">
                    {note?.valeur ?? '—'}
                    {note?.statut === 'EN_ATTENTE' && note.valeurProposee !== null && (
                      <span className="ml-1 text-primary-container">→ {note.valeurProposee}</span>
                    )}
                  </div>
                  {note?.statut === 'VALIDE' && !enModification && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="self-start"
                      onClick={() => setModificationOuverte(note.id)}
                    >
                      Demander une modification
                    </Button>
                  )}
                  {enModification && note && (
                    <DemandeModificationForm
                      noteId={note.id}
                      evaluationId={evaluationId}
                      valeurActuelle={note.valeur}
                      onDone={() => setModificationOuverte(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  const motifRejet = notes.find((n) => n.motifRejetSoumission)?.motifRejetSoumission ?? null;

  return (
    <Card className="flex flex-col overflow-hidden">
      {motifRejet && (
        <div className="flex items-start gap-3 border-b border-surface-border bg-error/5 p-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-error" aria-hidden />
          <div>
            <h3 className="text-headline-sm text-text-primary">Soumission rejetée</h3>
            <p className="text-body-sm text-text-secondary">
              La secrétaire a renvoyé cette évaluation pour correction : « {motifRejet} ». Corrigez les
              notes puis soumettez à nouveau.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-border bg-surface p-4">
        <div className="flex items-center gap-2 text-text-secondary">
          <Info className="h-4 w-4" aria-hidden />
          <span className="text-body-sm">Note maximale : 20. Les cellules vides ne seront pas calculées.</span>
        </div>
        <Badge variant="neutral" shape="pill">
          Brouillon
        </Badge>
      </div>

      <div className="hidden min-w-0 overflow-x-auto md:block">
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
                      inputMode="numeric"
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

      <div className="divide-y divide-surface-border md:hidden">
        {eleves.map((eleve) => {
          const row = rows[eleve.id] ?? { valeur: '', observation: '', dirty: false };
          return (
            <div key={eleve.id} className="flex flex-col gap-2 p-3">
              <span className="font-medium text-text-primary">
                {eleve.nom} {eleve.prenoms}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  step={0.25}
                  value={row.valeur}
                  onChange={(e) => updateValeur(eleve.id, e.target.value)}
                  placeholder="--/20"
                  className="h-9 w-20 shrink-0 rounded border border-surface-border bg-surface px-2 text-center font-mono text-data-mono text-text-primary focus:border-primary-container focus:outline-none"
                />
                <input
                  type="text"
                  value={row.observation}
                  onChange={(e) => updateObservation(eleve.id, e.target.value)}
                  placeholder="Observation (facultatif)"
                  className="h-9 flex-1 rounded border border-surface-border bg-surface px-2 text-body-sm text-text-primary focus:border-primary-container focus:outline-none"
                />
              </div>
            </div>
          );
        })}
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
        <Button
          type="button"
          disabled={pending}
          onClick={() => setConfirmationOuverte(true)}
          className="gap-2"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Soumettre
        </Button>
      </div>

      {confirmationOuverte && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface-container-lowest p-6 shadow-lg">
            <h2 className="text-headline-md text-text-primary">Confirmer la soumission</h2>
            <p className="mt-2 text-body-sm text-text-secondary">
              Soumettre ces notes verrouille la saisie et les envoie à la secrétaire pour
              validation : elles ne compteront dans les moyennes qu&apos;une fois validées.
            </p>
            {error && <p className="mt-3 text-body-sm text-error">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setConfirmationOuverte(false)}
              >
                Annuler
              </Button>
              <Button type="button" disabled={pending} onClick={confirmerSoumission}>
                {pending ? 'Envoi...' : 'Confirmer la soumission'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
