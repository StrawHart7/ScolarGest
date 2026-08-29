'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { appelerAction } from '../appel-action';
import { ErreurEtape } from '../Bulles';
import { libelleAnneeParDefaut, datesAnneeParDefaut } from '@/lib/onboarding/suggestions';
import { creerEtActiverAnneeAction } from '../actions';
import { ChampPin } from './ChampPin';

/**
 * Tout se rattache à l'année scolaire : classes, coefficients, tarifs, et la
 * séquence de matricule des enseignants. Elle vient donc juste après le code
 * de confirmation, et elle est créée puis activée dans la foulée — une année
 * restée en `PREPARATION` ne débloquerait aucune des étapes suivantes.
 *
 * L'étape passe par un `<form>` parce que `DatePicker` est non contrôlé : il
 * expose sa valeur via un input caché nommé, pour se brancher sur les Server
 * Actions à base de `FormData` du reste de l'application.
 */
export function EtapeAnnee({ onTermine }: { onTermine: () => void }) {
  const defauts = React.useMemo(() => datesAnneeParDefaut(), []);
  const [libelle, setLibelle] = React.useState(() => libelleAnneeParDefaut());
  const [pin, setPin] = React.useState('');
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  async function surSoumission(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const donnees = new FormData(e.currentTarget);
    setErreur(null);
    setEnCours(true);
    const resultat = await appelerAction(() => creerEtActiverAnneeAction({
      libelle: String(donnees.get('libelle') ?? ''),
      dateDebut: String(donnees.get('dateDebut') ?? ''),
      dateFin: String(donnees.get('dateFin') ?? ''),
      pin,
    }));
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  return (
    <form onSubmit={surSoumission} className="mt-4 flex flex-col gap-3">
      <div>
        <Label htmlFor="libelle-annee">Libellé</Label>
        <Input
          id="libelle-annee"
          name="libelle"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="2026-2027"
          className="mt-1"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Label htmlFor="debut-annee">Début</Label>
          <div className="mt-1">
            <DatePicker id="debut-annee" name="dateDebut" defaultValue={defauts.dateDebut} />
          </div>
        </div>
        <div className="flex-1">
          <Label htmlFor="fin-annee">Fin</Label>
          <div className="mt-1">
            <DatePicker id="fin-annee" name="dateFin" defaultValue={defauts.dateFin} />
          </div>
        </div>
      </div>
      <ChampPin
        valeur={pin}
        onChange={setPin}
        aide="Activer l'année scolaire demande votre code de confirmation."
      />
      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button type="submit" disabled={enCours || pin.length !== 6 || libelle.trim() === ''}>
          {enCours ? 'Création…' : "Créer et activer l'année"}
        </Button>
      </div>
    </form>
  );
}
