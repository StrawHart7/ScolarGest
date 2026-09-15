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
import { prochainNomClasse } from '@/lib/noms-classes';
import { creerClasse } from './actions';

export interface CycleOption {
  id: string;
  nom: string;
  estLycee: boolean;
  niveaux: { id: string; nom: string }[];
  series: { id: string; nom: string }[];
}

/**
 * Le nom de la classe est **composé**, jamais saisi. Une saisie libre
 * produisait des noms incohérents d'une classe à l'autre (« 6e A », « 6ème-A »,
 * « 6EME A »), que rien ne rattrapait ensuite dans les bulletins ni dans les
 * exports.
 *
 * Depuis le 2026-09-15, l'indice n'est plus demandé non plus : il se déduit
 * des classes déjà créées sur ce niveau et cette série. Le menu « Indice »
 * proposait A, B, C, D et donnait « Terminale D A », quand l'onboarding
 * produisait « Terminale D1 » — deux chemins, deux nommages, dans la même
 * école.
 */
export function ClasseForm({
  anneeScolaireId,
  cycles,
  nomsExistants,
  dansLeFlux,
}: {
  anneeScolaireId: string;
  cycles: CycleOption[];
  /** Noms des classes déjà créées sur l'année, pour en déduire le suivant. */
  nomsExistants: readonly string[];
  /** Vrai quand le formulaire est ouvert depuis un etat vide : pas de bouton flottant. */
  dansLeFlux?: boolean;
}) {
  const [resultat, formAction] = useFormState(creerClasse, null);
  const [ouvert, setOuvert] = React.useState(false);
  const [cycleId, setCycleId] = React.useState(cycles[0]?.id ?? '');
  const [niveauId, setNiveauId] = React.useState('');
  const [serieId, setSerieId] = React.useState('');
  const { succes, erreur } = useToast();
  const dernier = React.useRef<string | null>(null);

  const cycle = React.useMemo(() => cycles.find((c) => c.id === cycleId), [cycles, cycleId]);
  const niveau = cycle?.niveaux.find((n) => n.id === niveauId);
  const serie = cycle?.series.find((s) => s.id === serieId);

  // S'il existe déjà une Terminale D1 et une D2, la suivante est la D3.
  // Voir `lib/noms-classes.ts` pour la convention et ses cas de bord.
  const nomCompose =
    niveau && (!cycle?.estLycee || serie)
      ? prochainNomClasse(niveau.nom, cycle?.estLycee ? (serie?.nom ?? null) : null, nomsExistants)
      : '';

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
      <DeclencheurCreation libelle="Nouvelle classe" onClick={() => setOuvert(true)} dansLeFlux={dansLeFlux} />

      <DialogContent>
        <form action={formAction}>
          <input type="hidden" name="anneeScolaireId" value={anneeScolaireId} />
          <input type="hidden" name="niveauId" value={niveauId} />
          {cycle?.estLycee && <input type="hidden" name="serieId" value={serieId} />}
          <input type="hidden" name="nom" value={nomCompose} />

          <DialogHeader>
            <DialogTitle>Nouvelle classe</DialogTitle>
            <DialogDescription>
              Le nom est composé automatiquement, et continue les classes déjà créées sur ce
              niveau.
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

              {/*
                Le menu « Indice » est parti le 2026-09-15 : il n'y a rien à
                choisir. La classe suivante continue la série déjà en place,
                et l'aperçu ci-dessous montre le nom qu'elle portera.
              */}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="capacite">Capacité</Label>
                <Input id="capacite" name="capacite" type="number" inputMode="numeric" min={1} step={1} />
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
