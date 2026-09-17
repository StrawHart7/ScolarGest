/**
 * Un role peut-il s'octroyer lui-meme les droits que son role lui refuse ?
 *
 * ## Pourquoi ce script existe, alors que `verifier-separation-roles.ts` existe
 *
 * Le 2026-09-11, les tables qui portent de l'argent et des notes ont recu des
 * politiques qui nomment les roles. C'etait la bonne correction, et elle tient.
 * Mais elle s'arrete au bord de la table : `note` demande desormais que
 * l'enseignant soit **affecte** a la classe et a la matiere, et cette
 * affectation se lit dans `affectation_enseignant`, dont la politique ne
 * regardait que l'etablissement.
 *
 * Autrement dit : la garde interroge une table que le garde peut ecrire.
 *
 * Ce script eprouve la **seconde ligne** — non plus « peut-il ecrire ce qui lui
 * est interdit », mais « peut-il se rendre autorise ». C'est la difference
 * entre forcer une porte et se fabriquer la cle.
 *
 * ## La methode
 *
 * Client anon **plus session reelle**, jamais la cle service-role. C'est
 * exactement ce dont dispose un enseignant connecte : l'URL du projet et la cle
 * anon sont dans le bundle client par construction, et son jeton est valide.
 *
 * Chaque essai dit ce qu'il tente et ce qu'il attend. Un essai qui **passe**
 * alors qu'il devrait etre refuse fait sortir le script en code 1.
 *
 * ## Usage
 *
 *   npx tsx scripts/verifier-escalade-roles.ts
 *
 * Identifiants dans `.env.e2e` (`E2E_ENSEIGNANT_EMAIL` / `_PASSWORD`). Sans
 * eux le script se saute plutot que d'echouer : le depot reste clonable sans
 * secrets, et un saut visible vaut mieux qu'un rouge permanent qu'on ignore.
 *
 * Toute ecriture qui aboutit est **defaite** avant de rendre la main, et le
 * script le dit s'il n'y parvient pas.
 */
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.e2e' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.E2E_ENSEIGNANT_EMAIL;
const MDP = process.env.E2E_ENSEIGNANT_PASSWORD;

interface Essai {
  intitule: string;
  /** `true` si l'acces a ete refuse, c'est-a-dire si le produit tient. */
  refuse: boolean;
  detail: string;
}

const essais: Essai[] = [];
/** Ce qu'il faudra defaire, dans l'ordre inverse de l'ecriture. */
const aDefaire: (() => Promise<void>)[] = [];

/**
 * Enregistre le verdict d'un essai d'ecriture.
 *
 * **`ligne` est aussi decisif que `erreur`.** La RLS ne leve pas sur un UPDATE
 * ni un DELETE : elle filtre les lignes. Un refus revient donc sans erreur et
 * sans ligne, et une sonde qui ne regarderait que l'erreur annoncerait
 * « PASSE » sur une ecriture qui n'a rien ecrit.
 */
function noter(intitule: string, erreur: unknown, lignes: unknown[] | null, detail: string): boolean {
  if (erreur) {
    essais.push({
      intitule,
      refuse: true,
      detail: String((erreur as { message?: string })?.message ?? erreur).slice(0, 140),
    });
    return false;
  }
  if (!lignes || lignes.length === 0) {
    essais.push({ intitule, refuse: true, detail: 'aucune ligne touchee — la politique a filtre sans lever' });
    return false;
  }
  essais.push({ intitule, refuse: false, detail });
  return true;
}

/** Un constat qui n'est pas une ecriture : lecture indue, droit obtenu. */
function constater(intitule: string, tenu: boolean, detail: string): void {
  essais.push({ intitule, refuse: tenu, detail });
}

