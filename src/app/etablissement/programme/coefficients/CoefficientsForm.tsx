'use client';

import * as React from 'react';
import { useFormState } from 'react-dom';
import { Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { definirCoefficientsAction } from './actions';

export interface LigneCoefficient {
  programmeEtablissementId: string;
  matiereNom: string;
  obligatoire: boolean;
  coefficient: number | null;
}

/**
 * Toute la grille des coefficients dans un seul formulaire.
 *
 * Le `key` du champ inclut la série : sans cela, changer de série laissait
 * l'ancienne valeur affichée. Le composant restait monté et `defaultValue`,
 * qui n'est lu qu'au montage, n'était jamais réappliqué — on saisissait donc
 * les coefficients de la série C par-dessus ceux de la série D.
 */
export function CoefficientsForm({
  anneeScolaireId,
  serieId,
  lignes,
  modifiable,
}: {
  anneeScolaireId: string;
  serieId: string | null;
  lignes: LigneCoefficient[];
  modifiable: boolean;
}) {
  const [resultat, formAction] = useFormState(definirCoefficientsAction, null);
  const { succes, erreur } = useToast();
  const dernier = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!resultat || resultat === dernier.current) return;
    dernier.current = resultat;
    if (resultat === 'OK') succes('Coefficients enregistrés');
    else erreur('Coefficients non enregistrés', resultat);
  }, [resultat, succes, erreur]);

  const cleSerie = serieId ?? 'sans-serie';
  const total = lignes.reduce((somme, l) => somme + (l.coefficient ?? 0), 0);

  return (
    <form action={formAction}>
      <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
      {serieId && <input type="hidden" name="serieId" value={serieId} />}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Matière</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="w-40 text-right">Coefficient</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lignes.map((ligne) => (
            <TableRow key={ligne.programmeEtablissementId}>
              <TableCell className="font-medium">{ligne.matiereNom}</TableCell>
              <TableCell className="text-text-secondary">
                {ligne.obligatoire ? 'Obligatoire' : 'Facultative'}
              </TableCell>
              <TableCell className="text-right">
                {modifiable ? (
                  <Input
                    key={`${ligne.programmeEtablissementId}-${cleSerie}`}
                    name={`coefficient:${ligne.programmeEtablissementId}`}
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={ligne.coefficient ?? ''}
                    placeholder="—"
                    aria-label={`Coefficient de ${ligne.matiereNom}`}
                    className="ml-auto w-24 text-right"
                  />
                ) : (
                  <span data-mono>{ligne.coefficient ?? '—'}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="font-semibold" colSpan={2}>
              Total des coefficients
            </TableCell>
            <TableCell className="text-right font-semibold" data-mono>
              {total}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {modifiable && (
        <div className="flex items-center justify-end border-t border-surface-border p-4">
          <SubmitButton libelleEnCours="Enregistrement…">
            <Save className="h-4 w-4" aria-hidden />
            Enregistrer les coefficients
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
