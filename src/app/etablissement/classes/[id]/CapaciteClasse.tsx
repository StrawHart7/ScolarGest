'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { definirCapaciteAction } from './capacite-actions';

/**
 * Capacité d'une classe, modifiable sur place.
 *
 * Elle n'était demandée qu'à la création, et `/demarrage` ne la demande pas —
 * une école configurée par le parcours guidé n'avait donc aucun moyen de la
 * poser un jour. Le champ vit ici, dans la fiche de classe, plutôt que dans un
 * écran de réglages : c'est là qu'on constate qu'une classe déborde.
 *
 * Pas de modale. Le geste est d'un seul champ et se relit d'un coup d'œil ;
 * ouvrir une fenêtre pour un nombre coûterait plus que la saisie elle-même.
 */
export function CapaciteClasse({
  classeId,
  capacite,
  effectif,
  modifiable,
}: {
  classeId: string;
  capacite: number | null;
  /** Effectif inscrit, pour signaler un dépassement sans jamais l'interdire. */
  effectif: number;
  /** Seul le Directeur écrit la structure ; les autres rôles lisent. */
  modifiable: boolean;
}) {
  const [edition, setEdition] = React.useState(false);
  const [valeur, setValeur] = React.useState(capacite?.toString() ?? '');
  const [envoi, setEnvoi] = React.useState(false);
  const { succes, erreur } = useToast();

  // La valeur affichée vient du serveur : après un enregistrement, la page se
  // revalide et la prop change. Sans cette synchronisation, rouvrir le champ
  // proposerait l'ancienne saisie.
  React.useEffect(() => {
    setValeur(capacite?.toString() ?? '');
  }, [capacite]);

  const enregistrer = async () => {
    setEnvoi(true);
    // Une Server Action interrompue peut se résoudre sur `undefined` : la
    // traiter comme un succès annoncerait une capacité qui n'a pas été écrite.
    const resultat = await definirCapaciteAction({ classeId, capacite: valeur.trim() }).catch(
      () => undefined,
    );
    setEnvoi(false);

    if (!resultat?.ok) {
      erreur('Capacité non enregistrée', resultat?.message ?? 'Réessayez dans un instant.');
      return;
    }
    setEdition(false);
    succes(
      'Capacité enregistrée',
      valeur.trim() === '' ? 'Cette classe n’a plus de plafond.' : `${valeur.trim()} élèves au plus.`,
    );
  };

  if (!modifiable) {
    return (
      <div>
        <dt className="text-text-secondary">Capacité</dt>
        <dd className="text-text-primary" data-mono>
          {capacite ?? '—'}
        </dd>
      </div>
    );
  }

  if (!edition) {
    return (
      <div>
        <dt className="text-text-secondary">Capacité</dt>
        <dd className="flex flex-wrap items-center gap-3">
          <span className="text-text-primary" data-mono>
            {capacite ?? 'Non définie'}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEdition(true)}
            className="max-md:h-row-standard"
          >
            {capacite ? 'Modifier' : 'Définir'}
          </Button>
          {capacite !== null && effectif > capacite ? (
            <span className="text-body-sm text-warning">
              {effectif} inscrits — au-dessus du plafond
            </span>
          ) : null}
        </dd>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2">
      <Label htmlFor="capacite-classe">Capacité</Label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Input
          id="capacite-classe"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder="Aucun plafond"
          className="w-40"
          autoFocus
        />
        <Button type="button" variant="primary" size="sm" onClick={enregistrer} disabled={envoi}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setValeur(capacite?.toString() ?? '');
            setEdition(false);
          }}
          disabled={envoi}
        >
          Annuler
        </Button>
      </div>
      <p className="mt-1.5 text-body-sm text-text-secondary">
        Laissez le champ vide pour retirer le plafond. La capacité n’empêche aucune inscription :
        elle sert à signaler les classes qui débordent.
      </p>
    </div>
  );
}
