'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export function ElevesFiltres({
  defaultSearch,
  defaultStatut,
}: {
  defaultSearch: string;
  defaultStatut: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(defaultSearch);

  function navigate(nextSearch: string, nextStatut: string) {
    const params = new URLSearchParams();
    if (nextSearch) params.set('q', nextSearch);
    if (nextStatut) params.set('statut', nextStatut);
    startTransition(() => {
      router.push(`/etablissement/eleves${params.toString() ? `?${params.toString()}` : ''}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative w-64">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(search, defaultStatut);
          }}
          onBlur={() => navigate(search, defaultStatut)}
          placeholder="Recherche par nom ou matricule..."
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-label-md uppercase text-text-secondary">Statut</span>
        <Select
          value={defaultStatut || 'TOUS'}
          onValueChange={(v) => navigate(search, v === 'TOUS' ? '' : v)}
        >
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TOUS">Tous</SelectItem>
            <SelectItem value="ACTIF">Actif</SelectItem>
            <SelectItem value="INACTIF">Inactif</SelectItem>
            <SelectItem value="ARCHIVE">Archivé</SelectItem>
            <SelectItem value="TRANSFERE">Transféré</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
