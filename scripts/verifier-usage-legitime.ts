/**
 * Le resserrement du 2026-09-17 a-t-il ferme un ecran a un role qui en a
 * besoin ?
 *
 * ## Pourquoi ce script est le jumeau du precedent
 *
 * `verifier-escalade-roles.ts` verifie qu'un enseignant ne peut pas se hisser.
 * Pris seul, il se satisferait d'une base ou plus personne n'ecrit rien : tout
 * serait « TENU ». Une politique trop large est un trou ; une politique trop
 * etroite est une panne, et la RLS ne leve pas sur un UPDATE — elle filtre.
 * Un ecran casse par un resserrement ne dit donc **rien du tout** : pas
 * d'erreur, pas de message, juste un bouton qui n'a aucun effet.
 *
 * C'est la moitie que la doctrine du depot reclame explicitement : « avant de
 * resserrer une garde, chercher qui appelle la fonction ». Ce script en est la
 * verification executable, la ou la recherche etait un raisonnement.
 *
 * ## La methode
 *
 * Les memes ecritures que la sonde d'escalade, par les memes tables, mais sous
 * les roles auxquels `src/lib/permissions/__tests__/matrice.instantane.txt`
 * les accorde. Ici un essai **refuse** est un echec.
 *
 * Tout est defait avant de rendre la main.
 *
 * ## Usage
 *
 *   npx tsx scripts/verifier-usage-legitime.ts
 *
 * Identifiants dans `.env.e2e` (`E2E_DIRECTEUR_*`, `E2E_SECRETAIRE_*`).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.e2e' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface Essai {
  intitule: string;
  /** `true` si l'ecriture a abouti, c'est-a-dire si l'ecran marche encore. */
  abouti: boolean;
  detail: string;
}

const essais: Essai[] = [];
const aDefaire: (() => Promise<void>)[] = [];

/**
 * **`lignes` est aussi decisif que `erreur`, et ici plus encore.** Un UPDATE
 * refuse par la RLS revient sans erreur et sans ligne : une contre-epreuve qui
 * ne regarderait que l'erreur annoncerait « marche » sur un ecran mort.
 */
function noter(intitule: string, erreur: unknown, lignes: unknown[] | null, detail: string): boolean {
  if (erreur) {
    essais.push({
      intitule,
      abouti: false,
      detail: String((erreur as { message?: string })?.message ?? erreur).slice(0, 140),
    });
    return false;
  }
  if (!lignes || lignes.length === 0) {
    essais.push({ intitule, abouti: false, detail: 'aucune ligne touchee — la politique a filtre sans lever' });
    return false;
  }
  essais.push({ intitule, abouti: true, detail });
  return true;
}

async function connecter(email?: string, mdp?: string): Promise<SupabaseClient | null> {
  if (!email || !mdp) return null;
  const sb = createClient(URL!, ANON!);
  const { data, error } = await sb.auth.signInWithPassword({ email, password: mdp });
  if (error || !data.user) {
    console.error(`  connexion impossible pour ${email} : ${error?.message}`);
    return null;
  }
  return sb;
}

