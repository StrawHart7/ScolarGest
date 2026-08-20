/**
 * Vérification de l'isolation multi-tenant, par tentative d'accès croisé.
 *
 * La règle absolue du doc 03 § 13 — « un enseignant de l'école A ne peut jamais
 * accéder aux données de l'école B » — n'avait jusqu'ici jamais été éprouvée.
 * Ce script crée deux écoles jetables, se connecte comme Directeur de la
 * première, puis tente de lire et d'écrire les données de la seconde en passant
 * directement les identifiants. Chaque tentative doit échouer.
 *
 * Point de méthode, essentiel : les tentatives passent par le client **anon
 * plus session utilisateur**, jamais par la clé service-role. C'est le chemin
 * réel de l'application, et le seul où la RLS s'applique — vérifier avec la clé
 * service-role reviendrait à tester que la porte est fermée en passant par la
 * fenêtre.
 *
 * Usage :
 *   npx tsx scripts/verifier-isolation.ts           exécute la vérification
 *   npx tsx scripts/verifier-isolation.ts --purge   supprime les écoles de test
 *
 * Les deux écoles portent le préfixe ZZ-TEST-ISOLATION et n'existent que pour
 * ce script : `--purge` fait de vraies suppressions physiques, ce qui est
 * acceptable ici et nulle part ailleurs dans le produit.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function chargerEnv(): Record<string, string> {
  const brut = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  const sortie: Record<string, string> = {};
  for (const ligne of brut.split(/\r?\n/)) {
    if (!ligne.trim() || ligne.trim().startsWith('#')) continue;
    const i = ligne.indexOf('=');
    if (i === -1) continue;
    sortie[ligne.slice(0, i).trim()] = ligne
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return sortie;
}

const env = chargerEnv();
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL!;
const CLE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const CLE_SERVICE = env.SUPABASE_SERVICE_ROLE_KEY!;

/** Client tout-puissant : sert uniquement à monter et démonter le décor. */
const admin: SupabaseClient = createClient(URL_SUPABASE, CLE_SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PREFIXE = 'ZZ-TEST-ISOLATION';
const MOT_DE_PASSE = 'Isolation2026!';

interface Ecole {
  cle: 'A' | 'B';
  etablissementId: string;
  email: string;
  anneeScolaireId: string;
  classeId: string;
  eleveId: string;
}

// ------------------------------------------------------------------
// Montage du décor
// ------------------------------------------------------------------

async function premierNiveau(): Promise<string> {
  const { data, error } = await admin.from('niveau').select('id').limit(1).maybeSingle();
  if (error || !data) {
    throw new Error(
      'Catalogue `niveau` vide : appliquez les migrations (0003_seed_catalogues.sql) avant de lancer ce script.',
    );
  }
  return data.id as string;
}

async function trouverOuCreer(
  table: string,
  filtre: Record<string, string>,
  valeurs: Record<string, unknown>,
): Promise<string> {
  let requete = admin.from(table).select('id');
  for (const [colonne, valeur] of Object.entries(filtre)) {
    requete = requete.eq(colonne, valeur);
  }
  const { data } = await requete.maybeSingle();
  if (data) return data.id as string;

  const { data: cree, error } = await admin.from(table).insert(valeurs).select('id').single();
  if (error) throw error;
  return cree.id as string;
}

async function creerEcole(cle: 'A' | 'B', niveauId: string): Promise<Ecole> {
  const nom = `${PREFIXE}-${cle}`;
  const email = `directeur.isolation.${cle.toLowerCase()}@scolargest.test`;

  const etablissementId = await trouverOuCreer('etablissement', { nom }, { nom, ville: 'Lome' });

  // Compte Directeur de l'école, avec les claims que l'Auth Hook injecterait.
  const { data: utilisateurExistant } = await admin
    .from('utilisateur')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!utilisateurExistant) {
    const { data: cree, error } = await admin.auth.admin.createUser({
      email,
      password: MOT_DE_PASSE,
      email_confirm: true,
      app_metadata: { etablissement_id: etablissementId, role: 'DIRECTEUR' },
    });
    if (error || !cree.user) throw error ?? new Error('Creation du compte impossible');
    const { error: erreurDb } = await admin.from('utilisateur').insert({
      id: cree.user.id,
      etablissementId,
      nom: 'Isolation',
      prenom: cle,
      email,
      role: 'DIRECTEUR',
      statut: 'ACTIF',
    });
    if (erreurDb) throw erreurDb;
  }

  const anneeScolaireId = await trouverOuCreer(
    'annee_scolaire',
    { etablissementId, libelle: '2025-2026' },
    {
      etablissementId,
      libelle: '2025-2026',
      dateDebut: '2025-09-01',
      dateFin: '2026-07-31',
      statut: 'PREPARATION',
    },
  );

  const classeId = await trouverOuCreer(
    'classe',
    { etablissementId, nom: `${PREFIXE}-classe` },
    { etablissementId, anneeScolaireId, niveauId, nom: `${PREFIXE}-classe` },
  );

  const eleveId = await trouverOuCreer(
    'eleve',
    { etablissementId, matricule: `${PREFIXE}-001` },
    {
      etablissementId,
      matricule: `${PREFIXE}-001`,
      nom: 'Temoin',
      prenoms: cle,
      sexe: 'M',
      dateNaissance: '2010-01-01',
    },
  );

  // Un abonnement et une ligne d'audit, sans lesquels les tentatives portant sur
  // ces deux tables ne prouveraient rien : une lecture qui ne ramène rien parce
  // que la table est vide n'est pas une isolation, c'est un test à vide.
  const { data: plan } = await admin.from('plan_abonnement').select('id').limit(1).maybeSingle();
  if (plan) {
    await trouverOuCreer(
      'abonnement_etablissement',
      { etablissementId },
      {
        etablissementId,
        planId: plan.id,
        dateDebut: '2025-09-01',
        dateFin: '2026-08-31',
        statut: 'ACTIF',
      },
    );
  }

  const { count: lignesAudit } = await admin
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId);
  if ((lignesAudit ?? 0) === 0) {
    await admin.from('audit_log').insert({
      etablissementId,
      action: 'TEMOIN_ISOLATION',
      module: 'test',
      objetType: 'Etablissement',
      objetId: etablissementId,
    });
  }

  return { cle, etablissementId, email, anneeScolaireId, classeId, eleveId };
}

