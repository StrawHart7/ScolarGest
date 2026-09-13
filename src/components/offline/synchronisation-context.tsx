'use client';

import * as React from 'react';
import { useConnectivity } from '@/components/connectivity/connectivity-context';
import {
  compterFile,
  enfiler,
  listerFile,
  viderFile,
  type DemandeMiseEnFile,
  type Gestionnaires,
} from '@/lib/offline/file-attente';
import type { OperationEnFile } from '@/lib/offline/db';
import { saisirNoteAction, soumettreNotesAction, demanderModificationAction } from '@/app/etablissement/notes/saisie/[evaluationId]/actions';
import { enregistrerVersementAction } from '@/app/etablissement/finances/factures/[id]/actions';
import { signalerIncidentAction } from '@/app/profil/support/actions';
import { memoriserIdentite } from '@/lib/offline/identite-locale';

/**
 * Moteur de synchronisation, monte une fois pour toute l'application
 * authentifiee (voir `AppLayout`).
 *
 * Il tient trois roles que les ecrans ne doivent pas reimplementer chacun de
 * leur cote : la mise en file, le vidage au retour du reseau, et le compte des
 * ecritures en attente affiche a l'utilisateur.
 *
 * **Les gestionnaires vivent ici et non dans `file-attente.ts`.** Ce dernier
 * doit rester testable sans Next ; c'est ce module, deja client, qui connait
 * les Server Actions.
 *
 * Les Server Actions du depot **rendent** un message d'erreur au lieu de lever.
 * Un gestionnaire qui se contenterait de les appeler tiendrait donc tout echec
 * pour un succes et viderait la file en perdant son contenu : d'ou la
 * conversion explicite en exception.
 */

export interface ResultatMiseEnFile {
  cle: string;
  /** `true` si l'ecriture est **partie pour de vrai** avant de rendre la main. */
  envoyee: boolean;
}

interface CtxSynchronisation {
  enAttente: number;
  operations: OperationEnFile[];
  /**
   * Depose une ecriture dans la file, **tente aussitot de l'envoyer**, et dit
   * si elle est passee.
   *
   * Le retour a change le 2026-09-13, apres un versement encaisse deux fois en
   * production. Voir `mettreEnFile` plus bas : rendre la seule cle laissait
   * l'appelant annoncer « mis en attente » pour une ecriture deja enregistree.
   */
  mettreEnFile: (
    demande: Omit<DemandeMiseEnFile, 'userId' | 'etablissementId'>,
  ) => Promise<ResultatMiseEnFile>;
  /** Tente un envoi immediat. Sans effet s'il n'y a rien a envoyer. */
  synchroniser: () => Promise<void>;
  enCours: boolean;
}

const Contexte = React.createContext<CtxSynchronisation | null>(null);

/** Convertit le « message d'erreur rendu » des Server Actions en exception. */
async function exigerSucces(promesse: Promise<string | null>): Promise<void> {
  const message = await promesse;
  if (message) throw new Error(message);
}

const GESTIONNAIRES: Gestionnaires = {
  SAISIE_NOTE: async (charge) =>
    exigerSucces(saisirNoteAction(charge as Parameters<typeof saisirNoteAction>[0])),

  SOUMISSION_NOTES: async (charge, cle) =>
    exigerSucces(soumettreNotesAction((charge as { evaluationId: string }).evaluationId, cle)),

  DEMANDE_CORRECTION: async (charge, cle) =>
    exigerSucces(
      demanderModificationAction(charge as Parameters<typeof demanderModificationAction>[0], cle),
    ),

  // Depose depuis la page d'erreur, ou le fournisseur n'est pas monte : la
  // mise en file s'y fait en direct, mais le vidage repasse bien par ici.
  SIGNALEMENT_INCIDENT: async (charge, cle) =>
    exigerSucces(
      signalerIncidentAction(charge as Parameters<typeof signalerIncidentAction>[0], cle),
    ),

  PAIEMENT: async (charge, cle) => {
    // L'action attend un `FormData` : elle est aussi appelee par un vrai
    // formulaire. On le reconstruit plutot que de dupliquer la validation.
    const champs = charge as Record<string, string>;
    const donnees = new FormData();
    for (const [nom, valeur] of Object.entries(champs)) {
      if (valeur !== undefined && valeur !== null) donnees.set(nom, String(valeur));
    }
    donnees.set('cleOperation', cle);
    await exigerSucces(enregistrerVersementAction(null, donnees));
  },
};

