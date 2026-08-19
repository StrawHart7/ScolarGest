'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export interface NiveauOption {
  id: string;
  nom: string;
  cycleNom: string;
}

export function NiveauSelector({
  niveaux,
  value,
  basePath,
}: {
  niveaux: NiveauOption[];
  value: string;
  basePath: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        startTransition(() => {
          router.push(`${basePath}?niveauId=${v}`);
        });
      }}
    >
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Choisir un niveau" />
      </SelectTrigger>
      <SelectContent>
        {niveaux.map((n) => (
          <SelectItem key={n.id} value={n.id}>
            {n.cycleNom} — {n.nom}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