async function main(): Promise<void> {
  if (!URL || !ANON) throw new Error('NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY absents');
  if (!EMAIL || !MDP) {
    console.log('E2E_ENSEIGNANT_EMAIL / _PASSWORD absents — sonde sautee.');
    return;
  }

  const sb = createClient(URL, ANON);
  const { data: session, error: erreurAuth } = await sb.auth.signInWithPassword({
    email: EMAIL,
    password: MDP,
  });
  if (erreurAuth || !session.user) throw new Error(`Connexion enseignant impossible : ${erreurAuth?.message}`);

  const role = (session.user.app_metadata as { role?: string }).role;
  const etablissement = (session.user.app_metadata as { etablissement_id?: string }).etablissement_id;
  if (role !== 'ENSEIGNANT') throw new Error(`Le compte de sonde porte le role ${role}, pas ENSEIGNANT`);
  console.log(`Connecte : ${EMAIL} — role ${role}, etablissement ${etablissement}\n`);

  // La fiche enseignant de l'appelant : c'est elle que l'affectation designe.
  const { data: fiche } = await sb
    .from('enseignant')
    .select('id')
    .eq('utilisateurId', session.user.id)
    .maybeSingle();
  if (!fiche) throw new Error("Ce compte n'a pas de fiche enseignant — la sonde ne peut pas viser juste");

  // ---------------------------------------------------------------------
  // 1. La chaine complete : s'auto-affecter, puis ecrire la ou l'affectation
  //    vient d'ouvrir la porte. C'est la raison d'etre du script.
  // ---------------------------------------------------------------------
  const { data: annee } = await sb
    .from('annee_scolaire')
    .select('id')
    .eq('etablissementId', etablissement)
    .eq('statut', 'ACTIVE')
    .maybeSingle();
  if (!annee) throw new Error("Aucune annee ACTIVE dans l'ecole de sonde");
  const { data: classes } = await sb
    .from('classe')
    .select('id, nom')
    .eq('anneeScolaireId', annee.id)
    .limit(50);
  const { data: matieres } = await sb.from('matiere').select('id, nom').limit(50);
  const { data: siennes } = await sb
    .from('affectation_enseignant')
    .select('classeId, matiereId')
    .eq('enseignantId', fiche.id);

  const deja = new Set((siennes ?? []).map((a) => `${a.classeId}|${a.matiereId}`));
  let cible: { classeId: string; matiereId: string; libelle: string } | null = null;
  for (const c of classes ?? []) {
    for (const m of matieres ?? []) {
      if (!deja.has(`${c.id}|${m.id}`)) {
        cible = { classeId: c.id, matiereId: m.id, libelle: `${m.nom} en ${c.nom}` };
        break;
      }
    }
    if (cible) break;
  }
  if (!cible) throw new Error('Pas de couple classe/matiere libre pour viser');

  console.log(`Cible choisie — une matiere que ce compte n'enseigne pas : ${cible.libelle}\n`);

  const { data: avant } = await sb.rpc('est_affecte', {
    p_classe: cible.classeId,
    p_matiere: cible.matiereId,
    p_annee: annee.id,
  });
  constater(
    'Point de depart : la garde refuse bien cette matiere',
    avant === false,
    `est_affecte() rend ${avant}`,
  );

  const { data: auto, error: erreurAuto } = await sb
    .from('affectation_enseignant')
    .insert({
      etablissementId: etablissement,
      enseignantId: fiche.id,
      classeId: cible.classeId,
      matiereId: cible.matiereId,
      anneeScolaireId: annee.id,
    })
    .select('id');
  const autoAffecte = noter(
    "1. S'affecter soi-meme a une matiere qu'on n'enseigne pas",
    erreurAuto,
    auto,
    `affectation ${auto?.[0]?.id} creee — ${cible.libelle}`,
  );
  if (autoAffecte && auto?.[0]) {
    const id = auto[0].id;
    aDefaire.push(async () => {
      await sb.from('affectation_enseignant').delete().eq('id', id);
    });

    const { data: apres } = await sb.rpc('est_affecte', {
      p_classe: cible.classeId,
      p_matiere: cible.matiereId,
      p_annee: annee.id,
    });
    constater(
      '2. La garde du 11 septembre tient-elle encore ?',
      apres === false,
      `est_affecte() rend ${apres} — la garde interroge une table que le garde vient d'ecrire`,
    );

    const { data: evaluation, error: erreurEval } = await sb
      .from('evaluation')
      .insert({
        classeId: cible.classeId,
        matiereId: cible.matiereId,
        anneeScolaireId: annee.id,
        type: 'DEVOIR',
        periode: 'TRIMESTRE_1',
        numero: 9,
        date: new Date().toISOString().slice(0, 10),
      })
      .select('id');
    const ecrite = noter(
      "3. Creer une evaluation dans cette matiere, apres s'y etre affecte",
      erreurEval,
      evaluation,
      `evaluation ${evaluation?.[0]?.id} creee dans ${cible.libelle}`,
    );
    if (ecrite && evaluation?.[0]) {
      const idEval = evaluation[0].id;
      aDefaire.push(async () => {
        await sb.from('evaluation').delete().eq('id', idEval);
      });
    }
  }

  // ---------------------------------------------------------------------
  // 2. Le moteur de calcul : les coefficients decident de chaque bulletin.
  // ---------------------------------------------------------------------
  const { data: coef } = await sb.from('coefficient_matiere').select('id, coefficient').limit(1);
  if (coef?.[0]) {
    const { id, coefficient } = coef[0];
    const { data: touche, error: erreurCoef } = await sb
      .from('coefficient_matiere')
      .update({ coefficient: 99 })
      .eq('id', id)
      .select('id');
    if (
      noter(
        '4. Changer un coefficient — donc toutes les moyennes de la matiere',
        erreurCoef,
        touche,
        `coefficient ${coefficient} porte a 99`,
      )
    ) {
      aDefaire.push(async () => {
        await sb.from('coefficient_matiere').update({ coefficient }).eq('id', id);
      });
    }
  }

  // ---------------------------------------------------------------------
  // 3. La structure de l'ecole.
  // ---------------------------------------------------------------------
  const { data: uneClasse } = await sb.from('classe').select('id, nom, capacite').limit(1);
  if (uneClasse?.[0]) {
    const { id, nom, capacite } = uneClasse[0];
    const { data: touche, error } = await sb
      .from('classe')
      .update({ nom: `${nom} (SONDE)` })
      .eq('id', id)
      .select('id');
    if (noter('5. Renommer une classe', error, touche, `« ${nom} » renommee`)) {
      aDefaire.push(async () => {
        await sb.from('classe').update({ nom, capacite }).eq('id', id);
      });
    }
  }

  {
    const { data: touche, error } = await sb
      .from('annee_scolaire')
      .update({ statut: 'TERMINEE' })
      .eq('id', annee.id)
      .select('id, statut');
    if (noter("6. Terminer l'annee scolaire de toute l'ecole", error, touche, 'annee passee en TERMINEE')) {
      aDefaire.push(async () => {
        await sb.from('annee_scolaire').update({ statut: 'ACTIVE' }).eq('id', annee.id);
      });
    }
  }

  const { data: uneMatiere } = await sb.from('matiere').select('id, nom').limit(1);
  if (uneMatiere?.[0]) {
    const { id, nom } = uneMatiere[0];
    const { data: touche, error } = await sb
      .from('matiere')
      .update({ nom: `${nom} (SONDE)` })
      .eq('id', id)
      .select('id');
    if (noter('7. Renommer une matiere de l\'ecole', error, touche, `« ${nom} » renommee`)) {
      aDefaire.push(async () => {
        await sb.from('matiere').update({ nom }).eq('id', id);
      });
    }
  }

  // ---------------------------------------------------------------------
  // 4. La fiche d'un collegue, et l'identite des documents officiels.
  // ---------------------------------------------------------------------
  const { data: autreFiche } = await sb
    .from('enseignant')
    .select('id, telephone')
    .neq('id', fiche.id)
    .limit(1);
  if (autreFiche?.[0]) {
    const { id, telephone } = autreFiche[0];
    const { data: touche, error } = await sb
      .from('enseignant')
      .update({ telephone: '00000000' })
      .eq('id', id)
      .select('id');
    if (noter("8. Modifier la fiche d'un autre enseignant", error, touche, 'telephone reecrit')) {
      aDefaire.push(async () => {
        await sb.from('enseignant').update({ telephone }).eq('id', id);
      });
    }
  }

  const { data: params } = await sb.from('parametres_document').select('*').limit(1);
  if (params?.[0]) {
    const ancien = params[0] as Record<string, unknown>;
    const { data: touche, error } = await sb
      .from('parametres_document')
      .update({ filigraneTexte: 'SONDE SECURITE', filigraneActif: true })
      .eq('id', ancien.id as string)
      .select('id');
    if (
      noter(
        '9. Poser un filigrane sur tous les bulletins et recus de l\'ecole',
        error,
        touche,
        'filigrane impose sur les documents officiels',
      )
    ) {
      aDefaire.push(async () => {
        await sb
          .from('parametres_document')
          .update({
            filigraneTexte: ancien.filigraneTexte,
            filigraneActif: ancien.filigraneActif,
          })
          .eq('id', ancien.id as string);
      });
    }
  }

  // ---------------------------------------------------------------------
  // 5. Le journal d'audit : peut-on y ecrire une ligne qu'on n'a pas faite,
  //    au nom de quelqu'un d'autre ?
  // ---------------------------------------------------------------------
  const { data: directeur } = await sb.from('utilisateur').select('id, email').eq('role', 'DIRECTEUR').limit(1);
  const { data: forge, error: erreurForge } = await sb
    .from('audit_log')
    .insert({
      etablissementId: etablissement,
      userId: directeur?.[0]?.id ?? session.user.id,
      action: 'SONDE_SECURITE',
      module: 'sonde',
      objetType: 'sonde',
      objetId: randomUUID(),
    })
    .select('id');
  if (
    noter(
      "10. Ecrire dans le journal d'audit au nom du Directeur",
      erreurForge,
      forge,
      `ligne ${forge?.[0]?.id} attribuee a ${directeur?.[0]?.email}`,
    )
  ) {
    const idLigne = forge?.[0]?.id as string;
    aDefaire.push(async () => {
      if (!SERVICE) return;
      const admin = createClient(URL, SERVICE);
      await admin.from('audit_log').delete().eq('id', idLigne);
    });
  }

  // ---------------------------------------------------------------------
  // 6. Le stockage : la finance est fermee a l'enseignant dans l'application.
  //    L'est-elle dans le bucket ?
  // ---------------------------------------------------------------------
  const { data: recu } = await sb
    .from('document')
    .select('id, type, cheminFichier')
    .eq('type', 'RECU')
    .limit(1);
  if (recu?.[0]?.cheminFichier) {
    const { data: fichier, error } = await sb.storage.from('documents').download(recu[0].cheminFichier);
    constater(
      "11. Telecharger le recu de paiement d'un eleve",
      !!error || !fichier,
      error
        ? String(error.message).slice(0, 140)
        : `${fichier?.size} octets recuperes — ${recu[0].cheminFichier}`,
    );
  }

  // ---------------------------------------------------------------------
  // 7. Le compte lui-meme : se hisser au rang de Directeur dans la table.
  // ---------------------------------------------------------------------
  const { data: monRole, error: erreurRole } = await sb
    .from('utilisateur')
    .update({ role: 'DIRECTEUR' })
    .eq('id', session.user.id)
    .select('id, role');
  if (noter('12. Se donner le role DIRECTEUR dans la table utilisateur', erreurRole, monRole, 'role reecrit')) {
    aDefaire.push(async () => {
      await sb.from('utilisateur').update({ role: 'ENSEIGNANT' }).eq('id', session.user.id);
    });
  }

  // ---------------------------------------------------------------------
  // Remise en etat
  // ---------------------------------------------------------------------
  console.log('Remise en etat...');
  let echecs = 0;
  for (const defaire of aDefaire.reverse()) {
    try {
      await defaire();
    } catch (e) {
      echecs += 1;
      console.error(`  ECHEC de remise en etat : ${e}`);
    }
  }
  console.log(echecs === 0 ? '  tout a ete defait.\n' : `  ${echecs} remise(s) en etat en echec — A VERIFIER A LA MAIN\n`);

  // ---------------------------------------------------------------------
  // Verdict
  // ---------------------------------------------------------------------
  const passes = essais.filter((e) => !e.refuse);
  console.log('='.repeat(78));
  for (const e of essais) {
    console.log(`${e.refuse ? '  TENU ' : '  PASSE'} | ${e.intitule}`);
    console.log(`         ${e.detail}`);
  }
  console.log('='.repeat(78));
  console.log(`${essais.length - passes.length} tenus, ${passes.length} passes.`);

  if (passes.length > 0) {
    console.error(`\n${passes.length} essai(s) ont abouti alors qu'ils devaient etre refuses.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
