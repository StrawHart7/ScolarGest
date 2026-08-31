import { NextResponse, type NextRequest } from 'next/server';
import { recevoirWebhookFedapay } from '@/services/paiement-fedapay';
import { estErreurSignature, messageErreurFedapay } from '@/lib/fedapay/client';

/**
 * Webhook FedaPay : le seul point où un abonnement devient réellement actif.
 *
 * Quatre contraintes, toutes apprises de la documentation ou du comportement
 * des passerelles de paiement en général.
 *
 * **1. Le corps doit être lu brut.** La signature porte sur les octets reçus.
 * Parser le JSON puis le re-sérialiser change l'ordre des clés et les espaces,
 * et aucune signature ne validerait jamais. D'où `request.text()` avant tout.
 *
 * **2. Cette route doit être exclue du `matcher` de `src/middleware.ts`.** Le
 * middleware redirige vers `/login` tout ce qui n'y est pas explicitement nié.
 * FedaPay recevrait un 307, l'interpréterait comme une livraison réussie, et
 * l'abonnement ne serait jamais activé — sans la moindre erreur nulle part.
 * C'est la panne la plus silencieuse de toute cette intégration.
 *
 * **3. Runtime Node, pas Edge.** Le SDK FedaPay utilise axios et des
 * primitives cryptographiques de Node.
 *
 * **4. On répond 200 même quand on ne fait rien.** Une transaction inconnue ou
 * un événement non géré ne sont pas des erreurs de FedaPay : renvoyer un code
 * d'échec le ferait rejouer indéfiniment. Seules la signature invalide (400)
 * et la panne interne (500) méritent un échec — cette dernière justement pour
 * que le rejeu ait lieu.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-fedapay-signature');
  if (!signature) {
    return NextResponse.json({ erreur: 'Signature absente.' }, { status: 400 });
  }

  const corpsBrut = await request.text();

  let resultat: { traite: boolean; raison: string };
  try {
    resultat = await recevoirWebhookFedapay(corpsBrut, signature);
  } catch (e) {
    // Signature invalide : la requête ne vient pas de FedaPay, ou a été
    // altérée. 400, et surtout aucun traitement. On teste la classe d'erreur
    // du SDK et non le texte du message : les erreurs FedaPay ne sont pas des
    // `Error`, et une comparaison de chaîne renverrait 500 — ce qui ferait
    // rejouer indéfiniment une charge qu'on refusera toujours.
    if (estErreurSignature(e)) {
      return NextResponse.json({ erreur: 'Signature invalide.' }, { status: 400 });
    }

    // Panne de notre côté : 500 pour que FedaPay rejoue. Le traitement étant
    // idempotent, un rejeu après remise en service est sans danger.
    console.error('[fedapay] echec de traitement du webhook', messageErreurFedapay(e));
    return NextResponse.json({ erreur: 'Traitement impossible.' }, { status: 500 });
  }

  return NextResponse.json({ recu: true, ...resultat });
}
