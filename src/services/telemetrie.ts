import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { createHash } from 'node:crypto';
import {
  nettoyerMeta,
  normaliserRoute,
  type MetaEvenement,
  type TypeEvenement,
} from '@/lib/telemetrie';

/**
 * Émission d'un événement vers le plan de contrôle de la Régie.
 *
 * ## Le principe qui gouverne ce fichier
 *
 * > La Régie n'est jamais sur le chemin critique d'une école.
 *
 * Donc : **cette fonction ne lève jamais.** Ni si la migration n'est pas
 * appliquée, ni si la base refuse l'écriture, ni si le réseau tombe. Un
 * encaissement qui échouerait parce qu'une télémétrie n'est pas passée serait
 * l'exact contraire de ce qu'on construit. Perdre un événement ne coûte rien ;
 * perdre un versement coûte une journée de caisse.
 *
 * C'est la seule fonction du dépôt qui avale ses erreurs **par conception** et
 * non par tolérance. `journaliserConnexion` fait de même, pour une raison
 * voisine : un incident sur la table d'audit ne doit pas empêcher de se
 * connecter.
 *
 * ## Le silence, et sa contrepartie
 *
 * Une panne silencieuse est précisément ce que ce dépôt reproche ailleurs. La
 * contrepartie est ici assumée et bornée :
 *
 * - le premier échec du processus est écrit une fois dans la console, avec sa
 *   cause ; les suivants sont tus, sinon une base indisponible remplirait les
 *   journaux de Vercel à la place des vraies erreurs ;
 * - le contrôle qui **prouve** que la chaîne fonctionne n'est pas un log, c'est
 *   `scripts/verifier-frontiere-regie.ts` plus le flux lui-même : un cockpit
 *   vide se voit immédiatement.
 *
 * ## La garde
 *
 * `requireRole` avec les quatre rôles d'école — donc les cinq avec le
 * SUPER_ADMIN, que l'extracteur ajoute toujours. Elle n'est pas la barrière :
 * la barrière est dans `public.emettre_evenement`, qui lit l'établissement et
 * le rôle du JWT vérifié et ne les reçoit jamais en paramètre. Une école ne
 * peut donc pas signer un événement du nom d'une autre, même en appelant la
 * fonction directement depuis PostgREST.
 *
 * La garde est là parce qu'une fonction de service qui ouvre un client Supabase
 * doit en avoir une, et parce qu'elle dit la vérité : tout rôle connecté émet,
 * personne d'autre.
 */

let echecSignale = false;

function signalerUneFois(contexte: string, cause: unknown): void {
  if (echecSignale) return;
  echecSignale = true;
  // Les erreurs Supabase ne sont pas des `Error` : extraire les champs plutôt
  // que d'afficher `[object Object]`.
  const e = cause as { message?: string; code?: string; hint?: string } | null;
  const details = [e?.message, e?.code, e?.hint].filter(Boolean).join(' · ') || String(cause);
  console.warn(
    `Télémétrie indisponible (${contexte}) : ${details}. ` +
      'Signalé une seule fois pour ce processus ; le produit continue normalement.',
  );
}

/**
 * Émet un événement. Ne lève jamais, ne bloque jamais l'appelant.
 *
 * L'appel est **attendu** plutôt que laissé flottant : en environnement
 * serverless, une promesse non attendue est tuée avec le processus dès que la
 * réponse est rendue, et l'événement se perdrait une fois sur deux sans que
 * rien ne le dise. Le coût est un aller-retour vers la base, sur des gestes
 * qui en font déjà plusieurs.
 */
