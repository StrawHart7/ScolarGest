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
import { randomUUID } from 'node:crypto';
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

/**
 * Les trous connus, assumes, et dates.
 *
 * Sans cette liste le script sortirait en echec pour toujours, et un script qui
 * echoue toujours ne garde plus rien : on cesse de le lire. Une entree ici
 * n'excuse pas le trou, elle le rend **bruyant et nomme** en attendant qu'il
 * soit ferme. La retirer est ce qui transforme la sonde en garde-fou pour ce
 * trou-la.
 */
const TOLERES: Record<string, string> = {};

/**
 * Enregistre le verdict d'un essai d'ecriture.
 *
 * **`ligne` est aussi decisif que `erreur`, et c'est un piege qui a failli
 * passer.** La RLS ne leve pas sur un UPDATE ou un DELETE : elle **filtre les
 * lignes**. Un UPDATE refuse revient donc sans erreur et sans ligne, et une
 * sonde qui ne regarderait que l'erreur annoncerait « PASSE » sur une ecriture
 * qui n'a rien ecrit. C'est arrive le 2026-09-11 : le refus d'un tarif a ete
 * lu comme un succes, avec « ecrit le tarif undefined » pour seul indice.
 *
 * Un INSERT, lui, leve bien — la clause `with check` produit une erreur.
 */
function noter(intitule: string, erreur: unknown, ligne: unknown, detailSiPasse: string): void {
  if (erreur) {
    essais.push({
      intitule,
      refuse: true,
      detail: String((erreur as { message?: string })?.message ?? erreur).slice(0, 140),
    });
    return;
  }
  if (ligne === null || ligne === undefined) {
    essais.push({
      intitule,
      refuse: true,
      detail: 'aucune ligne touchee — la politique a filtre sans lever',
    });
    return;
  }
  essais.push({ intitule, refuse: false, detail: detailSiPasse });
}