// ------------------------------------------------------------------
// Les tentatives
// ------------------------------------------------------------------

interface Resultat {
  intitule: string;
  fuite: boolean;
  /** Le test a-t-il porte sur quelque chose ? Voir `confirmerPresence`. */
  concluant: boolean;
  detail: string;
}

/**
 * Une lecture croisee qui ne ramene rien ne prouve rien tant qu'on n'a pas
 * verifie, avec la cle service-role, que la ligne visee existe bel et bien.
 * Sans ce controle, le script se felicterait d'une isolation parfaite alors
 * qu'il interrogerait des identifiants inexistants — le pire des tests de
 * securite : celui qui rassure a tort.
 */
async function confirmerPresence(
  table: string,
  colonne: string,
  valeur: string,
): Promise<boolean> {
  const { count } = await admin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(colonne, valeur);
  return (count ?? 0) > 0;
}

async function sessionDe(email: string): Promise<SupabaseClient> {
  const client = createClient(URL_SUPABASE, CLE_ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: MOT_DE_PASSE });
  if (error) throw new Error(`Connexion impossible pour ${email} : ${error.message}`);
  return client;
}

/** Une lecture croisée ramène-t-elle quoi que ce soit ? */
async function tentativeLecture(
  client: SupabaseClient,
  intitule: string,
  table: string,
  colonne: string,
  valeur: string,
): Promise<Resultat> {
  const existe = await confirmerPresence(table, colonne, valeur);

  const { data, error } = await client.from(table).select('id').eq(colonne, valeur);
  if (error) {
    return { intitule, fuite: false, concluant: existe, detail: `refuse (${error.code ?? 'erreur'})` };
  }
  const lignes = data?.length ?? 0;
  return {
    intitule,
    fuite: lignes > 0,
    concluant: existe,
    detail: lignes > 0 ? `${lignes} ligne(s) LUES` : existe ? 'aucune ligne' : 'CIBLE ABSENTE',
  };
}

/** Une écriture croisée modifie-t-elle quoi que ce soit ? */
async function tentativeEcriture(
  client: SupabaseClient,
  intitule: string,
  table: string,
  id: string,
  modification: Record<string, unknown>,
): Promise<Resultat> {
  const existe = await confirmerPresence(table, 'id', id);

  const { data, error } = await client.from(table).update(modification).eq('id', id).select('id');
  if (error) {
    return { intitule, fuite: false, concluant: existe, detail: `refuse (${error.code ?? 'erreur'})` };
  }
  const lignes = data?.length ?? 0;
  return {
    intitule,
    fuite: lignes > 0,
    concluant: existe,
    detail: lignes > 0 ? `${lignes} ligne(s) MODIFIEES` : existe ? 'aucune ligne' : 'CIBLE ABSENTE',
  };
}

/** Une insertion dans le tenant voisin passe-t-elle ? */
async function tentativeInsertion(
  client: SupabaseClient,
  intitule: string,
  cible: Ecole,
): Promise<Resultat> {
  const { data, error } = await client
    .from('eleve')
    .insert({
      etablissementId: cible.etablissementId,
      matricule: `${PREFIXE}-INTRUS-${Date.now()}`,
      nom: 'Intrus',
      prenoms: 'Test',
      sexe: 'M',
      dateNaissance: '2010-01-01',
    })
    .select('id');
  if (error) {
    return { intitule, fuite: false, concluant: true, detail: `refuse (${error.code ?? 'erreur'})` };
  }

  const lignes = data?.length ?? 0;
  if (lignes > 0 && data) {
    // Ne pas laisser l'intrus derrière soi si la garde a cédé.
    await admin.from('eleve').delete().eq('id', data[0]!.id);
  }
  return {
    intitule,
    fuite: lignes > 0,
    concluant: true,
    detail: lignes > 0 ? 'INSERTION ACCEPTEE' : 'aucune ligne',
  };
}

