import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import type { Evaluation } from '@/services/evaluation';

const TYPE_LABEL: Record<Evaluation['type'], string> = {
  INTERROGATION: 'Interrogation',
  DEVOIR: 'Devoir',
  COMPOSITION: 'Composition',
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function EvaluationsList({
  evaluations,
  classeNom,
  matiereNom,
}: {
  evaluations: Evaluation[];
  classeNom: string;
  matiereNom: string;
}) {
  if (evaluations.length === 0) {
    return (
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <ClipboardList className="h-10 w-10 text-text-secondary/50" aria-hidden />
        <p className="text-body-sm text-text-primary">
          Aucune évaluation pour {classeNom} — {matiereNom} sur cette période.
        </p>
        <p className="text-body-sm text-text-secondary">
          Créez-en une ci-dessous pour commencer la saisie des notes.
        </p>
      </CardContent>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Numéro</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {evaluations.map((ev) => (
          <TableRow key={ev.id}>
            <TableCell>
              <Badge variant="primary" shape="pill">
                {TYPE_LABEL[ev.type]}
              </Badge>
            </TableCell>
            <TableCell data-mono>{ev.numero}</TableCell>
            <TableCell>{formatDate(ev.date)}</TableCell>
            <TableCell className="text-right">
              <Link
                href={`/etablissement/notes/saisie/${ev.id}`}
                className="text-text-secondary hover:text-primary-container"
              >
                Saisir les notes
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
