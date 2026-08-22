'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const TOUS = 'TOUS';

const STATUTS = [
  { value: 'PAYE', label: 'Payé' },
  { value: 'PARTIEL', label: 'Partiel' },
  { value: 'IMPAYE', label: 'Impayé' },
  { value: 'ANNULE', label: 'Annulé' },
];

export function SuiviFiltres({
  annees,
  classes,
  defaultAnneeScolaireId,
  defaultClasseId,
  defaultStatut,
}: {
  annees: { id: string; libelle: string }[];
  classes: { id: string; nom: string }[];
  defaultAnneeScolaireId: string;
  defaultClasseId: string;
  defaultStatut: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navigate(next: { anneeScolaireId: string; classeId: string; statut: string }) {
    const params = new URLSearchParams();
    if (next.anneeScolaireId) params.set('anneeScolaireId', next.anneeScolaireId);
    if (next.classeId && next.classeId !== TOUS) params.set('classeId', next.classeId);
    if (next.statut && next.statut !== TOUS) params.set('statut', next.statut);
    startTransition(() => {
      router.push(`/etablissement/finances/factures?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <span className="text-label-md uppercase text-text-secondary">Année scolaire</span>
        <Select
          value={defaultAnneeScolaireId}
          onValueChange={(v) =>
            navigate({ anneeScolaireId: v, classeId: '', statut: defaultStatut })
          }
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
          value={defaultClasseId || TOUS}
          onValueChange={(v) =>
            navigate({
              anneeScolaireId: defaultAnneeScolaireId,
              classeId: v,
              statut: defaultStatut,
            })
          }
          disabled={classes.length === 0}
        >
          <SelectTrigger className="h-10 w-full md:h-8 md:w-48">
            <SelectValue placeholder="Toutes les classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TOUS}>Toutes les classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <span className="text-label-md uppercase text-text-secondary">Statut</span>
        <Select
          value={defaultStatut || TOUS}
          onValueChange={(v) =>
            navigate({
              anneeScolaireId: defaultAnneeScolaireId,
              classeId: defaultClasseId,
              statut: v,
            })
          }
        >
          <SelectTrigger className="h-10 w-full md:h-8 md:w-40">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TOUS}>Tous les statuts</SelectItem>
            {STATUTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
