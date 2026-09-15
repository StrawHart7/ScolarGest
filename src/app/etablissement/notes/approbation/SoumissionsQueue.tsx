'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CarteListeMobile, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { nommerEvaluation } from '@/lib/evaluations';
import type { EvaluationSoumise } from '@/services/note';
import { SoumissionModal } from './SoumissionModal';

const PERIODE_LABEL: Record<string, string> = {
  TRIMESTRE_1: 'Trimestre 1',
  TRIMESTRE_2: 'Trimestre 2',
  TRIMESTRE_3: 'Trimestre 3',
};

export function SoumissionsQueue({ soumissions }: { soumissions: EvaluationSoumise[] }) {
  const [selected, setSelected] = useState<EvaluationSoumise | null>(null);

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Classe</TableHead>
              <TableHead>Matière / évaluation</TableHead>
              <TableHead>Notes soumises</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {soumissions.map((s) => (
              <TableRow key={s.evaluationId}>
                <TableCell className="font-medium text-text-primary">{s.classeNom}</TableCell>
                <TableCell>
                  <div>{s.matiereNom}</div>
                  <div className="text-body-sm text-text-secondary">
                    {nommerEvaluation(s.evaluationType, s.numero)} · {PERIODE_LABEL[s.periode]}
                  </div>
                </TableCell>
                <TableCell>{s.nombreNotes}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => setSelected(s)}>
                    Examiner
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CarteListeMobile>
        {soumissions.map((s) => (
          <LigneCarteMobile
            key={s.evaluationId}
            titre={s.classeNom}
            sousTitre={`${s.matiereNom} · ${nommerEvaluation(s.evaluationType, s.numero)} · ${s.nombreNotes} note(s)`}
            actions={
              <Button size="sm" onClick={() => setSelected(s)}>
                Examiner
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            }
          />
        ))}
      </CarteListeMobile>

      {selected && <SoumissionModal soumission={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
