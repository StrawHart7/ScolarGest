/**
 * Un role peut-il ecrire ce que son role interdit, en passant a cote des
 * Server Actions ?
 *
 * ## Pourquoi ce script existe
 *
 * `verifier-isolation.ts` repond a « une ecole voit-elle une autre ecole ». Il
 * ne repond pas a « un enseignant peut-il encaisser », et le 2026-09-11 la
 * reponse etait oui : six essais sur six ont reussi. La cause tenait en une
 * phrase — les gardes de role vivent dans les Server Actions, que l'appelant
 * peut sauter. L'URL du projet et la cle anon sont dans le bundle client par
 * construction, un utilisateur connecte detient un jeton valide, et il parle
 * donc a PostgREST directement. La RLS etait alors la seule barriere, et elle
 * comparait l'etablissement sans regarder le role.
 *
 * ## La methode
 *
 * Client anon **plus session reelle**, jamais la cle service-role, qui
 * contournerait precisement ce qu'on verifie. C'est exactement ce que fait le
 * navigateur d'un utilisateur connecte.
 *
 * Chaque essai decrit ce qu'il tente et ce qu'il attend. Un essai qui **passe**
 * alors qu'il devrait etre refuse fait sortir le script en code 1 : c'est une
 * regression de securite, pas un avertissement.
 *
 * ## Usage
 *
 *   npx tsx scripts/verifier-separation-roles.ts
 *
 * Identifiants pris dans `.env.e2e` (`E2E_ENSEIGNANT_EMAIL` / `_PASSWORD`).
 * Sans eux, le script se saute plutot que d'echouer : le depot reste clonable
 * sans secrets, et un saut visible vaut mieux qu'un rouge permanent qu'on
 * finit par ignorer.
 *
 * Toute ligne ecrite par un essai qui reussit est retiree avant de rendre la
 * main, et le script le dit explicitement s'il n'y parvient pas.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.e2e' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.E2E_ENSEIGNANT_EMAIL;
const MDP = process.env.E2E_ENSEIGNANT_PASSWORD;

interface Essai {
  intitule: string;
  /** `true` si l'acces a ete refuse, c'est-a-dire si le produit tient. */
  refuse: boolean;
  detail: string;
}

const essais: Essai[] = [];
const aNettoyer: { table: string; id: string }[] = [];

function noter(intitule: string, erreur: unknown, detailSiPasse: string): void {
  const refuse = Boolean(erreur);
  essais.push({
    intitule,
    refuse,
    detail: refuse
      ? String((erreur as { message?: string })?.message ?? erreur).slice(0, 140)
      : detailSiPasse,
  });
}

/** Une facture non annulee de l'ecole de l'appelant, pour viser une cible reelle. */
async function trouverFacture(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb.from('facture_eleve').select('id').neq('statut', 'ANNULE').limit(1);
  return data?.[0]?.id ?? null;
}

