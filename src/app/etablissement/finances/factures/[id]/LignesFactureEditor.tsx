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

const fcfa = (montant: number) => `${Math.round(montant).toLocaleString('fr-FR')} FCFA`;

/**
 * Ajustement des lignes d'une facture (remises, frais spéciaux, enfants du
 * personnel — doc 08 §8). L'écran envoie la liste complète : le remplacement
 * intégral en une transaction évite les états intermédiaires où le total ne
 * correspondrait plus à la somme des lignes.
 *
 * **L'écran reste ouvert après un encaissement** depuis le 2026-09-16 : une
 * famille ajoute la cantine en janvier, le transport au deuxième trimestre. Il
 * ne s'agit donc plus d'un ajustement « avant tout versement », et l'éditeur
 * doit dire ce qui a déjà été payé — sans quoi on retire une ligne de 60 000 F
 * sans voir que la famille l'a réglée.
 */
export function LignesFactureEditor({
  factureId,
  lignesInitiales,
  typesFrais,
  totalPaye,
}: {
  factureId: string;
  lignesInitiales: { typeFraisId: string; designation: string; montant: number }[];
  typesFrais: { id: string; nom: string }[];
  /** Somme déjà encaissée sur cette facture, versements annulés exclus. */
  totalPaye: number;
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

  // Averti pendant la saisie, avant d'enregistrer : le dire après coup
  // laisserait l'école découvrir le trop-perçu une fois l'écriture faite.
  const surplusPrevu = Math.max(totalPaye - total, 0);

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
      {totalPaye > 0 && (
        // Un état, pas une faute : ajouter la cantine en janvier est le cours
        // normal d'une année. D'où le ton neutre — `warning` est réservé à ce
        // qui approche d'un problème, `error` à ce qui a échoué.
        <p className="text-body-sm text-text-secondary">
          {fcfa(totalPaye)} déjà encaissés sur cette facture. Modifier les lignes recalcule le
          solde ; les versements ne bougent pas.
        </p>
      )}

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
                <Label htmlFor={`typeFrais-${index}`}>Type de frais</Label>
                <Select
                  value={ligne.typeFraisId}
                  onValueChange={(v) => majLigne(index, 'typeFraisId', v)}
                >
                  <SelectTrigger id={`typeFrais-${index}`}>
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
                <Label htmlFor={`designation-${index}`}>Désignation</Label>
                <Input
                  id={`designation-${index}`}
                  value={ligne.designation}
                  onChange={(e) => majLigne(index, 'designation', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`montant-${index}`}>Montant (FCFA)</Label>
                <Input
                  id={`montant-${index}`}
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

      {surplusPrevu > 0 && (
        <p className="text-body-sm text-warning">
          Ce total passe sous les {fcfa(totalPaye)} déjà versés : la famille aura payé{' '}
          {fcfa(surplusPrevu)} de trop. L&apos;enregistrement reste possible — le remboursement
          est votre décision, la plateforme ne le fait pas à votre place.
        </p>
      )}

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
              // Une Server Action interrompue peut se résoudre sur `undefined`
              // (CLAUDE.md § « Server Actions ») : sans ce repli, annoncer
              // « enregistré » sur une coupure réseau serait un mensonge sur
              // une écriture financière.
              const resultat = await enregistrerLignesAction(
                factureId,
                lignes.map((l) => ({
                  typeFraisId: l.typeFraisId,
                  designation: l.designation.trim(),
                  montant: Number(l.montant) || 0,
                })),
              ).catch(() => undefined);

              if (!resultat) {
                setError("L'enregistrement n'a pas abouti. Vérifiez votre connexion et réessayez.");
                return;
              }
              if (resultat.error) {
                setError(resultat.error);
                return;
              }
              // Le surplus rendu par la base fait foi, pas celui calculé à
              // l'écran : un versement encaissé entre-temps le changerait.
              setMessage(
                resultat.surplus && resultat.surplus > 0
                  ? `Lignes enregistrées. Total ${fcfa(resultat.montantTotal ?? total)} — ${fcfa(resultat.surplus)} versés en trop.`
                  : 'Lignes enregistrées.',
              );
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