export async function emettreEvenement(
  type: TypeEvenement,
  meta?: MetaEvenement,
): Promise<void> {
  try {
    await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');

    const { meta: propre, rejets } = nettoyerMeta(meta);
    if (rejets.length > 0) {
      // Un rejet est un défaut de code, pas un incident d'exploitation : la
      // base aurait refusé la ligne entière. Il se corrige en relisant
      // `src/lib/telemetrie.ts`.
      signalerUneFois(`meta refusée pour ${type}`, rejets.join(' ; '));
    }

    const supabase = createClient();
    const { error } = await supabase.rpc('emettre_evenement', {
      type_evenement: type,
      meta: propre,
    });
    if (error) signalerUneFois(type, error);
  } catch (cause) {
    signalerUneFois(type, cause);
  }
}

/** Bornes miroir de `public.signaler_erreur`, qui tronque aux mêmes valeurs. */
const MAX_NOM = 120;
const MAX_CODE = 40;

/**
 * Signale une erreur applicative au plan de contrôle.
 *
 * ## Ce que la Régie reçoit, et ce qu'elle ne reçoit pas
 *
 * Trois champs : un nom de classe d'erreur, une route normalisée, et le
 * `digest` de Next. **Ni message, ni pile d'appels** — `erreurs_regie` explique
 * pourquoi : un message Supabase cite la valeur fautive dans `details` et
 * `hint`, donc un nom d'élève ou un montant. Sentry a le détail ; la Régie a le
 * dénombrement, et les deux ne se confondent pas.
 *
 * Le `digest` mérite un mot : c'est une empreinte calculée par Next, et **le
 * seul identifiant commun** entre ce que l'utilisateur voit à l'écran, ce que
 * le support reçoit, ce que Sentry enregistre et ce que la Régie compte. Il ne
 * porte aucune donnée.
 *
 * ## L'empreinte est calculée ici, pas reçue
 *
 * Elle vient du serveur, à partir des trois champs déjà bornés. La recevoir de
 * l'appelant laisserait n'importe quelle session choisir dans quel groupe
 * ranger son erreur — donc fabriquer trois cents incidents distincts, ou au
 * contraire faire passer le sien pour un incident connu et déjà mis en
 * sourdine.
 *
 * ## Pourquoi pas un événement de plus
 *
 * `emettre_evenement` aurait pu porter la même information, et le vocabulaire
 * contenait d'ailleurs un type `erreur.applicative` — retiré avec ce
 * changement. Deux raisons de ne pas l'employer : le fait serait compté deux
 * fois, et surtout **le flux d'événements n'a aucune borne de débit**. Une page
 * prise dans une boucle de rechargement y déverserait des centaines de lignes
 * par minute, au moment précis où le cockpit doit rester lisible.
 * `signaler_erreur` borne en base à une occurrence par minute et par école.
 *
 * Ne lève jamais, pour la même raison que `emettreEvenement` : la page d'erreur
 * est le dernier écran utilisable, et une télémétrie qui la ferait tomber
 * remplacerait un incident par une panne.
 */
export async function signalerErreurApplicative(incident: {
  nom?: string | null;
  chemin?: string | null;
  reference?: string | null;
}): Promise<void> {
  try {
    await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');

    const nom = (incident.nom ?? '').trim().slice(0, MAX_NOM) || 'Error';
    const route = normaliserRoute(incident.chemin);
    const code = (incident.reference ?? '').trim().slice(0, MAX_CODE) || null;

    // Le séparateur ne peut apparaître dans aucun des trois champs : un nom
    // de classe est un identifiant, une route normalisée ne contient que des
    // minuscules, des tirets et `:id`, un digest est hexadécimal. Sans lui,
    // ('Ab', 'c') et ('A', 'bc') donneraient la même empreinte, donc deux
    // défauts distincts rangés sous la même ligne.
    const empreinte = createHash('sha256')
      .update([nom, route, code ?? ''].join('|'))
      .digest('hex');

    const supabase = createClient();
    const { error } = await supabase.rpc('signaler_erreur', {
      p_empreinte: empreinte,
      p_nom: nom,
      p_route: route,
      p_code: code,
    });
    if (error) signalerUneFois("signalement d'erreur", error);
  } catch (cause) {
    signalerUneFois("signalement d'erreur", cause);
  }
}
