'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CarteListeMobile, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { nommerEvaluation } from '@/lib/evaluations';
import type { NoteEnAttente } from '@/services/note';
import { ApprobationModal } from './ApprobationModal';

import { useNommerPeriode } from '@/components/layout/RegimeProvider';

export function ApprobationQueue({ notes }: { notes: NoteEnAttente[] }) {
  // « 1er trimestre » ou « 1er semestre », selon le regime de l'ecole.
  const nommer = useNommerPeriode();
  const [selected, setSelected] = useState<NoteEnAttente | null>(null);

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Élève</TableHead>
              <TableHead>Classe</TableHead>
              <TableHead>Matière / évaluation</TableHead>
              <TableHead>Ancienne → proposée</TableHead>
              <TableHead>Demandé par</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.map((note) => (
              <TableRow key={note.id}>
                <TableCell className="font-medium text-text-primary">
                  {note.elevePrenoms} {note.eleveNom}
                </TableCell>
                <TableCell>{note.classeNom}</TableCell>
                <TableCell>
                  <div>{note.matiereNom}</div>
                  <div className="text-body-sm text-text-secondary">
                    {nommerEvaluation(note.evaluationType, note.numero)} · {nommer(note.periode, note.classeCycle)}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-text-secondary">{note.valeur ?? '—'}</span>
                  <span className="mx-1 text-text-secondary">→</span>
                  <span className="font-semibold text-primary-container">
                    {note.valeurProposee ?? '—'}
                  </span>
                </TableCell>
                <TableCell>{note.demandeParNom}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => setSelected(note)}>
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
        {notes.map((note) => (
          <LigneCarteMobile
            key={note.id}
            titre={`${note.elevePrenoms} ${note.eleveNom}`}
            // Voir `SoumissionsQueue` : la période manquait sur la carte alors
            // qu'elle est sur le tableau. Elle vient après la classe, dont elle
            // dépend désormais — collège au trimestre, lycée au régime choisi.
            sousTitre={`${note.classeNom} · ${note.matiereNom} · ${nommerEvaluation(note.evaluationType, note.numero)} · ${nommer(note.periode, note.classeCycle)}`}
            valeurSecondaire={
              <span>
                <span className="text-text-secondary">{note.valeur ?? '—'}</span>
                <span className="mx-1 text-text-secondary">→</span>
                <span className="font-semibold text-primary-container">
                  {note.valeurProposee ?? '—'}
                </span>
              </span>
            }
            actions={
              <Button size="sm" onClick={() => setSelected(note)}>
                Examiner
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            }
          />
        ))}
      </CarteListeMobile>

      {selected && <ApprobationModal note={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
