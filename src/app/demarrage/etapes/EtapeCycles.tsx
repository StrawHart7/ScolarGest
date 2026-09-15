'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appelerAction } from '../appel-action';
import { ErreurEtape } from '../Bulles';
import type { Cycle } from '@/services/structure';
import type { RegimePeriodes } from '@/lib/periodes';
import { activerCyclesAction } from '../actions';
import { ChampPin } from './ChampPin';

const LIBELLE_CYCLE: Record<string, string> = {
  COLLEGE: 'Collège',
  LYCEE: 'Lycée',
};

/**
 * Les niveaux que le cycle ouvre, dits en clair.
 *
 * Un Directeur reconnaît « 6e, 5e, 4e, 3e » avant de reconnaître « collège » —
 * c'est le vocabulaire de son école. Et c'est la seule chose que l'étape
 * suivante utilisera : autant l'annoncer ici.
 */
const NIVEAUX_CYCLE: Record<string, string> = {
  COLLEGE: '6e, 5e, 4e, 3e',
  LYCEE: '2nde, 1re, Terminale',
};

/**
 * Activer un cycle rend ses niveaux disponibles pour la suite. Il n'existe pas
 * de table `niveau_etablissement` : la disponibilité d'un niveau découle
 * uniquement du cycle activé, et se matérialise ensuite par les classes créées
 * dessus.
 */
