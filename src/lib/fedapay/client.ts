import 'server-only';
import { FedaPay, Transaction, Webhook, SignatureVerificationError } from 'fedapay';

/**
 * Configuration du SDK FedaPay. Point d'entrée unique côté serveur.
 *
 * `server-only` en tête : `FEDAPAY_SECRET_KEY` ne doit jamais atterrir dans un
 * bundle client. L'import échoue à la compilation si un composant client
 * remonte jusqu'ici, ce qui vaut mieux qu'une clé secrète découverte en
 * production dans le code source d'une page.
 *
 * Le SDK officiel est utilisé plutôt qu'un simple `fetch` pour une seule
 * raison, mais elle est décisive : la vérification de la signature de webhook.
 * La documentation publique ne décrit pas l'algorithme de
 * `X-FEDAPAY-SIGNATURE`, seulement l'appel `Webhook.constructEvent`. Le
 * réimplémenter à l'aveugle donnerait soit un webhook qui rejette tout, soit —
 * bien pire — un qui accepte des charges forgées et ouvre des abonnements
 * gratuits.
 */

export { OPERATEURS } from './operateurs';
import type { Operateur } from './operateurs';
export type { Operateur };

let configure = false;

function configurer(): void {
  if (configure) return;
  const cle = process.env.FEDAPAY_SECRET_KEY;
  if (!cle) {
    throw new Error(
      "FEDAPAY_SECRET_KEY n'est pas définie : le paiement en ligne est indisponible.",
    );
  }
  FedaPay.setApiKey(cle);
  // 'sandbox' par défaut, et c'est volontaire : une variable oubliée doit
  // produire un paiement de test, jamais un vrai débit.
  FedaPay.setEnvironment(process.env.FEDAPAY_ENVIRONMENT === 'live' ? 'live' : 'sandbox');
  configure = true;
}

export interface IntentionPaiement {
  description: string;
  /** Montant en francs CFA, entier. */
  montant: number;
  callbackUrl: string;
  client: {
    nom: string;
    prenom: string;
    email: string;
  };
}

export interface TransactionCreee {
  id: string;
  /** Page de paiement hébergée par FedaPay, utilisée comme repli. */
  url: string | null;
  token: string | null;
}

/**
 * Crée la transaction et son jeton de paiement.
 *
 * Le jeton sert aux deux parcours : `sendNowWithToken` pour le paiement mobile
 * dans l'application, et `url` pour la page hébergée en repli. On le génère
 * donc systématiquement, même quand l'école choisit le Mobile Money.
 */
export async function creerTransaction(
  intention: IntentionPaiement,
): Promise<{ transaction: unknown; creee: TransactionCreee }> {
  configurer();

  const transaction = (await Transaction.create({
    description: intention.description,
    amount: intention.montant,
    currency: { iso: 'XOF' },
    callback_url: intention.callbackUrl,
    customer: {
      firstname: intention.client.prenom,
      lastname: intention.client.nom,
      email: intention.client.email,
    },
  })) as unknown as {
    id: number | string;
    generateToken: () => Promise<{ token?: string; url?: string }>;
  };

  const jeton = await transaction.generateToken();

  return {
    transaction,
    creee: {
      id: String(transaction.id),
      url: jeton?.url ?? null,
      token: jeton?.token ?? null,
    },
  };
}

/**
 * Déclenche la demande de paiement sur le téléphone du client.
 *
 * Rien n'est débité à cet instant : l'opérateur envoie une invite de
 * confirmation sur le combiné. Le résultat n'arrive que par le webhook, ce qui
 * est exactement pourquoi la redirection de retour ne peut pas faire foi.
 *
 * **Le troisième argument est le corps de la requête, pas le numéro.** Le SDK
 * fait `params.token = token` puis poste `params` tel quel : il faut donc lui
 * passer `{ phone_number: { … } }`. L'exemple de la documentation officielle
 * écrit `sendNowWithToken(mode, token, phone_number)`, ce qui aplatit l'objet
 * et produit un `400 — Paramètre manquant ou la valeur est vide phone_number`.
 * Vérifié contre l'API sandbox : c'est bien l'enveloppe qui manquait.
 */
export async function declencherPaiementMobile(
  transaction: unknown,
  token: string,
  operateur: Operateur,
  telephone: string,
  pays: string,
): Promise<void> {
  configurer();
  const t = transaction as {
    sendNowWithToken: (
      mode: string,
      token: string,
      params: { phone_number: { number: string; country: string } },
    ) => Promise<unknown>;
  };
  await t.sendNowWithToken(operateur, token, {
    phone_number: { number: telephone, country: pays },
  });
}

/**
 * Vérifie la signature d'un webhook et renvoie l'événement.
 *
 * `corpsBrut` doit être le corps **non parsé** de la requête : la signature
 * porte sur les octets reçus. Lire le JSON d'abord puis le re-sérialiser
 * change l'ordre des clés et les espaces, et aucune signature ne validerait
 * jamais.
 */
export function verifierEvenement(
  corpsBrut: string,
  signature: string,
): { name: string; entity?: Record<string, unknown> } {
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("FEDAPAY_WEBHOOK_SECRET n'est pas définie : webhook non vérifiable.");
  }
  return Webhook.constructEvent(corpsBrut, signature, secret) as unknown as {
    name: string;
    entity?: Record<string, unknown>;
  };
}

/**
 * L'erreur est-elle un refus de signature ?
 *
 * **Les erreurs du SDK FedaPay ne sont pas des `Error`** — `e instanceof Error`
 * y est toujours faux, et `String(e)` donne « [object Object] ». Même piège que
 * les erreurs Supabase, déjà documenté dans `CLAUDE.md`. On teste donc la
 * classe exportée par le SDK, pas le texte du message : une signature refusée
 * doit répondre 400 (requête invalide), jamais 500, sinon FedaPay rejouerait
 * indéfiniment une charge qu'on refusera toujours.
 */
export function estErreurSignature(e: unknown): boolean {
  if (e instanceof SignatureVerificationError) return true;
  // Repli si le SDK est chargé deux fois (deux copies de la classe) : le nom
  // de constructeur survit là où `instanceof` échoue.
  const nom = (e as { constructor?: { name?: string } })?.constructor?.name;
  return nom === 'SignatureVerificationError';
}

/** Message lisible d'une erreur qui n'est pas forcément une `Error`. */
export function messageErreurFedapay(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null) {
    const message = (e as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim() !== '') return message;
  }
  return String(e);
}
