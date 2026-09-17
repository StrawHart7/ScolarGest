'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
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
  classesSource,
  classeId,
  decisions,
  classesCibles,
  classesSansTarif,
}: {
  anneeSourceId: string;
  autresAnnees: AnneeScolaire[];
  anneeCibleId?: string;
  classesSource: { id: string; nom: string }[];
  classeId: string;
  decisions: DecisionProposee[];
  classesCibles: Classe[];
  /** Classes de l'année cible sur lesquelles aucun tarif n'est encore posé. */
  classesSansTarif: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ValiderPassageResult | null>(null);
  const [rows, setRows] = useState<Record<string, { decision: Decision; classeCibleId?: string }>>(
    Object.fromEntries(decisions.map((d) => [d.eleveId, { decision: d.decisionProposee }])),
  );

  const sansTarif = useMemo(() => new Set(classesSansTarif), [classesSansTarif]);

  /**
   * Combien d'élèves partiraient vers une classe sans tarif, et lesquelles.
   *
   * Compté sur les décisions **réellement saisies**, pas sur la liste des
   * classes : avertir « trois classes n'ont pas de tarif » quand aucun élève
   * n'y va serait un cri de plus qu'on apprend à ignorer. Et seuls ADMIS et
   * REDOUBLANT créent une inscription — un départ ne produit aucune facture.
   */
  const { elevesSansTarif, classesViseesSansTarif } = useMemo(() => {
    const visees = new Set<string>();
    let eleves = 0;
    for (const ligne of Object.values(rows)) {
      if (ligne.decision === 'DEPART' || !ligne.classeCibleId) continue;
      if (!sansTarif.has(ligne.classeCibleId)) continue;
      eleves += 1;
      const nom = classesCibles.find((c) => c.id === ligne.classeCibleId)?.nom;
      if (nom) visees.add(nom);
    }
    return { elevesSansTarif: eleves, classesViseesSansTarif: [...visees].sort() };
  }, [rows, sansTarif, classesCibles]);

  function updateRow(eleveId: string, patch: Partial<{ decision: Decision; classeCibleId?: string }>) {
    setRows((prev) => ({
      ...prev,
      [eleveId]: {
        decision: patch.decision ?? prev[eleveId]?.decision ?? 'DEPART',
        classeCibleId: patch.classeCibleId ?? prev[eleveId]?.classeCibleId,
      },
    }));
  }

  function naviguer(modifications: Record<string, string>) {
    const params = new URLSearchParams({ anneeSourceId, classeId, ...modifications });
    if (anneeCibleId && !modifications.anneeCibleId) params.set('anneeCibleId', anneeCibleId);
    router.push(`/etablissement/classes/passage?${params.toString()}`);
  }

  /**
   * Traitement en masse : sur une classe de trente élèves, l'immense majorité
   * des décisions est identique. Les régler une par une était le vrai coût de
   * cet écran.
   */
  function appliquerATous(decision: Decision) {
    setRows((precedent) =>
      Object.fromEntries(
        decisions.map((d) => [
          d.eleveId,
          { decision, classeCibleId: precedent[d.eleveId]?.classeCibleId },
        ]),
      ),
    );
  }

  function appliquerClasseCibleAuxAdmis(classeCibleId: string) {
    setRows((precedent) =>
      Object.fromEntries(
        decisions.map((d) => {
          const courant = precedent[d.eleveId]?.decision ?? d.decisionProposee;
          return [
            d.eleveId,
            {
              decision: courant,
              classeCibleId:
                courant === 'ADMIS' ? classeCibleId : precedent[d.eleveId]?.classeCibleId,
            },
          ];
        }),
      ),
    );
  }

  const compteur = decisions.reduce<Record<Decision, number>>(
    (acc, d) => {
      const decision = rows[d.eleveId]?.decision ?? d.decisionProposee;
      acc[decision] += 1;
      return acc;
    },
    { ADMIS: 0, REDOUBLANT: 0, DEPART: 0 },
  );

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
    <div>
      <div className="flex flex-wrap items-center gap-4 border-b border-surface-border p-4">
        <div className="flex items-center gap-2">
          <span className="text-label-md uppercase text-text-secondary">Classe</span>
          <Select value={classeId} onValueChange={(v) => naviguer({ classeId: v })}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Choisir une classe" />
            </SelectTrigger>
            <SelectContent>
              {classesSource.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-label-md uppercase text-text-secondary">Année cible</span>
          <Select value={anneeCibleId ?? ''} onValueChange={(v) => naviguer({ anneeCibleId: v })}>
            <SelectTrigger className="w-56">
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
      </div>

      {decisions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-surface-border bg-surface-container-low p-4">
          <span className="text-label-md uppercase text-text-secondary">Appliquer à tous</span>
          <Button size="sm" variant="secondary" onClick={() => appliquerATous('ADMIS')}>
            Tous admis
          </Button>
          <Button size="sm" variant="secondary" onClick={() => appliquerATous('REDOUBLANT')}>
            Tous redoublants
          </Button>
          <Button size="sm" variant="secondary" onClick={() => appliquerATous('DEPART')}>
            Tous en départ
          </Button>

          {classesCibles.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-label-md uppercase text-text-secondary">
                Classe des admis
              </span>
              <Select onValueChange={appliquerClasseCibleAuxAdmis}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Affecter en masse" />
                </SelectTrigger>
                <SelectContent>
                  {classesCibles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <span className="ml-auto text-body-sm text-text-secondary">
            {compteur.ADMIS} admis · {compteur.REDOUBLANT} redoublant(s) · {compteur.DEPART} départ(s)
          </span>
        </div>
      )}

      {decisions.length === 0 ? (
        <p className="p-6 text-body-sm text-text-secondary">
          Aucun élève inscrit dans cette classe : il n’y a personne à faire monter.
        </p>
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
                              {/* Dit au moment du choix, pas seulement en
                                  récapitulatif : c'est ici qu'on peut encore
                                  viser une autre classe. */}
                              {sansTarif.has(c.id) ? `${c.nom} — sans tarif` : c.nom}
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

      <div className="space-y-4 p-4">
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

        {/* Avant le bouton, jamais après : une facture émise ne se refait pas,
            et le seul moment utile pour le dire est celui où l'on peut encore
            reculer. On avertit sans bloquer — une école a le droit d'inscrire
            avant d'avoir fixé ses prix. */}
        {elevesSansTarif > 0 && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-body-sm text-warning-on-container">
            <strong>
              {elevesSansTarif} élève(s) iraient vers une classe sans tarif
              {classesViseesSansTarif.length > 0 ? ` (${classesViseesSansTarif.join(', ')})` : ''}.
            </strong>{' '}
            Leur facture serait créée à <strong>0 F, sans aucune ligne</strong>, et le suivi
            financier afficherait « rien à recouvrer » pour eux. Un tarif ne se pose qu&apos;une
            fois et ne réécrit pas les factures déjà émises : posez-les d&apos;abord.{' '}
            {anneeCibleId && (
              <Link
                href={`/etablissement/finances/tarifs?anneeScolaireId=${anneeCibleId}`}
                className="font-medium underline"
              >
                Régler les tarifs de cette année
              </Link>
            )}
          </p>
        )}

        {decisions.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={submit} chargement={pending} disabled={!anneeCibleId}>
              Valider le passage de cette classe
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
