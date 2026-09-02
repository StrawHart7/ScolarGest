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

export function BulletinsFiltres({
  annees,
  classes,
  defaultAnneeScolaireId,
  defaultClasseId,
  defaultPeriode,
  basePath = '/etablissement/notes/bulletins',
}: {
  annees: { id: string; libelle: string }[];
  classes: { id: string; nom: string }[];
  defaultAnneeScolaireId: string;
  defaultClasseId: string;
  defaultPeriode: Periode;
  /**
   * La même barre de filtres sert l'écran de génération et celui des bulletins
   * prêts : les deux se lisent avec les mêmes trois sélecteurs, et
   * dupliquer le composant les ferait diverger à la première évolution.
   */
  basePath?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navigate(next: { anneeScolaireId: string; classeId: string; periode: Periode }) {
    const params = new URLSearchParams();
    if (next.anneeScolaireId) params.set('anneeScolaireId', next.anneeScolaireId);
    if (next.classeId) params.set('classeId', next.classeId);
    params.set('periode', next.periode);
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-label-md uppercase text-text-secondary">Année scolaire</span>
        <Select
          value={defaultAnneeScolaireId}
          onValueChange={(v) => navigate({ anneeScolaireId: v, classeId: '', periode: defaultPeriode })}
        >
          <SelectTrigger className="h-8 w-48">
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

      <div className="flex items-center gap-2">
        <span className="text-label-md uppercase text-text-secondary">Classe</span>
        <Select
          value={defaultClasseId}
          onValueChange={(v) =>
            navigate({ anneeScolaireId: defaultAnneeScolaireId, classeId: v, periode: defaultPeriode })
          }
          disabled={classes.length === 0}
        >
          <SelectTrigger className="h-8 w-48">
            <SelectValue placeholder="Sélectionner une classe" />
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
        <span className="text-label-md uppercase text-text-secondary">Trimestre</span>
        <Select
          value={defaultPeriode}
          onValueChange={(v) =>
            navigate({
              anneeScolaireId: defaultAnneeScolaireId,
              classeId: defaultClasseId,
              periode: v as Periode,
            })
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
