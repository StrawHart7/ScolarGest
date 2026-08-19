'use client';

import { useState, useTransition } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { genererBulletinAction, genererBulletinsClasseAction } from './actions';

export function BulletinsListe({
  eleves,
  classeId,
  periode,
  anneeScolaireId,
}: {
  eleves: { id: string; nom: string; prenoms: string; matricule: string }[];
  classeId: string;
  periode: string;
  anneeScolaireId: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, startBulkTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  function genererUn(eleveId: string) {
    setPendingId(eleveId);
    setErrors((prev) => ({ ...prev, [eleveId]: '' }));
    genererBulletinAction(eleveId, classeId, periode, anneeScolaireId).then((result) => {
      setPendingId(null);
      if (result.error) {
        setErrors((prev) => ({ ...prev, [eleveId]: result.error! }));
        return;
      }
      if (result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      }
    });
  }

  function genererTout() {
    if (
      !window.confirm(
        `Générer le bulletin de ${eleves.length} élève(s) pour cette classe et cette période ?`,
      )
    )
      return;
    setBulkMessage(null);
    startBulkTransition(async () => {
      const result = await genererBulletinsClasseAction(classeId, periode, anneeScolaireId);
      if (result.error) {
        setBulkMessage(result.error);
        return;
      }
      setBulkMessage(`${result.succes} bulletin(s) généré(s), ${result.echecs} échec(s).`);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-surface-border p-4">
        <p className="text-body-sm text-text-secondary">{eleves.length} élève(s) inscrit(s) (statut ACTIF)</p>
        <Button size="sm" onClick={genererTout} disabled={bulkPending || eleves.length === 0}>
          {bulkPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Générer tous les bulletins de la classe
        </Button>
      </div>
      {bulkMessage && <p className="px-4 pt-2 text-body-sm text-text-secondary">{bulkMessage}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Matricule</TableHead>
            <TableHead>Nom &amp; Prénoms</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {eleves.map((eleve) => (
            <TableRow key={eleve.id}>
              <TableCell data-mono>{eleve.matricule}</TableCell>
              <TableCell className="font-medium">
                {eleve.nom} {eleve.prenoms}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pendingId === eleve.id}
                    onClick={() => genererUn(eleve.id)}
                  >
                    {pendingId === eleve.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <FileText className="h-4 w-4" aria-hidden />
                    )}
                    Générer le bulletin
                  </Button>
                  {errors[eleve.id] && <p className="text-body-sm text-error">{errors[eleve.id]}</p>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
