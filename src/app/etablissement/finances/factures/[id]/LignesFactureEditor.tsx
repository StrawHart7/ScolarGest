'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { enregistrerLignesAction } from './actions';

interface LigneEditable {
  typeFraisId: string;
  designation: string;
  montant: string;
}

/**
 * Ajustement des lignes avant tout encaissement (remises, frais spéciaux,
 * enfants du personnel — doc 08 §8). L'écran envoie la liste complète : le
 * remplacement intégral en une transaction évite les états intermédiaires où
 * le total ne correspondrait plus à la somme des lignes.
 */
export function LignesFactureEditor({
  factureId,
  lignesInitiales,
  typesFrais,
}: {
  factureId: string;
  lignesInitiales: { typeFraisId: string; designation: string; montant: number }[];
  typesFrais: { id: string; nom: string }[];
}) {
  const [lignes, setLignes] = useState<LigneEditable[]>(
    lignesInitiales.map((l) => ({
      typeFraisId: l.typeFraisId,
      designation: l.designation,
      montant: String(l.montant),
    })),
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = lignes.reduce((somme, l) => somme + (Number(l.montant) || 0), 0);

  function majLigne(index: number, champ: keyof LigneEditable, valeur: string) {
    setLignes((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        if (champ === 'typeFraisId') {
          const typeFrais = typesFrais.find((t) => t.id === valeur);
          // La désignation suit le type de frais tant qu'elle n'a pas été
          // personnalisée, pour éviter un libellé incohérent sur la facture.
          const designationSuit =
            l.designation === '' ||
            typesFrais.some((t) => t.nom === l.designation);
          return {
            ...l,
            typeFraisId: valeur,
            designation: designationSuit ? typeFrais?.nom ?? l.designation : l.designation,
          };
        }
        return { ...l, [champ]: valeur };
      }),
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type de frais</TableHead>
              <TableHead>Désignation</TableHead>
              <TableHead className="text-right">Montant (FCFA)</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((ligne, index) => (
              // eslint-disable-next-line react/no-array-index-key -- lignes sans id stable tant qu'elles ne sont pas enregistrées
              <TableRow key={index}>
                <TableCell>
                  <Select
                    value={ligne.typeFraisId}
                    onValueChange={(v) => majLigne(index, 'typeFraisId', v)}
                  >
                    <SelectTrigger className="h-8 w-56">
                      <SelectValue placeholder="Type de frais" />
                    </SelectTrigger>
                    <SelectContent>
                      {typesFrais.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={ligne.designation}
                    onChange={(e) => majLigne(index, 'designation', e.target.value)}
                    className="h-8 w-64"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={ligne.montant}
                    onChange={(e) => majLigne(index, 'montant', e.target.value)}
                    className="h-8 w-32 text-right"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLignes((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Retirer
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold" colSpan={2}>
                Total facturé
              </TableCell>
              <TableCell className="text-right font-semibold" data-mono>
                {total.toLocaleString('fr-FR')} FCFA
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Mobile : chaque ligne devient une carte empilée — la grille desktop
          (colonnes Select 224px + Input 256px + Input 128px) déborde très
          largement un écran de téléphone, même dans un conteneur qui scrolle
          horizontalement. */}
      <div className="flex flex-col gap-3 md:hidden">
        {lignes.map((ligne, index) => (
          // eslint-disable-next-line react/no-array-index-key -- lignes sans id stable tant qu'elles ne sont pas enregistrées
          <div key={index} className="rounded-lg border border-surface-border bg-surface p-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Type de frais</Label>
                <Select
                  value={ligne.typeFraisId}
                  onValueChange={(v) => majLigne(index, 'typeFraisId', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type de frais" />
                  </SelectTrigger>
                  <SelectContent>
                    {typesFrais.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Désignation</Label>
                <Input
                  value={ligne.designation}
                  onChange={(e) => majLigne(index, 'designation', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Montant (FCFA)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={ligne.montant}
                  onChange={(e) => majLigne(index, 'montant', e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="self-end"
                onClick={() => setLignes((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Retirer
              </Button>
            </div>
          </div>
        ))}
        <div className="flex items-baseline justify-between border-t border-surface-border pt-3">
          <span className="text-body-sm font-semibold text-text-primary">Total facturé</span>
          <span className="text-body-md font-semibold text-text-primary" data-mono>
            {total.toLocaleString('fr-FR')} FCFA
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={typesFrais.length === 0}
          onClick={() =>
            setLignes((prev) => [
              ...prev,
              {
                typeFraisId: typesFrais[0]?.id ?? '',
                designation: typesFrais[0]?.nom ?? '',
                montant: '0',
              },
            ])
          }
        >
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter une ligne
        </Button>

        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const resultat = await enregistrerLignesAction(
                factureId,
                lignes.map((l) => ({
                  typeFraisId: l.typeFraisId,
                  designation: l.designation.trim(),
                  montant: Number(l.montant) || 0,
                })),
              );
              if (resultat) setError(resultat);
              else setMessage('Lignes enregistrées.');
            });
          }}
        >
          {pending ? 'Enregistrement...' : 'Enregistrer les lignes'}
        </Button>

        {message && <p className="text-body-sm text-tertiary">{message}</p>}
        {error && <p className="text-body-sm text-error">{error}</p>}
      </div>
    </div>
  );
}