async function verifier(a: Ecole, b: Ecole): Promise<Resultat[]> {
  const client = await sessionDe(a.email);

  return [
    await tentativeLecture(client, 'lire un eleve de B par son id', 'eleve', 'id', b.eleveId),
    await tentativeLecture(client, 'lire une classe de B par son id', 'classe', 'id', b.classeId),
    await tentativeLecture(
      client,
      'lire annee scolaire de B',
      'annee_scolaire',
      'id',
      b.anneeScolaireId,
    ),
    await tentativeLecture(
      client,
      'lister les eleves de B',
      'eleve',
      'etablissementId',
      b.etablissementId,
    ),
    await tentativeLecture(
      client,
      'lire abonnement de B',
      'abonnement_etablissement',
      'etablissementId',
      b.etablissementId,
    ),
    await tentativeLecture(
      client,
      'lire journal audit de B',
      'audit_log',
      'etablissementId',
      b.etablissementId,
    ),
    await tentativeLecture(
      client,
      'lire les utilisateurs de B',
      'utilisateur',
      'etablissementId',
      b.etablissementId,
    ),
    await tentativeEcriture(client, 'renommer un eleve de B', 'eleve', b.eleveId, { nom: 'Pirate' }),
    await tentativeInsertion(client, 'inscrire un eleve dans B', b),
  ];
}

// ------------------------------------------------------------------
// Démontage
// ------------------------------------------------------------------

async function purger(): Promise<void> {
  const { data: ecoles } = await admin
    .from('etablissement')
    .select('id, nom')
    .like('nom', `${PREFIXE}%`);

  for (const ecole of ecoles ?? []) {
    const id = ecole.id as string;
    // Ordre imposé par les clés étrangères : les versements avant les
    // abonnements, les abonnements avant l'établissement.
    const { data: abonnements } = await admin
      .from('abonnement_etablissement')
      .select('id')
      .eq('etablissementId', id);
    for (const abonnement of abonnements ?? []) {
      await admin.from('paiement_abonnement').delete().eq('abonnementId', abonnement.id);
    }
    for (const table of [
      'audit_log',
      'eleve',
      'classe',
      'annee_scolaire',
      'abonnement_etablissement',
      'utilisateur',
    ]) {
      await admin.from(table).delete().eq('etablissementId', id);
    }
    await admin.from('etablissement').delete().eq('id', id);
    console.log(`  supprime : ${ecole.nom}`);
  }

  const { data } = await admin.auth.admin.listUsers();
  for (const cle of ['a', 'b']) {
    const email = `directeur.isolation.${cle}@scolargest.test`;
    const compte = data?.users.find((u) => u.email === email);
    if (compte) {
      await admin.auth.admin.deleteUser(compte.id);
      console.log(`  supprime : ${email}`);
    }
  }
}

// ------------------------------------------------------------------

async function principal(): Promise<void> {
  if (process.argv.includes('--purge')) {
    console.log('Purge des ecoles de test');
    await purger();
    console.log('Termine.');
    return;
  }

  console.log('Montage des deux ecoles de test');
  const niveauId = await premierNiveau();
  const a = await creerEcole('A', niveauId);
  const b = await creerEcole('B', niveauId);
  console.log(`  A : ${a.etablissementId}`);
  console.log(`  B : ${b.etablissementId}`);

  console.log('\nTentatives d acces croise, connecte comme Directeur de A');
  const resultats = await verifier(a, b);

  let fuites = 0;
  let vides = 0;
  for (const r of resultats) {
    if (r.fuite) fuites += 1;
    if (!r.concluant) vides += 1;
    const marque = r.fuite ? 'FUITE  ' : r.concluant ? 'bloque ' : 'VIDE   ';
    console.log(`  ${marque} ${r.intitule.padEnd(30)} ${r.detail}`);
  }

  console.log(
    `\n${resultats.length} tentatives, ${fuites} fuite(s), ${vides} non concluante(s).`,
  );
  if (fuites > 0) console.log('ISOLATION COMPROMISE.');
  else if (vides > 0) console.log('RESULTAT NON CONCLUANT : des cibles de test sont absentes.');
  else console.log("L'isolation tient.");

  console.log('\nPour nettoyer : npx tsx scripts/verifier-isolation.ts --purge');

  // Une tentative non concluante echoue au meme titre qu'une fuite : un vert
  // obtenu sur des cibles inexistantes est pire que pas de test du tout.
  if (fuites > 0 || vides > 0) process.exit(1);
}

principal().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