export function SynchronisationProvider({
  userId,
  etablissementId,
  cheminsAPrecharger = [],
  children,
}: {
  userId: string;
  etablissementId: string;
  /** Destinations du role connecte, mises en cache tant qu'il y a du reseau. */
  cheminsAPrecharger?: string[];
  children: React.ReactNode;
}) {
  const { enLigne } = useConnectivity();
  const [operations, setOperations] = React.useState<OperationEnFile[]>([]);
  const [enCours, setEnCours] = React.useState(false);
  const verrou = React.useRef(false);

  const rafraichir = React.useCallback(async () => {
    setOperations(await listerFile(userId));
  }, [userId]);

  const synchroniser = React.useCallback(async () => {
    // Un seul vidage a la fois. Deux vidages concurrents enverraient la meme
    // operation deux fois ; le serveur la reconnaitrait comme rejeu, mais on
    // aurait paye deux allers-retours sur une connexion qui vient a peine de
    // revenir.
    if (verrou.current) return;
    verrou.current = true;
    setEnCours(true);
    try {
      await viderFile(userId, GESTIONNAIRES);
      await rafraichir();
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  }, [userId, rafraichir]);

  /**
   * Depose puis **tente immediatement** l'envoi.
   *
   * ## Le defaut que cette tentative repare
   *
   * Cette fonction se contentait de deposer et de rafraichir l'affichage.
   * L'envoi n'avait ensuite lieu qu'a trois occasions : une **transition**
   * hors-ligne vers en-ligne, le filet de rattrapage toutes les cinq minutes,
   * ou un clic sur « Envoyer maintenant ».
   *
   * Or l'ecran met en file quand `navigator.onLine` dit faux — et il ment. Si
   * le reseau etait en realite disponible, aucune transition ne se produisait,
   * donc **rien ne partait**, pendant que le bandeau affichait « Envoi en cours
   * des que possible ». Jusqu'a cinq minutes d'une phrase fausse.
   *
   * C'est ce qui a coute un encaissement double le 2026-09-13 : la Comptable a
   * vu son ecriture toujours en attente, en a conclu qu'elle n'etait pas
   * passee, et a resoumis. Deux versements de 57 000 F a 2,44 secondes
   * d'intervalle, chacun avec sa propre cle d'idempotence — donc deux
   * operations legitimes du point de vue du serveur.
   *
   * Une tentative immediate coute peu quand elle echoue : le premier recul est
   * de cinq secondes (`RECULS_MS`). Elle rapporte beaucoup quand elle
   * reussit — le bandeau n'apparait jamais, et il n'y a rien qui invite a
   * recliquer.
   *
   * **Limite connue** : si un vidage est deja en cours, `synchroniser` rend la
   * main sans rien faire (le verrou), et `viderFile` a fige sa liste avant
   * notre depot. L'ecriture attend alors le declencheur suivant, et
   * `envoyee` vaut `false` — ce qui est la verite, donc l'appelant dit la
   * bonne chose. La fenetre est etroite et honnetement annoncee plutot que
   * masquee par une attente active.
   */
  const mettreEnFile = React.useCallback(
    async (demande: Omit<DemandeMiseEnFile, 'userId' | 'etablissementId'>) => {
      const cle = await enfiler({ ...demande, userId, etablissementId });

      // Pas de `rafraichir()` avant la tentative : afficher le bandeau pour le
      // retirer une seconde plus tard se lit comme un defaut d'affichage, pas
      // comme un envoi reussi. `synchroniser` rafraichit a la fin.
      await synchroniser();

      // On relit la file plutot que de se fier au bilan de `viderFile` : seule
      // l'absence de **cette** cle prouve que **cette** ecriture est partie.
      // Un bilan agrege dirait « une envoyee » alors que c'en serait une autre.
      const restantes = await listerFile(userId);
      return { cle, envoyee: !restantes.some((o) => o.cle === cle) };
    },
    [userId, etablissementId, synchroniser],
  );

  React.useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  // `error.tsx` remplace la page en panne, donc ce fournisseur n'y est pas
  // monte — et c'est justement la qu'il faut pouvoir mettre un signalement en
  // file. On laisse donc de quoi retrouver le bon casier local. Voir
  // `identite-locale.ts` : ce n'est pas une identite de confiance.
  React.useEffect(() => {
    memoriserIdentite({ userId, etablissementId });
  }, [userId, etablissementId]);

  // Retour du reseau : evenementiel, pas de scrutation. Une coupure de six
  // heures ne doit pas coûter six heures de requetes.
  const etaitEnLigne = React.useRef(enLigne);
  React.useEffect(() => {
    const revient = enLigne && !etaitEnLigne.current;
    etaitEnLigne.current = enLigne;
    if (revient) void synchroniser();
  }, [enLigne, synchroniser]);

  // Un filet de rattrapage espace : le retour du reseau peut avoir eu lieu
  // avant le montage de la page, et `navigator.onLine` ment quand une
  // interface est active sans acces reel a Internet — cas frequent d'un
  // partage de connexion sans credit.
  React.useEffect(() => {
    const minuteur = setInterval(() => {
      if (enLigne) void synchroniser();
    }, 5 * 60_000);
    return () => clearInterval(minuteur);
  }, [enLigne, synchroniser]);

  /**
   * Prepare les destinations du menu pendant qu'il y a du reseau.
   *
   * Sans cela, seules les pages deja ouvertes survivent a une coupure, et
   * l'utilisateur qui change de page tombe sur l'ecran d'erreur du navigateur.
   * Personne ne visite chaque page « au cas ou » avant une coupure qui ne
   * previent pas.
   *
   * Retarde de quelques secondes : au chargement, la page courante et ses
   * ressources ont la priorite sur des pages que l'utilisateur n'a pas encore
   * demandees. Sur une connexion togolaise, se disputer la bande passante avec
   * l'ecran affiche serait un mauvais echange.
   */
  React.useEffect(() => {
    if (!enLigne || cheminsAPrecharger.length === 0) return;
    const minuteur = setTimeout(() => {
      try {
        navigator.serviceWorker?.controller?.postMessage({
          type: 'PRECHARGER_PAGES',
          urls: cheminsAPrecharger,
        });
      } catch {
        // Pas de service worker actif : la consultation hors ligne se limitera
        // aux pages reellement visitees. Rien a signaler a l'utilisateur.
      }
    }, 4_000);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enLigne, cheminsAPrecharger.join('|')]);

  const valeur = React.useMemo<CtxSynchronisation>(
    () => ({ enAttente: operations.length, operations, mettreEnFile, synchroniser, enCours }),
    [operations, mettreEnFile, synchroniser, enCours],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

/**
 * Rend `null` hors du fournisseur plutot que de lever.
 *
 * Un formulaire peut vivre sur une page publique (`/login`, la landing) ou
 * aucune synchronisation n'a de sens. Lever y transformerait l'absence de file
 * en ecran blanc.
 */
export function useSynchronisation(): CtxSynchronisation | null {
  return React.useContext(Contexte);
}

export { compterFile };
