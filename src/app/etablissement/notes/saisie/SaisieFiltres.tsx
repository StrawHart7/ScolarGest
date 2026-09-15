'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { Periode } from '@/services/evaluation';
import { usePeriodes } from '@/components/layout/RegimeProvider';

export function SaisieFiltres({
  classes,
  matieres,
  defaultClasseId,
  defaultMatiereId,
  defaultPeriode,
}: {
  /**
   * `cycle` porte le nom du cycle de la classe — « COLLEGE », « LYCEE ».
   *
   * C'est lui qui décide du mot : au lycée d'une école au semestre, la liste
   * offre deux « semestres » ; dans le collège de la **même** école, sur le
   * même écran, trois « trimestres ». Sans lui, un professeur de seconde se
   * verrait proposer un troisième trimestre qui n'existe pas chez lui.
   */
  classes: { id: string; nom: string; cycle?: string | null }[];
  matieres: { id: string; nom: string }[];
  defaultClasseId: string;
  defaultMatiereId: string;
  defaultPeriode: Periode;
}) {
  const cycle = classes.find((c) => c.id === defaultClasseId)?.cycle ?? null;
  const { periodes, nommer } = usePeriodes(cycle);
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navigate(next: { classeId: string; matiereId: string; periode: Periode }) {
    const params = new URLSearchParams();
    if (next.classeId) params.set('classeId', next.classeId);
    if (next.matiereId) params.set('matiereId', next.matiereId);
    params.set('periode', next.periode);
    startTransition(() => {
      router.push(`/etablissement/notes/saisie?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-label-md uppercase text-text-secondary">Classe</span>
        <Select
          value={defaultClasseId}
          onValueChange={(v) => navigate({ classeId: v, matiereId: '', periode: defaultPeriode })}
          disabled={classes.length === 0}
        >
          <SelectTrigger className="h-8 w-48">
            <SelectValue placeholder="Sélectionner..." />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-label-md uppercase text-text-secondary">Matière</span>
        <Select
          value={defaultMatiereId}
          onValueChange={(v) => navigate({ classeId: defaultClasseId, matiereId: v, periode: defaultPeriode })}
          disabled={matieres.length === 0}
        >
          <SelectTrigger className="h-8 w-48">
            <SelectValue placeholder="Sélectionner..." />
          </SelectTrigger>
          <SelectContent>
            {matieres.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-label-md uppercase text-text-secondary">Période</span>
        <Select
          value={defaultPeriode}
          onValueChange={(v) =>
            navigate({ classeId: defaultClasseId, matiereId: defaultMatiereId, periode: v as Periode })
          }
        >
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodes.map((p) => (
              <SelectItem key={p} value={p}>
                {nommer(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
