'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const TOUTES = 'TOUTES';

export function TarifsFiltres({
  annees,
  classes,
  defaultAnneeScolaireId,
  defaultClasseId,
}: {
  annees: { id: string; libelle: string }[];
  classes: { id: string; nom: string }[];
  defaultAnneeScolaireId: string;
  defaultClasseId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navigate(next: { anneeScolaireId: string; classeId: string }) {
    const params = new URLSearchParams();
    if (next.anneeScolaireId) params.set('anneeScolaireId', next.anneeScolaireId);
    if (next.classeId && next.classeId !== TOUTES) params.set('classeId', next.classeId);
    startTransition(() => {
      router.push(`/etablissement/finances/tarifs?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <span className="text-label-md uppercase text-text-secondary">Année scolaire</span>
        <Select
          value={defaultAnneeScolaireId}
          onValueChange={(v) => navigate({ anneeScolaireId: v, classeId: '' })}
        >
          <SelectTrigger className="h-10 w-full md:h-8 md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {annees.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.libelle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <span className="text-label-md uppercase text-text-secondary">Classe</span>
        <Select
          value={defaultClasseId || TOUTES}
          onValueChange={(v) => navigate({ anneeScolaireId: defaultAnneeScolaireId, classeId: v })}
          disabled={classes.length === 0}
        >
          <SelectTrigger className="h-10 w-full md:h-8 md:w-48">
            <SelectValue placeholder="Toutes les classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TOUTES}>Toutes les classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