async function main(): Promise<void> {
  if (!URL || !ANON) throw new Error('NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY absents de .env');
  if (!EMAIL || !MDP) {
    console.log('E2E_ENSEIGNANT_EMAIL / E2E_ENSEIGNANT_PASSWORD non renseignes — verification sautee.');
    return;
  }

  const sb = createClient(URL, ANON);
  const { data: auth, error: erreurAuth } = await sb.auth.signInWithPassword({
    email: EMAIL,
    password: MDP,
  });
  if (erreurAuth || !auth.session) throw new Error(`Connexion impossible : ${erreurAuth?.message}`);

  const meta = auth.session.user.app_metadata as { role?: string; etablissement_id?: string };
  console.log(`Session : ${EMAIL}`);
  console.log(`  role          : ${meta.role}`);
  console.log(`  etablissement : ${meta.etablissement_id}\n`);

  // Le script n'a de sens que joue par un enseignant : c'est le role le plus
  // restreint, donc celui dont les refus sont les plus parlants.
  if (meta.role !== 'ENSEIGNANT') {
    throw new Error(`Ce compte porte le role ${meta.role}, or la sonde attend ENSEIGNANT.`);
  }
  const monId = auth.session.user.id;

  // --- 1. Encaisser. Reserve a SECRETAIRE et COMPTABLE. --------------------
  const facture = await trouverFacture(sb);
  if (facture) {
    const { data, error } = await sb
      .from('paiement')
      .insert({
        factureId: facture,
        montant: 1,
        modePaiement: 'ESPECES',
        datePaiement: new Date().toISOString().slice(0, 10),
        reference: 'SONDE-SECURITE',
      })
      .select('id')
      .maybeSingle();
    noter('Enseignant insere un paiement', error, `ecrit le paiement ${data?.id}`);
    if (data?.id) aNettoyer.push({ table: 'paiement', id: data.id });
  } else {
    noter('Enseignant insere un paiement', new Error('aucune facture lisible'), '');
  }

  // --- 2. Modifier un tarif. Reserve a SECRETAIRE et COMPTABLE. -----------
  const { data: tarif } = await sb.from('tarif_scolaire').select('id, montant').limit(1).maybeSingle();
  if (tarif) {
    const { data, error } = await sb
      .from('tarif_scolaire')
      .update({ montant: tarif.montant })
      .eq('id', tarif.id)
      .select('id')
      .maybeSingle();
    noter('Enseignant met a jour un tarif', error, `ecrit le tarif ${data?.id}`);
  } else {
    noter('Enseignant met a jour un tarif', new Error('aucun tarif lisible'), '');
  }

  // --- 3. Se promouvoir. Le role applicatif vient du JWT, donc cela ne donne
  //        aucun droit — mais l'ecriture doit quand meme etre refusee.
  {
    const { data, error } = await sb
      .from('utilisateur')
      .update({ role: 'DIRECTEUR' })
      .eq('id', monId)
      .select('id, role')
      .maybeSingle();
    noter('Enseignant se promeut DIRECTEUR', error, `role ecrit : ${data?.role}`);
    if (data) {
      const { error: erreurRetour } = await sb
        .from('utilisateur')
        .update({ role: 'ENSEIGNANT' })
        .eq('id', monId);
      console.log(
        erreurRetour
          ? `REPARATION MANUELLE REQUISE : remettre ${EMAIL} en ENSEIGNANT (${erreurRetour.message})`
          : 'role remis a ENSEIGNANT',
      );
    }
  }

  // --- 4. Lire les cles d'idempotence d'un collegue, puis achever son
  //        operation. Une cle en vol achevee avec un resultat forge fait
  //        disparaitre un encaissement en annoncant qu'il est passe.
  {
    const { data, error } = await sb.from('operation_client').select('cle, "userId"').limit(20);
    const autrui = (data ?? []).filter((l) => l.userId !== monId);
    noter(
      "Enseignant lit les cles d'operation de ses collegues",
      error ?? (autrui.length === 0 ? new Error('aucune ligne d\'un autre utilisateur visible') : null),
      `${autrui.length} cle(s) d'autrui lisible(s)`,
    );

    if (autrui[0]) {
      const { error: erreurRpc } = await sb.rpc('fn_achever_operation', {
        p_cle: autrui[0].cle,
        p_resultat: { sonde: true },
      });
      noter(
        "Enseignant acheve l'operation d'un collegue",
        erreurRpc,
        'appel accepte sans controle d\'autorisation',
      );
    }
  }

  // ----------------------------------------------------------- nettoyage --
  for (const ligne of aNettoyer) {
    const { error } = await sb.from(ligne.table).delete().eq('id', ligne.id);
    console.log(
      error
        ? `NETTOYAGE MANUEL REQUIS : ${ligne.table} ${ligne.id} (${error.message})`
        : `nettoye : ${ligne.table} ${ligne.id}`,
    );
  }

  // ------------------------------------------------------------ verdicts --
  console.log('\n--- Verdicts ---');
  for (const e of essais) {
    console.log(`${(e.refuse ? 'REFUSE' : 'PASSE').padEnd(7)} ${e.intitule}`);
    if (e.detail) console.log(`        ${e.detail}`);
  }

  const passes = essais.filter((e) => !e.refuse);
  console.log(`\n${passes.length} essai(s) passe(s) sur ${essais.length}.`);
  if (passes.length > 0) {
    console.error('\nECHEC : un role a obtenu une ecriture que son role interdit.');
    process.exit(1);
  }
  console.log('Tous les essais ont ete refuses.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