/** Une facture non annulee de l'ecole de l'appelant, pour viser une cible reelle. */
async function trouverFacture(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb.from('facture_eleve').select('id').neq('statut', 'ANNULE').limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * Fait reclamer une cle d'idempotence par **un autre compte** de la meme ecole,
 * et la rend en clair.
 *
 * C'est la seule facon d'eprouver le detournement sans dependre du secret de la
 * cle : on simule un attaquant qui l'a obtenue autrement — un journal, une
 * capture d'ecran, une version anterieure du produit qui la laissait lire.
 *
 * La reclamation est abandonnee ensuite par son proprietaire legitime, seul a
 * pouvoir le faire, ce qui verifie au passage que le resserrement n'a pas
 * enferme l'auteur hors de sa propre operation.
 */
async function reclamerCleAvecAutreSession(): Promise<string | null> {
  const email = process.env.E2E_SECRETAIRE_EMAIL;
  const mdp = process.env.E2E_SECRETAIRE_PASSWORD;
  if (!email || !mdp || !URL || !ANON) return null;

  const autre = createClient(URL, ANON);
  const { error } = await autre.auth.signInWithPassword({ email, password: mdp });
  if (error) return null;

  const cle = randomUUID();
  const { error: erreurReclame } = await autre.rpc('fn_reclamer_operation', {
    p_cle: cle,
    p_type: 'PAIEMENT',
  });
  if (erreurReclame) return null;

  cleANettoyer = { client: autre, cle };
  return cle;
}

let cleANettoyer: { client: SupabaseClient; cle: string } | null = null;

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
    noter('Enseignant insere un paiement', error, data, `ecrit le paiement ${data?.id}`);
    if (data?.id) aNettoyer.push({ table: 'paiement', id: data.id });
  } else {
    noter('Enseignant insere un paiement', new Error('aucune facture lisible'), null, '');
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
    noter('Enseignant met a jour un tarif', error, data, `ecrit le tarif ${data?.id}`);
  } else {
    noter('Enseignant met a jour un tarif', new Error('aucun tarif lisible'), null, '');
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
    noter('Enseignant se promeut DIRECTEUR', error, data, `role ecrit : ${data?.role}`);
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

  // --- 3 bis. Reecrire une note hors de son affectation.
  //
  // La granularite de la politique est le **couple (classe, matiere)**, pas la
  // classe : un professeur de maths enseigne peut-etre dans les treize classes,
  // il n'y enseigne pas la philosophie. Un premier essai filtrait sur la seule
  // classe et ne trouvait donc aucune cible sur le compte de demonstration —
  // il concluait « essai impossible » sur une faille bien reelle.
  {
    // `affectation_enseignant` est lisible par **tout l'etablissement**. Sans le
    // filtre sur son propre `enseignantId`, on compare aux affectations des 113
    // lignes de l'ecole au lieu des cinq de l'appelant, et la sonde conclut
    // « ce compte enseigne tout » sur une faille bien reelle — 26 957 notes
    // etaient hors de son affectation. Defaut de la sonde corrige le
    // 2026-09-11, apres l'avoir cru concluante.
    const { data: monEnseignant } = await sb
      .from('enseignant')
      .select('id')
      .eq('utilisateurId', monId)
      .maybeSingle();

    const { data: mesAffectations } = monEnseignant
      ? await sb
          .from('affectation_enseignant')
          .select('"classeId", "matiereId"')
          .eq('enseignantId', monEnseignant.id)
      : { data: [] };

    const miennes = new Set(
      (mesAffectations ?? []).map((a) => `${a.classeId}|${a.matiereId}`),
    );
    console.log(`Couples (classe, matiere) affectes a ce compte : ${miennes.size}`);

    const { data: evals } = await sb
      .from('evaluation')
      .select('id, "classeId", "matiereId"')
      .limit(500);
    const horsAffectation = (evals ?? []).find(
      (e) => !miennes.has(`${e.classeId}|${e.matiereId}`),
    );

    if (!horsAffectation) {
      noter(
        'Enseignant reecrit une note hors de son affectation',
        new Error('ce compte enseigne tous les couples (classe, matiere) lisibles'),
        null,
        '',
      );
    } else {
      const { data: notes } = await sb
        .from('note')
        .select('id, valeur, observation')
        .eq('evaluationId', horsAffectation.id)
        .limit(1);
      const note = notes?.[0];
      if (!note) {
        noter(
          'Enseignant reecrit une note hors de son affectation',
          new Error('aucune note sur cette evaluation'),
          null,
          '',
        );
      } else {
        const { data, error } = await sb
          .from('note')
          .update({ valeur: 19.5 })
          .eq('id', note.id)
          .select('id, valeur')
          .maybeSingle();
        noter(
          'Enseignant reecrit une note hors de son affectation',
          error,
          data,
          `note ${note.id} : ${note.valeur} -> ${data?.valeur}`,
        );
        if (data) {
          await sb.from('note').update({ valeur: note.valeur }).eq('id', note.id);
          console.log(`valeur d'origine ${note.valeur} restauree sur la note ${note.id}`);
        }
      }
    }
  }

  // --- 4. Les cles d'idempotence d'un collegue : lecture, puis detournement.
  //
  // Deux essais distincts, et le second ne depend **pas** du premier. Une cle
  // peut fuiter autrement que par la table — un journal, une capture d'ecran,
  // une version anterieure du produit. Verifier le detournement seulement
  // quand la lecture le permet reviendrait a faire reposer la securite sur le
  // secret de la cle, alors qu'elle doit reposer sur l'autorisation.
  //
  // D'ou une seconde session, celle de la Secretaire, qui reclame une cle bien
  // reelle et la confie a l'Enseignant. Une cle en vol achevee avec un resultat
  // forge fait disparaitre un encaissement en annoncant qu'il est passe.
  {
    const { data, error } = await sb.from('operation_client').select('cle, "userId"').limit(20);
    const autrui = (data ?? []).filter((l) => l.userId !== monId);
    noter(
      "Enseignant lit les cles d'operation de ses collegues",
      error,
      autrui.length > 0 ? autrui : null,
      `${autrui.length} cle(s) d'autrui lisible(s)`,
    );

    const cleDAutrui = autrui[0]?.cle ?? (await reclamerCleAvecAutreSession());
    if (cleDAutrui) {
      const { error: erreurRpc } = await sb.rpc('fn_achever_operation', {
        p_cle: cleDAutrui,
        p_resultat: { sonde: true },
      });
      noter(
        "Enseignant acheve l'operation d'un collegue",
        erreurRpc,
        // Le RPC ne rend rien : son refus se lit a l'exception, ou a
        // l'absence d'effet, que l'appelant ne peut pas distinguer. On note
        // donc l'appel comme passe s'il n'a pas leve — c'est le pire cas, et
        // une sonde de securite doit se placer au pire cas.
        'appel accepte',
        "appel accepte sans controle d'autorisation",
      );
    } else {
      noter(
        "Enseignant acheve l'operation d'un collegue",
        new Error('aucune cle de collegue obtenable pour tenter le detournement'),
        null,
        '',
      );
    }
  }

  // ----------------------------------------------------------- nettoyage --
  // La reclamation de test est abandonnee par son auteur legitime. Si cela
  // echoue, le resserrement a enferme l'auteur hors de sa propre operation :
  // c'est un defaut aussi grave que celui qu'on traque, dans l'autre sens.
  if (cleANettoyer) {
    const { error } = await cleANettoyer.client.rpc('fn_abandonner_operation', {
      p_cle: cleANettoyer.cle,
    });
    console.log(
      error
        ? `NETTOYAGE MANUEL REQUIS : operation_client cle ${cleANettoyer.cle} (${error.message})`
        : `reclamation de test ${cleANettoyer.cle} abandonnee par son auteur`,
    );
  }

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
  const regressions = passes.filter((e) => !(e.intitule in TOLERES));
  const tolerees = passes.filter((e) => e.intitule in TOLERES);

  if (tolerees.length > 0) {
    console.log('\n--- Trous connus, encore ouverts ---');
    for (const e of tolerees) console.log(`  ${e.intitule}\n    ${TOLERES[e.intitule]}`);
  }

  console.log(
    `\n${essais.length - passes.length} refuse(s), ${tolerees.length} tolere(s), ${regressions.length} regression(s).`,
  );

  if (regressions.length > 0) {
    console.error('\nECHEC : un role a obtenu une ecriture que son role interdit.');
    for (const e of regressions) console.error(`  ${e.intitule} — ${e.detail}`);
    process.exit(1);
  }
  console.log('Aucune regression : tout ce qui devait etre refuse l\'a ete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
