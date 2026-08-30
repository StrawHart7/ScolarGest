/**
 * Établissement de test VIDE + compte Directeur, pour dérouler le
 * questionnaire de démarrage (`/demarrage`) de bout en bout.
 *
 * Pourquoi un script séparé de `seed-demo.ts` : celui-ci remplit
 * l'établissement (cycles, classes, matières, élèves…), ce qui le ferait
 * apparaître comme déjà configuré et sauterait tout l'onboarding. Ici on crée
 * délibérément une coquille vide — c'est précisément ce que le questionnaire
 * est censé remplir.
 *
 * Le compte est provisionné avec `auth.admin.createUser` + `email_confirm`,
 * donc sans invitation par email (même motif que `seed-demo.ts`).
 *
 *   npx tsx scripts/seed-onboarding-test.ts            # crée
 *   npx tsx scripts/seed-onboarding-test.ts --reset    # purge puis recrée
 *   npx tsx scripts/seed-onboarding-test.ts --eleves     # peuple les classes
 *   npx tsx scripts/seed-onboarding-test.ts --notes      # regroupe + note
 *   npx tsx scripts/seed-onboarding-test.ts --secretaire # compte finance
 *   npx tsx scripts/seed-onboarding-test.ts --purge      # supprime tout
 *
 * `--eleves` se lance **après** avoir franchi l'étape Classes du
 * questionnaire : il répartit des élèves fictifs dans les classes existantes,
 * en privilégiant le lycée. Sans classes, il ne fait rien.
 *
 * `--purge` fait de vraies suppressions : réservé aux données créées par ce
 * script, qu'il retrouve par le nom d'établissement ci-dessous.
 */
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const NOM_ETABLISSEMENT = 'TEST onboarding — à supprimer';
const EMAIL_DIRECTEUR = 'directeur.test.onboarding@scolargest.local';
const MOT_DE_PASSE = 'TestOnboarding2026!';

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    out[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv();
const db: SupabaseClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function trouverEtablissement(): Promise<string | null> {
  const { data } = await db
    .from('etablissement')
    .select('id')
    .eq('nom', NOM_ETABLISSEMENT)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function purger() {
  const etablissementId = await trouverEtablissement();

  // Le compte Auth d'abord : il est retrouvé par email, indépendamment de
  // l'établissement, pour rester nettoyable même après une purge partielle.
  const { data: liste } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const comptes = (liste?.users ?? []).filter(
    (u) => u.email === EMAIL_DIRECTEUR || u.email === EMAIL_SECRETAIRE,
  );

  if (etablissementId) {
    // Tout ce que le questionnaire a pu créer, dans l'ordre des dépendances.
    // Six tables ne portent pas d'`etablissementId` (note, evaluation,
    // ligne_facture, paiement, titularite_classe, coefficient_matiere) : elles
    // se suppriment par leur parent, sans quoi les clés étrangères bloqueraient
    // ensuite la suppression des classes et de l'année.
    const ids = async (table: string) => {
      const { data } = await db.from(table).select('id').eq('etablissementId', etablissementId);
      return ((data ?? []) as { id: string }[]).map((r) => r.id);
    };
    const annees = await ids('annee_scolaire');
    const classes = await ids('classe');
    const factures = await ids('facture_eleve');

    const { data: evalRows } = await db
      .from('evaluation')
      .select('id')
      .in('classeId', classes.length > 0 ? classes : ['00000000-0000-0000-0000-000000000000']);
    const evaluations = ((evalRows ?? []) as { id: string }[]).map((r) => r.id);

    const abonnements = await ids('abonnement_etablissement');

    const parParent: [string, string, string[]][] = [
      ['note', 'evaluationId', evaluations],
      ['evaluation', 'classeId', classes],
      ['ligne_facture', 'factureId', factures],
      ['paiement', 'factureId', factures],
      ['titularite_classe', 'classeId', classes],
      ['coefficient_matiere', 'anneeScolaireId', annees],
      ['paiement_abonnement', 'abonnementId', abonnements],
    ];
    for (const [table, colonne, valeurs] of parParent) {
      if (valeurs.length === 0) continue;
      const { error } = await db.from(table).delete().in(colonne, valeurs);
      if (error) console.log(`  ${table.padEnd(26)} ${error.message}`);
    }

    // Ordre imposé par les clés étrangères : ce qui référence avant ce qui
    // est référencé. `inscription` avant `eleve` et `classe`, `classe` avant
    // `annee_scolaire`, etc.
    for (const table of [
      'onboarding_progression',
      'parametres_document',
      'abonnement_etablissement',
      'facture_eleve',
      'tarif_scolaire',
      'type_frais',
      'programme_etablissement',
      'inscription',
      'eleve',
      'affectation_enseignant',
      'classe',
      'matiere',
      'enseignant',
      'cycle_etablissement',
      'annee_scolaire',
      'document',
      'audit_log',
    ]) {
      const { error } = await db.from(table).delete().eq('etablissementId', etablissementId);
      if (error && !/does not exist/i.test(error.message)) {
        console.log(`  ${table.padEnd(26)} ${error.message}`);
      }
    }
    const { error: erreurUtilisateurs } = await db
      .from('utilisateur')
      .delete()
      .eq('etablissementId', etablissementId);
    if (erreurUtilisateurs) console.log('  utilisateur                ', erreurUtilisateurs.message);

    // Vérifier l'erreur, et non l'annoncer d'office : une clé étrangère
    // résiduelle ferait échouer la suppression en silence, et le script
    // afficherait un succès mensonger.
    const { error: erreurEtab } = await db
      .from('etablissement')
      .delete()
      .eq('id', etablissementId);
    console.log(
      erreurEtab
        ? `ECHEC suppression etablissement : ${erreurEtab.message}`
        : 'Etablissement de test supprime.',
    );
  } else {
    console.log('Aucun etablissement de test a supprimer.');
  }

  for (const compte of comptes) {
    await db.auth.admin.deleteUser(compte.id);
    console.log(`Compte supprime : ${compte.email}`);
  }
}

async function creer() {
  if (await trouverEtablissement()) {
    console.log('Un etablissement de test existe deja. Lancez --purge d’abord.');
    return;
  }

  const { data: etab, error: erreurEtab } = await db
    .from('etablissement')
    .insert({ nom: NOM_ETABLISSEMENT, ville: 'Lomé', statut: 'ACTIF' })
    .select('id')
    .single();
  if (erreurEtab || !etab) {
    console.log('ECHEC creation etablissement :', erreurEtab?.message);
    return;
  }
  const etablissementId = (etab as { id: string }).id;

  // Un abonnement ACTIF est indispensable, pas décoratif : sans lui,
  // `evaluerAcces` renvoie AUCUN → LECTURE_SEULE, et *toute* écriture est
  // refusée (403). L'onboarding entier serait bloqué. Dans le vrai parcours,
  // c'est le SUPER_ADMIN qui saisit l'abonnement à la création de l'école ;
  // ce script doit donc le reproduire pour être fidèle.
  const { data: plan } = await db
    .from('plan_abonnement')
    .select('id')
    .eq('nom', 'Annuel')
    .maybeSingle();
  if (!plan) {
    console.log('ECHEC : aucun plan « Annuel » en base (migration 0003 appliquee ?).');
    await db.from('etablissement').delete().eq('id', etablissementId);
    return;
  }
  const dans1An = new Date();
  dans1An.setFullYear(dans1An.getFullYear() + 1);
  const { error: erreurAbo } = await db.from('abonnement_etablissement').insert({
    etablissementId,
    planId: (plan as { id: string }).id,
    dateDebut: new Date().toISOString(),
    dateFin: dans1An.toISOString(),
    statut: 'ACTIF',
  });
  if (erreurAbo) {
    console.log('ECHEC creation abonnement :', erreurAbo.message);
    await db.from('etablissement').delete().eq('id', etablissementId);
    return;
  }

  const { data: cree, error: erreurAuth } = await db.auth.admin.createUser({
    email: EMAIL_DIRECTEUR,
    password: MOT_DE_PASSE,
    email_confirm: true,
    app_metadata: { etablissement_id: etablissementId, role: 'DIRECTEUR' },
  });
  if (erreurAuth || !cree.user) {
    console.log('ECHEC creation compte :', erreurAuth?.message);
    await db.from('etablissement').delete().eq('id', etablissementId);
    return;
  }

  const { error: erreurUtilisateur } = await db.from('utilisateur').insert({
    id: cree.user.id,
    etablissementId,
    nom: 'Test',
    prenom: 'Directeur',
    email: EMAIL_DIRECTEUR,
    role: 'DIRECTEUR',
    statut: 'ACTIF',
  });
  if (erreurUtilisateur) {
    console.log('ECHEC creation utilisateur :', erreurUtilisateur.message);
    return;
  }

  console.log('');
  console.log('Etablissement de test cree (vide, pret pour /demarrage).');
  console.log('');
  console.log(`  Email        : ${EMAIL_DIRECTEUR}`);
  console.log(`  Mot de passe : ${MOT_DE_PASSE}`);
  console.log('');
  console.log('Pour tout retirer ensuite :');
  console.log('  npx tsx scripts/seed-onboarding-test.ts --purge');
  console.log('');
}

const NOMS = [
  'Adjovi', 'Agbeko', 'Amouzou', 'Attiogbe', 'Ayite', 'Bakari', 'Dossou', 'Gnassingbe',
  'Kodjo', 'Komlan', 'Lawson', 'Mensah', 'Nyavor', 'Ouro-Bang', 'Sossou', 'Tchalla',
  'Toure', 'Yao', 'Zinsou', 'Abalo',
];
const PRENOMS_M = ['Kossi', 'Yao', 'Koffi', 'Edem', 'Sena', 'Elom', 'Kodjo', 'Mawuli', 'Delali', 'Selom'];
const PRENOMS_F = ['Akosua', 'Afi', 'Ama', 'Esi', 'Dela', 'Sitsofe', 'Enyonam', 'Mawuena', 'Akpene', 'Edoh'];

/** PRNG déterministe : deux exécutions produisent le même jeu de données. */
function mulberry32(graine: number) {
  let a = graine;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOTAL_ELEVES = 50;

async function peuplerEleves() {
  const etablissementId = await trouverEtablissement();
  if (!etablissementId) {
    console.log('Aucun etablissement de test. Lancez le script sans option d’abord.');
    return;
  }

  const { data: annee } = await db
    .from('annee_scolaire')
    .select('id')
    .eq('etablissementId', etablissementId)
    .eq('statut', 'ACTIVE')
    .maybeSingle();
  if (!annee) {
    console.log('Aucune annee ACTIVE : franchissez d’abord l’etape Annee scolaire.');
    return;
  }
  const anneeId = (annee as { id: string }).id;

  const { data: classes } = await db
    .from('classe')
    .select('id, nom, "serieId", niveau:niveau("cycleId", cycle:cycle(nom))')
    .eq('etablissementId', etablissementId);

  const liste = (classes ?? []) as unknown as {
    id: string;
    nom: string;
    serieId: string | null;
    niveau: { cycle: { nom: string } | null } | null;
  }[];

  if (liste.length === 0) {
    console.log('Aucune classe : franchissez d’abord l’etape Classes du questionnaire.');
    return;
  }

  const { count: dejaLa } = await db
    .from('eleve')
    .select('id', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId);
  if ((dejaLa ?? 0) > 0) {
    console.log(`${dejaLa} eleves deja presents — rien a faire.`);
    return;
  }

  // Le lycée est le cas le plus intéressant à tester (séries, coefficients
  // différenciés), il reçoit donc la majorité de l'effectif.
  const lycee = liste.filter((c) => c.niveau?.cycle?.nom === 'LYCEE');
  const autres = liste.filter((c) => c.niveau?.cycle?.nom !== 'LYCEE');
  const partLycee = lycee.length > 0 ? Math.round(TOTAL_ELEVES * 0.7) : 0;

  const repartition: string[] = [];
  for (let i = 0; i < partLycee && lycee.length > 0; i += 1) {
    repartition.push(lycee[i % lycee.length]!.id);
  }
  for (let i = repartition.length; i < TOTAL_ELEVES; i += 1) {
    const pool = autres.length > 0 ? autres : lycee;
    if (pool.length === 0) break;
    repartition.push(pool[i % pool.length]!.id);
  }

  const rnd = mulberry32(20260829);
  let crees = 0;

  for (let i = 0; i < repartition.length; i += 1) {
    const sexe = rnd() > 0.5 ? 'M' : 'F';
    const prenoms = sexe === 'M' ? PRENOMS_M : PRENOMS_F;
    const nom = NOMS[Math.floor(rnd() * NOMS.length)]!;
    const prenom = prenoms[Math.floor(rnd() * prenoms.length)]!;
    const annchoix = 2008 + Math.floor(rnd() * 6);

    const { data: eleve, error } = await db
      .from('eleve')
      .insert({
        etablissementId,
        matricule: `ELV-TEST-${String(i + 1).padStart(4, '0')}`,
        nom,
        prenoms: prenom,
        sexe,
        dateNaissance: `${annchoix}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`,
        lieuNaissance: 'Lomé',
        nationalite: 'Togolaise',
        statut: 'ACTIF',
      })
      .select('id')
      .single();
    if (error || !eleve) {
      console.log(`  eleve ${i + 1} ECHEC : ${error?.message}`);
      continue;
    }

    const { error: erreurInscription } = await db.from('inscription').insert({
      etablissementId,
      eleveId: (eleve as { id: string }).id,
      anneeScolaireId: anneeId,
      classeId: repartition[i]!,
      statut: 'ACTIVE',
    });
    if (erreurInscription) {
      console.log(`  inscription ${i + 1} ECHEC : ${erreurInscription.message}`);
      continue;
    }
    crees += 1;
  }

  console.log('');
  console.log(`${crees} eleves crees et inscrits.`);
  console.log(`  dont ${partLycee} au lycee, repartis sur ${lycee.length} classe(s).`);
  console.log('');
}

const EMAIL_SECRETAIRE = 'secretaire.test.onboarding@scolargest.local';

/**
 * Provisionne une Secrétaire directement, sans invitation par email.
 *
 * L'étape 9 du questionnaire passe par `inviteUserByEmail`, qui envoie un
 * vrai message et dépend du SMTP (fortement limité en débit sur l'offre par
 * défaut). Pour éprouver le *parcours finance* — qui est ce qu'on veut
 * vraiment tester — ce raccourci évite d'attendre un email.
 */
async function creerSecretaire() {
  const etablissementId = await trouverEtablissement();
  if (!etablissementId) {
    console.log('Aucun etablissement de test. Lancez le script sans option d’abord.');
    return;
  }

  const { data: liste } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (liste?.users.some((u) => u.email === EMAIL_SECRETAIRE)) {
    console.log('Compte Secretaire deja present.');
    console.log(`  Email        : ${EMAIL_SECRETAIRE}`);
    console.log(`  Mot de passe : ${MOT_DE_PASSE}`);
    return;
  }

  const { data: cree, error } = await db.auth.admin.createUser({
    email: EMAIL_SECRETAIRE,
    password: MOT_DE_PASSE,
    email_confirm: true,
    app_metadata: { etablissement_id: etablissementId, role: 'SECRETAIRE' },
  });
  if (error || !cree.user) {
    console.log('ECHEC creation compte :', error?.message);
    return;
  }

  const { error: erreurUtilisateur } = await db.from('utilisateur').insert({
    id: cree.user.id,
    etablissementId,
    nom: 'Test',
    prenom: 'Secretaire',
    email: EMAIL_SECRETAIRE,
    role: 'SECRETAIRE',
    statut: 'ACTIF',
  });
  if (erreurUtilisateur) {
    console.log('ECHEC creation utilisateur :', erreurUtilisateur.message);
    return;
  }

  console.log('');
  console.log('Compte Secretaire cree (parcours finance du questionnaire).');
  console.log(`  Email        : ${EMAIL_SECRETAIRE}`);
  console.log(`  Mot de passe : ${MOT_DE_PASSE}`);
  console.log('');
}


/** Nombre de classes sur lesquelles concentrer l'effectif. */
const CLASSES_RETENUES = 3;

/**
 * Regroupe tous les élèves sur quelques classes, puis leur crée des notes.
 *
 * Réparti uniformément sur les 26 classes d'un lycée complet, l'effectif de
 * 50 élèves donne deux élèves par classe : le rang s'affiche « 1 sur 2 » et la
 * moyenne de classe ne veut rien dire. Pour éprouver un bulletin il faut une
 * classe réellement peuplée.
 *
 * Les classes retenues privilégient le lycée à séries : c'est là que se
 * vérifient les coefficients différenciés.
 */
async function concentrerEtNoter() {
  const etablissementId = await trouverEtablissement();
  if (!etablissementId) {
    console.log('Aucun etablissement de test.');
    return;
  }

  const { data: annee } = await db
    .from('annee_scolaire')
    .select('id')
    .eq('etablissementId', etablissementId)
    .eq('statut', 'ACTIVE')
    .maybeSingle();
  if (!annee) {
    console.log('Aucune annee ACTIVE.');
    return;
  }
  const anneeId = (annee as { id: string }).id;

  const { data: classesBrutes } = await db
    .from('classe')
    .select('id, nom, "niveauId", "serieId"')
    .eq('etablissementId', etablissementId);
  const classes = (classesBrutes ?? []) as {
    id: string;
    nom: string;
    niveauId: string;
    serieId: string | null;
  }[];
  if (classes.length === 0) {
    console.log('Aucune classe : terminez d’abord l’etape Classes.');
    return;
  }

  // Priorité aux classes à série (lycée), puis complément par ordre de nom.
  const avecSerie = classes.filter((c) => c.serieId);
  const sansSerie = classes.filter((c) => !c.serieId);
  const retenues = [...avecSerie, ...sansSerie].slice(0, CLASSES_RETENUES);

  const { data: inscriptions } = await db
    .from('inscription')
    .select('id')
    .eq('etablissementId', etablissementId)
    .eq('anneeScolaireId', anneeId);
  const lignes = (inscriptions ?? []) as { id: string }[];
  if (lignes.length === 0) {
    console.log('Aucun eleve inscrit : lancez --eleves d’abord.');
    return;
  }

  // Répartition en parts égales sur les classes retenues.
  for (let i = 0; i < lignes.length; i += 1) {
    const cible = retenues[i % retenues.length]!;
    const { error } = await db
      .from('inscription')
      .update({ classeId: cible.id })
      .eq('id', lignes[i]!.id);
    if (error) console.log(`  inscription ${i + 1} ECHEC : ${error.message}`);
  }
  console.log(`${lignes.length} eleves regroupes sur : ${retenues.map((c) => c.nom).join(', ')}`);

  // --- Notes -------------------------------------------------------------
  // Deux interrogations, un devoir, une composition par matière du niveau,
  // sur le premier trimestre. Statut VALIDE : depuis la refonte du workflow,
  // une note SOUMISE ne compte pas dans les moyennes et le bulletin sortirait
  // vide.
  const rnd = mulberry32(20260830);
  let evaluationsCreees = 0;
  let notesCreees = 0;

  for (const classe of retenues) {
    const { data: programme } = await db
      .from('programme_etablissement')
      .select('"matiereId"')
      .eq('etablissementId', etablissementId)
      .eq('niveauId', classe.niveauId);
    const matieres = ((programme ?? []) as { matiereId: string }[]).map((p) => p.matiereId);

    const { data: inscrits } = await db
      .from('inscription')
      .select('"eleveId"')
      .eq('anneeScolaireId', anneeId)
      .eq('classeId', classe.id);
    const eleves = ((inscrits ?? []) as { eleveId: string }[]).map((i) => i.eleveId);

    for (const matiereId of matieres) {
      const plan: [string, number][] = [
        ['INTERROGATION', 1],
        ['INTERROGATION', 2],
        ['DEVOIR', 1],
        ['COMPOSITION', 1],
      ];
      for (const [type, numero] of plan) {
        const { data: evaluation, error } = await db
          .from('evaluation')
          .insert({
            anneeScolaireId: anneeId,
            classeId: classe.id,
            matiereId,
            type,
            periode: 'TRIMESTRE_1',
            numero,
            date: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (error || !evaluation) continue;
        evaluationsCreees += 1;

        const evaluationId = (evaluation as { id: string }).id;
        const notes = eleves.map((eleveId) => ({
          evaluationId,
          eleveId,
          // Notes plausibles : entre 4 et 18, au quart de point.
          valeur: Math.round((4 + rnd() * 14) * 4) / 4,
          statut: 'VALIDE',
        }));
        const { error: erreurNotes } = await db.from('note').insert(notes);
        if (!erreurNotes) notesCreees += notes.length;
      }
    }
  }

  console.log(`${evaluationsCreees} evaluations et ${notesCreees} notes creees (T1, statut VALIDE).`);
  console.log('');
}

async function main() {
  if (process.argv.includes('--purge')) {
    await purger();
    return;
  }
  if (process.argv.includes('--secretaire')) {
    await creerSecretaire();
    return;
  }
  if (process.argv.includes('--eleves')) {
    await peuplerEleves();
    return;
  }
  if (process.argv.includes('--notes')) {
    await concentrerEtNoter();
    return;
  }
  if (process.argv.includes('--reset')) {
    await purger();
    await creer();
    return;
  }
  await creer();
}

void main();
