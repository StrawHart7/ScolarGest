'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { AnneeScolaire } from '@/services/annee-scolaire';
import type { DecisionProposee } from '@/services/passage-annee';
import type { Classe } from '@/services/classe';
import { validerPassageCohorteAction, type ValiderPassageResult } from './actions';

type Decision = 'ADMIS' | 'REDOUBLANT' | 'DEPART';

export function PassageCohorteForm({
  anneeSourceId,
  autresAnnees,
  anneeCibleId,
  decisions,
  classesCibles,
}: {
  anneeSourceId: string;
  autresAnnees: AnneeScolaire[];
  anneeCibleId?: string;
  decisions: DecisionProposee[];
  classesCibles: Classe[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ValiderPassageResult | null>(null);
  const [rows, setRows] = useState<Record<string, { decision: Decision; classeCibleId?: string }>>(
    Object.fromEntries(decisions.map((d) => [d.eleveId, { decision: d.decisionProposee }])),
  );

  function updateRow(eleveId: string, patch: Partial<{ decision: Decision; classeCibleId?: string }>) {
    setRows((prev) => ({
      ...prev,
      [eleveId]: {
        decision: patch.decision ?? prev[eleveId]?.decision ?? 'DEPART',
        classeCibleId: patch.classeCibleId ?? prev[eleveId]?.classeCibleId,
      },
    }));
  }

  function changeAnneeCible(id: string) {
    const params = new URLSearchParams({ anneeSourceId, anneeCibleId: id });
    router.push(`/etablissement/eleves/passage?${params.toString()}`);
  }

  function submit() {
    if (!anneeCibleId) {
      setResult({ ok: false, message: 'Sélectionnez une année cible avant de valider.' });
      return;
    }
    const payload = {
      anneeCibleId,
      decisions: decisions.map((d) => ({
        eleveId: d.eleveId,
        inscriptionSourceId: d.inscriptionId,
        decision: rows[d.eleveId]?.decision ?? d.decisionProposee,
        classeCibleId: rows[d.eleveId]?.classeCibleId,
      })),
    };
    startTransition(async () => {
      const res = await validerPassageCohorteAction(payload);
      setResult(res);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-label-md uppercase text-text-secondary">Année cible</span>
        <Select value={anneeCibleId ?? ''} onValueChange={changeAnneeCible}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choisir l'année cible" />
          </SelectTrigger>
          <SelectContent>
            {autresAnnees.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.libelle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {decisions.length === 0 ? (
        <p className="text-body-sm text-text-secondary">Aucune inscription active à traiter.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Élève</TableHead>
              <TableHead>Classe actuelle</TableHead>
              <TableHead>Décision</TableHead>
              <TableHead>Classe cible</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {decisions.map((d) => {
              const row = rows[d.eleveId];
              const needsClasse = row?.decision === 'ADMIS' || row?.decision === 'REDOUBLANT';
              return (
                <TableRow key={d.eleveId}>
                  <TableCell className="font-medium">
                    {d.eleveNom} {d.elevePrenoms}
                  </TableCell>
                  <TableCell>{d.classeNom}</TableCell>
                  <TableCell>
                    <Select
                      value={row?.decision ?? d.decisionProposee}
                      onValueChange={(v) => updateRow(d.eleveId, { decision: v as Decision })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIS">Admis</SelectItem>
                        <SelectItem value="REDOUBLANT">Redoublant</SelectItem>
                        <SelectItem value="DEPART">Départ</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {needsClasse ? (
                      <Select
                        value={row?.classeCibleId ?? ''}
                        onValueChange={(v) => updateRow(d.eleveId, { classeCibleId: v })}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Choisir une classe" />
                        </SelectTrigger>
                        <SelectContent>
                          {classesCibles.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {result?.message && <p className="text-body-sm text-error">{result.message}</p>}

      {result?.resultats && (
        <div className="rounded-lg border border-surface-border p-4">
          <ul className="space-y-1 text-body-sm">
            {result.resultats.map((r) => (
              <li key={r.eleveId} className={r.ok ? 'text-text-primary' : 'text-error'}>
                {r.eleveId}: {r.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {decisions.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={submit} disabled={pending || !anneeCibleId}>
            {pending ? 'Validation...' : 'Valider le passage de cohorte'}
          </Button>
        </div>
      )}
    </div>
  );
}