export function EtapeCycles({
  cycles,
  cyclesDejaActifs,
  onTermine,
}: {
  cycles: Cycle[];
  cyclesDejaActifs: string[];
  onTermine: () => void;
}) {
  const [selection, setSelection] = React.useState<string[]>([]);
  const [regime, setRegime] = React.useState<RegimePeriodes>('TRIMESTRE');
  const [pin, setPin] = React.useState('');
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  // La question du découpage ne se pose qu'au lycée : au collège, le trimestre
  // est unanime au Togo, et poser une question à laquelle il n'y a qu'une
  // réponse allonge l'étape sans rien décider.
  const estChoisi = (nom: string) =>
    cycles.some(
      (c) => c.nom === nom && (selection.includes(c.id) || cyclesDejaActifs.includes(c.id)),
    );
  const lyceeChoisi = estChoisi('LYCEE');
  const collegeChoisi = estChoisi('COLLEGE');

  function basculer(cycleId: string) {
    setSelection((prec) =>
      prec.includes(cycleId) ? prec.filter((id) => id !== cycleId) : [...prec, cycleId],
    );
  }

  async function valider() {
    setErreur(null);
    setEnCours(true);
    // Le régime part avec l'activation : deux appels laisseraient une école
    // avec ses cycles activés et son découpage perdu si le second échouait,
    // et l'activation d'un cycle est **définitive** — on ne repasserait jamais
    // par cette étape pour rattraper.
    const resultat = await appelerAction(() =>
      activerCyclesAction({ cycleIds: selection, pin, regime: lyceeChoisi ? regime : 'TRIMESTRE' }),
    );
    setEnCours(false);
    if (!resultat.ok) {
      setErreur(resultat.message);
      return;
    }
    onTermine();
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {/*
        Deux pastilles de la taille d'une étiquette ne se lisaient pas comme un
        choix : le testeur du 2026-09-14 n'a pas vu qu'il fallait cliquer. Il y
        a exactement deux options et tout l'espace d'une carte — les serrer
        n'économisait rien et coûtait la compréhension de l'étape la plus
        irréversible du parcours.

        Chaque cycle devient donc une vraie cible : une case, un nom, les
        niveaux qu'il ouvre. Le bouton porte `aria-pressed` — ce sont des
        interrupteurs, pas des liens.
      */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cycles.map((cycle) => {
          const dejaActif = cyclesDejaActifs.includes(cycle.id);
          const choisi = dejaActif || selection.includes(cycle.id);
          return (
            <button
              key={cycle.id}
              type="button"
              aria-pressed={choisi}
              disabled={dejaActif}
              onClick={() => basculer(cycle.id)}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                choisi
                  ? 'border-primary bg-primary/5'
                  : 'border-surface-border bg-surface-container-lowest hover:border-primary/50 hover:bg-primary/5'
              } ${dejaActif ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  choisi ? 'border-primary bg-primary text-primary-on' : 'border-outline'
                }`}
                aria-hidden
              >
                {choisi ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-body-md font-medium text-text-primary">
                  {LIBELLE_CYCLE[cycle.nom] ?? cycle.nom}
                </span>
                <span className="block text-body-sm text-text-secondary">
                  {NIVEAUX_CYCLE[cycle.nom] ?? 'Niveaux de ce cycle'}
                </span>
                {dejaActif && (
                  <span className="mt-1 block text-body-sm text-text-secondary">Déjà actif</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-body-sm text-text-secondary">
        Cochez ce que votre établissement enseigne. Vous pouvez en choisir un ou les deux.
      </p>

      {/*
        Le découpage de l'année, demandé dès que le lycée est coché.
        Certains lycées togolais fonctionnent au **semestre** — deux périodes —
        et non au trimestre.

        La question n'apparaît qu'ici parce que c'est le seul moment où on peut
        encore répondre : une fois des notes saisies, basculer renommerait des
        périodes déjà imprimées sur des bulletins remis aux familles, et la
        troisième deviendrait inatteignable. Le service le refuse alors.

        **Le choix ne vaut que pour le lycée.** Corrigé le 2026-09-15 : le
        collège est au trimestre partout au Togo, sans exception. Un complexe
        qui répond « semestres » porte donc les deux découpages — et on le lui
        dit ici, en toutes lettres, plutôt que de le lui laisser découvrir sur
        le premier bulletin de 6e.
      */}
      {lyceeChoisi && (
        <div className="flex flex-col gap-3 rounded-xl border border-surface-border p-4">
          <div>
            <p className="text-body-md font-medium text-text-primary">
              Comment découpez-vous l&apos;année au lycée ?
            </p>
            <p className="text-body-sm text-text-secondary">
              Cela décide du nombre de bulletins et du mot employé pour vos classes de 2nde,
              1re et Terminale.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                { valeur: 'TRIMESTRE', titre: 'Trimestres', detail: 'Trois périodes dans l’année' },
                { valeur: 'SEMESTRE', titre: 'Semestres', detail: 'Deux périodes dans l’année' },
              ] as const
            ).map((option) => (
              <button
                key={option.valeur}
                type="button"
                aria-pressed={regime === option.valeur}
                onClick={() => setRegime(option.valeur)}
                className={`flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition ${
                  regime === option.valeur
                    ? 'border-primary bg-primary/5'
                    : 'border-surface-border hover:border-primary/50 hover:bg-primary/5'
                }`}
              >
                <span className="text-body-md font-medium text-text-primary">{option.titre}</span>
                <span className="text-body-sm text-text-secondary">{option.detail}</span>
              </button>
            ))}
          </div>
          {/*
            Dit seulement quand c'est vrai, et seulement quand ça change quelque
            chose : un complexe qui choisit les semestres doit savoir tout de
            suite que sa 6e gardera trois trimestres. Le découvrir au premier
            bulletin serait pris pour une erreur du produit.
          */}
          {collegeChoisi && regime === 'SEMESTRE' && (
            <p className="text-body-sm text-warning-on-container">
              Vos classes de collège resteront en trimestres : c&apos;est la règle pour la 6e, la
              5e, la 4e et la 3e.
            </p>
          )}
          <p className="text-body-sm text-text-secondary">
            Ce choix se modifie tant qu&apos;aucune note n&apos;a été saisie.
          </p>
        </div>
      )}

      <ChampPin
        valeur={pin}
        onChange={setPin}
        aide="L'activation étant définitive, elle demande votre code de confirmation."
      />
      <ErreurEtape message={erreur} />
      <div className="flex justify-end">
        <Button onClick={valider} disabled={enCours || pin.length !== 6 || selection.length === 0}>
          {enCours ? 'Activation…' : 'Activer ces cycles'}
        </Button>
      </div>
    </div>
  );
}
