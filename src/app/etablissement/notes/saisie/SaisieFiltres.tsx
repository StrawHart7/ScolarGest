'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { Periode } from '@/services/evaluation';

const PERIODES: { value: Periode; label: string }[] = [
  { value: 'TRIMESTRE_1', label: '1er trimestre' },
  { value: 'TRIMESTRE_2', label: '2e trimestre' },
  { value: 'TRIMESTRE_3', label: '3e trimestre' },
];

export function SaisieFiltres({
  classes,
  matieres,
  defaultClasseId,
  defaultMatiereId,
  defaultPeriode,
}: {
  classes: { id: string; nom: string }[];
  matieres: { id: string; nom: string }[];
  defaultClasseId: string;
  defaultMatiereId: string;
  defaultPeriode: Periode;
}) {
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
            {PERIODES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