async function main(): Promise<void> {
  if (!URL || !ANON) throw new Error('NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY absents');

  const directeur = await connecter(
    process.env.E2E_DIRECTEUR_EMAIL,
    process.env.E2E_DIRECTEUR_PASSWORD,
  );
  const secretaire = await connecter(
    process.env.E2E_SECRETAIRE_EMAIL,
    process.env.E2E_SECRETAIRE_PASSWORD,
  );
  if (!directeur || !secretaire) {
    console.log('E2E_DIRECTEUR_* / E2E_SECRETAIRE_* absents ou invalides — contre-epreuve sautee.');
    return;
  }

  const { data: session } = await directeur.auth.getUser();
  const etablissement = (session.user?.app_metadata as { etablissement_id?: string })
    ?.etablissement_id;
  console.log(`Directeur et Secretaire connectes — etablissement ${etablissement}\n`);

  // --- Directeur : la structure de son ecole -------------------------------
  const { data: classe } = await directeur.from('classe').select('id, nom, capacite').limit(1);
  if (classe?.[0]) {
    const { id, nom, capacite } = classe[0];
    const { data: touche, error } = await directeur
      .from('classe')
      .update({ capacite: (capacite ?? 30) + 1 })
      .eq('id', id)
      .select('id');
    if (noter('Directeur : regler la capacite d\'une classe', error, touche, `« ${nom} » reglee`)) {
      aDefaire.push(async () => {
        await directeur.from('classe').update({ capacite }).eq('id', id);
      });
    }
  }

  const { data: annee } = await directeur
    .from('annee_scolaire')
    .select('id, statut')
    .eq('statut', 'ACTIVE')
    .maybeSingle();
  if (annee) {
    const { data: touche, error } = await directeur
      .from('annee_scolaire')
      .update({ referentielNational: false })
      .eq('id', annee.id)
      .select('id');
    noter("Directeur : ecrire sur l'annee scolaire", error, touche, 'annee modifiable');
  }

  const { data: params } = await directeur.from('parametres_document').select('*').limit(1);
  if (params?.[0]) {
    const ancien = params[0] as Record<string, unknown>;
    const { data: touche, error } = await directeur
      .from('parametres_document')
      .update({ filigraneActif: !(ancien.filigraneActif as boolean) })
      .eq('id', ancien.id as string)
      .select('id');
    if (noter('Directeur : regler le filigrane des documents', error, touche, 'filigrane bascule')) {
      aDefaire.push(async () => {
        await directeur
          .from('parametres_document')
          .update({ filigraneActif: ancien.filigraneActif })
          .eq('id', ancien.id as string);
      });
    }
  }

  const { data: etab } = await directeur.from('etablissement').select('id, telephone').limit(1);
  if (etab?.[0]) {
    const { id, telephone } = etab[0];
    const { data: touche, error } = await directeur
      .from('etablissement')
      .update({ telephone: telephone ?? '90000000' })
      .eq('id', id)
      .select('id');
    if (noter("Directeur : modifier la fiche de son etablissement", error, touche, 'fiche modifiable')) {
      aDefaire.push(async () => {
        await directeur.from('etablissement').update({ telephone }).eq('id', id);
      });
    }
  }

  // --- Secretaire : le quotidien pedagogique ------------------------------
  const { data: matiere } = await secretaire.from('matiere').select('id, nom').limit(1);
  if (matiere?.[0]) {
    const { id, nom } = matiere[0];
    const { data: touche, error } = await secretaire
      .from('matiere')
      .update({ nom })
      .eq('id', id)
      .select('id');
    noter('Secretaire : modifier une matiere', error, touche, `« ${nom} » modifiable`);
  }

  const { data: fiche } = await secretaire.from('enseignant').select('id, telephone').limit(1);
  if (fiche?.[0]) {
    const { id, telephone } = fiche[0];
    const { data: touche, error } = await secretaire
      .from('enseignant')
      .update({ telephone })
      .eq('id', id)
      .select('id');
    noter("Secretaire : modifier la fiche d'un enseignant", error, touche, 'fiche modifiable');
  }

  const { data: affectation } = await secretaire
    .from('affectation_enseignant')
    .select('id, enseignantId, classeId, matiereId, anneeScolaireId')
    .limit(1);
  if (affectation?.[0]) {
    const a = affectation[0];
    const { error: erreurSuppr } = await secretaire
      .from('affectation_enseignant')
      .delete()
      .eq('id', a.id);
    const { data: recree, error } = await secretaire
      .from('affectation_enseignant')
      .insert({
        etablissementId: etablissement,
        enseignantId: a.enseignantId,
        classeId: a.classeId,
        matiereId: a.matiereId,
        anneeScolaireId: a.anneeScolaireId,
      })
      .select('id');
    noter(
      'Secretaire : affecter un enseignant a une classe',
      erreurSuppr ?? error,
      recree,
      'affectation retiree puis reposee',
    );
  }

  const { data: coef } = await secretaire.from('coefficient_matiere').select('id, coefficient').limit(1);
  if (coef?.[0]) {
    const { id, coefficient } = coef[0];
    const { data: touche, error } = await secretaire
      .from('coefficient_matiere')
      .update({ coefficient })
      .eq('id', id)
      .select('id');
    noter('Secretaire : definir un coefficient', error, touche, 'coefficient modifiable');
  }

  const { data: audit, error: erreurAudit } = await secretaire
    .from('audit_log')
    .insert({
      etablissementId: etablissement,
      userId: (await secretaire.auth.getUser()).data.user?.id,
      action: 'SONDE_CONTRE_EPREUVE',
      module: 'sonde',
      objetType: 'sonde',
      objetId: crypto.randomUUID(),
    })
    .select('id');
  if (noter('Secretaire : journaliser sa propre action', erreurAudit, audit, 'ligne ecrite en son nom')) {
    const idLigne = audit?.[0]?.id as string;
    aDefaire.push(async () => {
      const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!service) return;
      await createClient(URL!, service).from('audit_log').delete().eq('id', idLigne);
    });
  }

  // --- Le stockage doit rester ouvert a qui de droit -----------------------
  for (const [nom, sb, type] of [
    ['Directeur', directeur, 'RECU'],
    ['Secretaire', secretaire, 'BULLETIN'],
  ] as const) {
    const { data: doc } = await sb
      .from('document')
      .select('cheminFichier')
      .eq('type', type)
      .limit(1);
    if (doc?.[0]?.cheminFichier) {
      const { data: fichier, error } = await sb.storage
        .from('documents')
        .download(doc[0].cheminFichier);
      essais.push({
        intitule: `${nom} : telecharger un document de type ${type}`,
        abouti: !error && !!fichier,
        detail: error ? String(error.message).slice(0, 140) : `${fichier?.size} octets`,
      });
    }
  }

  // --- Remise en etat ------------------------------------------------------
  console.log('Remise en etat...');
  let echecs = 0;
  for (const defaire of aDefaire.reverse()) {
    try {
      await defaire();
    } catch (e) {
      echecs += 1;
      console.error(`  ECHEC : ${e}`);
    }
  }
  console.log(echecs === 0 ? '  tout a ete defait.\n' : `  ${echecs} echec(s) — A VERIFIER A LA MAIN\n`);

  // --- Verdict -------------------------------------------------------------
  const casses = essais.filter((e) => !e.abouti);
  console.log('='.repeat(78));
  for (const e of essais) {
    console.log(`${e.abouti ? '  MARCHE' : '  CASSE '} | ${e.intitule}`);
    console.log(`         ${e.detail}`);
  }
  console.log('='.repeat(78));
  console.log(`${essais.length - casses.length} marchent, ${casses.length} casses.`);

  if (casses.length > 0) {
    console.error(`\n${casses.length} ecriture(s) legitimes ont ete refusees : le resserrement est allé trop loin.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
