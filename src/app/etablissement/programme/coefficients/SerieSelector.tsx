'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export function SerieSelector({
  niveauId,
  series,
  value,
}: {
  niveauId: string;
  series: { id: string; nom: string }[];
  value: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        startTransition(() => {
          const params = new URLSearchParams({ niveauId });
          if (v !== 'aucune') params.set('serieId', v);
          router.push(`/etablissement/programme/coefficients?${params.toString()}`);
        });
      }}
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Sans série" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="aucune">Sans série</SelectItem>
        {series.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.nom}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
