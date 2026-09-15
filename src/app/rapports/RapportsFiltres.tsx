'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { DefinitionRapport, TypeRapport } from '@/services/rapport';

const TOUTES = 'TOUTES';

import { usePeriodes } from '@/components/layout/RegimeProvider';

export function RapportsFiltres({
  rapports,
  annees,
  classes,
  typeCourant,
  anneeScolaireId,
  classeId,
  periode,
  exigeClasse,
  exigePeriode,
}: {
  rapports: DefinitionRapport[];
  annees: { id: string; libelle: string }[];
  classes: { id: string; nom: string }[];
  typeCourant: TypeRapport;
  anneeScolaireId: string;
  classeId: string;
  periode: string;
  exigeClasse: boolean;
  exigePeriode: boolean;
}) {
  // Deux périodes pour un lycée au semestre, trois sinon. Voir `RegimeProvider`.
  const { periodes, nommer } = usePeriodes();
  const router = useRouter();
  const [, startTransition] = useTransition();

  function navigate(next: Partial<Record<string, string>>) {
    const params = new URLSearchParams();
    const valeurs = {
      type: typeCourant,
      anneeScolaireId,
      classeId,
      periode,
      ...next,
    } as Record<string, string>;
    for (const [cle, valeur] of Object.entries(valeurs)) {
      if (valeur && valeur !== TOUTES) params.set(cle, valeur);
    }
    startTransition(() => router.push(`/rapports?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <span className="text-label-md uppercase text-text-secondary">Rapport</span>
        <Select
          value={typeCourant}
          onValueChange={(v) => navigate({ type: v, classeId: '', periode: '' })}
        >
          <SelectTrigger className="h-10 w-full md:h-8 md:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rapports.map((r) => (
              <SelectItem key={r.type} value={r.type}>
                {r.libelle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <span className="text-label-md uppercase text-text-secondary">Année</span>
        <Select value={anneeScolaireId} onValueChange={(v) => navigate({ anneeScolaireId: v })}>
          <SelectTrigger className="h-10 w-full md:h-8 md:w-44">
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
          value={classeId || TOUTES}
          onValueChange={(v) => navigate({ classeId: v === TOUTES ? '' : v })}
          disabled={classes.length === 0}
        >
          <SelectTrigger className="h-10 w-full md:h-8 md:w-44">
            <SelectValue placeholder={exigeClasse ? 'Sélectionner' : 'Toutes'} />
          </SelectTrigger>
          <SelectContent>
            {!exigeClasse && <SelectItem value={TOUTES}>Toutes les classes</SelectItem>}
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {exigePeriode && (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <span className="text-label-md uppercase text-text-secondary">Trimestre</span>
          <Select value={periode || 'TRIMESTRE_1'} onValueChange={(v) => navigate({ periode: v })}>
            <SelectTrigger className="h-10 w-full md:h-8 md:w-40">
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
      )}
    </div>
  );
}
