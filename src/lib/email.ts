import 'server-only';

/**
 * Envoi de courriels applicatifs, via l'API REST de Resend.
 *
 * **À ne pas confondre avec les mails d'authentification.** Les invitations et
 * les réinitialisations de mot de passe partent de Supabase Auth, qui utilise
 * déjà Resend comme SMTP et ses propres gabarits. Ce module sert les mails que
 * l'application décide d'envoyer elle-même — aujourd'hui les relances
 * d'échéance d'abonnement.
 *
 * Appel HTTP direct plutôt que le paquet `resend` : une dépendance de plus
 * pour un unique POST JSON, sur un projet qui écrit déjà son propre ZIP et ses
 * propres graphes, ne se justifie pas.
 *
 * **N'échoue jamais bruyamment.** Un mail qui ne part pas ne doit pas faire
 * échouer le balayage qui l'a déclenché : les autres écoles doivent être
 * traitées. L'échec est renvoyé à l'appelant, qui le consigne — c'est ce que
 * fait `relance_abonnement.erreur`, pour qu'un problème d'envoi soit visible
 * plutôt que silencieux.
 */

export interface MessageEmail {
  destinataires: string[];
  sujet: string;
  /** Corps en texte brut. Converti en HTML simple pour la partie riche. */
  texte: string;
}

export interface ResultatEnvoi {
  ok: boolean;
  /** Renseigné en cas d'échec, destiné au journal, pas à l'utilisateur. */
  erreur?: string;
}

/**
 * Expéditeur. Le domaine doit être vérifié chez Resend, faute de quoi l'API
 * refuse l'envoi — c'est le cas de `scolargest.com`, déjà utilisé par les
 * mails d'authentification.
 */
const EXPEDITEUR = process.env.EMAIL_EXPEDITEUR ?? 'ScolarGest <contact@scolargest.com>';

/** Échappe le texte avant de le couler dans le gabarit HTML. */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Gabarit HTML minimal : styles en ligne uniquement.
 *
 * Aucun client de messagerie ne garantit le support d'une feuille de style
 * externe, et beaucoup suppriment les balises `<style>`. Un gabarit sobre et
 * en ligne s'affiche partout ; une mise en page ambitieuse s'affiche bien
 * chez soi et casse chez le destinataire.
 */
function enveloppeHtml(texte: string): string {
  const paragraphes = texte
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${echapper(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1c1b1f;max-width:560px;margin:0 auto;padding:24px">
${paragraphes}
<hr style="border:none;border-top:1px solid #e5e2e6;margin:24px 0">
<p style="margin:0;font-size:13px;color:#5d5b62">ScolarGest — gestion des établissements scolaires</p>
</div>`;
}

export async function envoyerEmail(message: MessageEmail): Promise<ResultatEnvoi> {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    return { ok: false, erreur: 'RESEND_API_KEY absente : aucun envoi possible.' };
  }
  const destinataires = message.destinataires.filter((d) => d.includes('@'));
  if (destinataires.length === 0) {
    return { ok: false, erreur: 'Aucun destinataire valide.' };
  }

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${cle}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: EXPEDITEUR,
        to: destinataires,
        subject: message.sujet,
        text: message.texte,
        html: enveloppeHtml(message.texte),
      }),
    });

    if (!reponse.ok) {
      // Le corps porte le motif exact (domaine non vérifié, quota, adresse
      // refusée). Le perdre rendrait tout diagnostic impossible.
      const corps = await reponse.text().catch(() => '');
      return { ok: false, erreur: `Resend ${reponse.status} — ${corps.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    // Les erreurs réseau ne sont pas toujours des `Error` : même prudence que
    // pour les erreurs Supabase et FedaPay.
    const raison =
      e instanceof Error
        ? e.message
        : typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Échec réseau inconnu.';
    return { ok: false, erreur: raison };
  }
}
