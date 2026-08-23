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

      {/* Mobile : liste compacte — une ligne par matière avec champ à droite */}
      <div className="md:hidden">
        <div className="divide-y divide-surface-border">
          {lignes.map((ligne) => (
            <div key={ligne.programmeEtablissementId} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md font-medium text-text-primary">
                  {ligne.matiereNom}
                </p>
                <p className="text-[11px] text-text-secondary">
                  {ligne.obligatoire ? 'Obligatoire' : 'Facultative'}
                </p>
              </div>
              {modifiable ? (
                <Input
                  key={`${ligne.programmeEtablissementId}-${cleSerie}`}
                  name={`coefficient:${ligne.programmeEtablissementId}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  defaultValue={ligne.coefficient ?? ''}
                  placeholder="—"
                  aria-label={`Coefficient de ${ligne.matiereNom}`}
                  className="w-16 shrink-0 text-center font-bold"
                />
              ) : (
                <span className="text-body-lg font-bold text-primary" data-mono>
                  {ligne.coefficient ?? '—'}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-surface-border px-4 py-3">
          <span className="text-body-md font-semibold text-text-primary">Total</span>
          <span className="text-body-lg font-bold text-primary" data-mono>
            {total}
          </span>
        </div>
      </div>

      {/* Desktop : tableau — inchangé */}
      <div className="hidden md:block">
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
                      inputMode="numeric"
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
      </div>

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
