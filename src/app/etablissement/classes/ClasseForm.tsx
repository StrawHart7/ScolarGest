'use client';

import * as React from 'react';
import { useFormState } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button, SubmitButton } from '@/components/ui/button';
import { DeclencheurCreation } from '@/components/ui/declencheur-creation';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { creerClasse } from './actions';

export interface CycleOption {
  id: string;
  nom: string;
  estLycee: boolean;
  niveaux: { id: string; nom: string }[];
  series: { id: string; nom: string }[];
}

/** Suffisant pour distinguer les classes parallèles d'un même niveau. */
const INDICES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Le nom de la classe est **composé**, jamais saisi : « Niveau + Série +
 * Indice ». Une saisie libre produisait des noms incohérents d'une classe à
 * l'autre (« 6e A », « 6ème-A », « 6EME A »), que rien ne rattrapait ensuite
 * dans les bulletins ni dans les exports.
 */
export function ClasseForm({
  anneeScolaireId,
  cycles,
}: {
  anneeScolaireId: string;
  cycles: CycleOption[];
}) {
  const [resultat, formAction] = useFormState(creerClasse, null);
  const [ouvert, setOuvert] = React.useState(false);
  const [cycleId, setCycleId] = React.useState(cycles[0]?.id ?? '');
  const [niveauId, setNiveauId] = React.useState('');
  const [serieId, setSerieId] = React.useState('');
  const [indice, setIndice] = React.useState(INDICES[0]!);
  const { succes, erreur } = useToast();
  const dernier = React.useRef<string | null>(null);

  const cycle = React.useMemo(() => cycles.find((c) => c.id === cycleId), [cycles, cycleId]);
  const niveau = cycle?.niveaux.find((n) => n.id === niveauId);
  const serie = cycle?.series.find((s) => s.id === serieId);

  const nomCompose = [niveau?.nom, cycle?.estLycee ? serie?.nom : null, indice]
    .filter(Boolean)
    .join(' ');

  React.useEffect(() => {
    if (!resultat || resultat === dernier.current) return;
    dernier.current = resultat;
    if (resultat === 'OK') {
      setOuvert(false);
      succes('Classe créée', nomCompose);
    } else {
      erreur('Classe non créée', resultat);
    }
  }, [resultat, succes, erreur, nomCompose]);

  // Changer de cycle invalide le niveau et la série retenus : les conserver
  // soumettrait un niveau qui n'appartient pas au cycle choisi.
  const changerCycle = (valeur: string) => {
    setCycleId(valeur);
    setNiveauId('');
    setSerieId('');
  };

  const complet = Boolean(niveauId && (!cycle?.estLycee || serieId));

  return (
    <Dialog open={ouvert} onOpenChange={setOuvert}>
      <DeclencheurCreation libelle="Nouvelle classe" onClick={() => setOuvert(true)} />

      <DialogContent>
        <form action={formAction}>
          <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
          <input type="hidden" name="niveauId" value={niveauId} />
          {cycle?.estLycee && <input type="hidden" name="serieId" value={serieId} />}
          <input type="hidden" name="nom" value={nomCompose} />

          <DialogHeader>
            <DialogTitle>Nouvelle classe</DialogTitle>
            <DialogDescription>
              Le nom est composé automatiquement à partir du niveau, de la série et de l’indice.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cycleId">Cycle</Label>
              <Select value={cycleId} onValueChange={changerCycle}>
                <SelectTrigger id="cycleId">
                  <SelectValue placeholder="Choisir un cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="niveau">Niveau</Label>
                <Select value={niveauId} onValueChange={setNiveauId}>
                  <SelectTrigger id="niveau">
                    <SelectValue placeholder="Choisir un niveau" />
                  </SelectTrigger>
                  <SelectContent>
                    {cycle?.niveaux.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {cycle?.estLycee && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="serie">Série</Label>
                  <Select value={serieId} onValueChange={setSerieId}>
                    <SelectTrigger id="serie">
                      <SelectValue placeholder="Choisir une série" />
                    </SelectTrigger>
                    <SelectContent>
                      {cycle.series.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="indice">Indice</Label>
                <Select value={indice} onValueChange={setIndice}>
                  <SelectTrigger id="indice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDICES.map((valeur) => (
                      <SelectItem key={valeur} value={valeur}>
                        {valeur}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="capacite">Capacité</Label>
                <Input id="capacite" name="capacite" type="number" min={1} step={1} />
              </div>
            </div>

            <div className="rounded border border-surface-border bg-surface-container-low px-4 py-3">
              <p className="text-label-md uppercase text-text-secondary">Nom de la classe</p>
              <p className="text-headline-sm text-text-primary">
                {complet ? nomCompose : 'Complétez le niveau et la série'}
              </p>
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Annuler
              </Button>
            </DialogClose>
            <SubmitButton size="sm" disabled={!complet} libelleEnCours="Création…">
              Créer la classe
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
