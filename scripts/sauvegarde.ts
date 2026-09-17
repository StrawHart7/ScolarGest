/**
 * Sauvegarde hors site : les donnees, les fichiers, et les comptes.
 *
 * ## Pourquoi ce script existe
 *
 * Deux constats du 2026-09-17, tous deux dans la documentation de Supabase et
 * non dans une opinion :
 *
 * 1. **Les sauvegardes automatiques n'existent qu'a partir du plan Pro.** Un
 *    projet gratuit n'en a aucune, et Supabase recommande explicitement d'y
 *    exporter soi-meme.
 * 2. **Aucune sauvegarde de base n'inclut le Storage.** La base ne porte que
 *    les metadonnees des fichiers. Restaurer une sauvegarde ne rend pas un
 *    bulletin efface.
 *
 * Le second vaut quel que soit le plan. Or ces fichiers sont les bulletins
 * remis aux familles et les recus de paiement : ce que l'ecole aurait le plus
 * de mal a refabriquer, et ce qu'on lui a promis de garder.
 *
 * **Le projet est sur le plan gratuit** — confirme par l'utilisateur le
 * 2026-09-17. Le premier constat s'applique donc, et il faut le lire sans
 * adoucissement : il n'existe aujourd'hui **aucune autre sauvegarde que
 * celle-ci**. Ce script n'est pas une precaution supplementaire, c'est le seul
 * exemplaire. Tant qu'il n'est pas lance, il n'y a rien.
 *
 * Deux consequences pratiques :
 *
 * - le lancer regulierement n'est pas une bonne pratique, c'est la seule
 *   pratique. Une sauvegarde d'il y a trois semaines vaut trois semaines de
 *   saisie perdues ;
 * - la copie doit quitter la machine. Le disque qui porte le depot et le
 *   disque qui porte la sauvegarde ne doivent pas etre le meme, sans quoi une
 *   panne materielle emporte les deux d'un coup.
 *
 * ## Ce que ce script sauvegarde, et ce qu'il ne sauvegarde pas
 *
 * **Il prend** : toutes les tables exposees par l'API, tous les fichiers de
 * tous les buckets, et la liste des comptes Auth.
 *
 * **Il ne prend pas le schema** — il vit dans `supabase/migrations/`, donc dans
 * Git, qui est deja sauvegarde ailleurs et mieux. Le manifeste note la derniere
 * migration appliquee pour qu'on sache sur quelle version rejouer les donnees.
 *
 * **Il ne prend pas les mots de passe.** L'API d'administration ne les rend
 * pas, et c'est tant mieux. Une restauration exige donc une reinitialisation
 * pour chaque compte. C'est une limite reelle, ecrite ici plutot que decouverte
 * le jour ou elle compte.
 *
 * ## La liste des tables n'est pas ecrite en dur
 *
 * Elle est lue dans la description OpenAPI que PostgREST publie a la racine de
 * l'API. Une liste figee dans ce fichier aurait manque la premiere table ajoutee
 * apres, **sans rien dire** — et une sauvegarde incomplete qui se termine en
 * vert est pire que pas de sauvegarde : on cesse d'y penser.
 *
 * ## Usage
 *
 * Depuis la racine du depot :
 *
 *   npm run sauvegarde                             # dans ./sauvegardes/
 *   npm run sauvegarde -- --vers "D:/Coffre"       # ailleurs, de preference
 *   npm run sauvegarde:verifier "D:/Coffre/<date>" # hors de cette machine
 *
 * **Ou depuis n'importe ou**, en donnant le chemin complet du script — c'est
 * voulu, et verifie le 2026-09-17 en le lancant depuis `C:\` :
 *
 *   npx tsx D:/.../scripts/sauvegarde.ts --vers "D:/Coffre"
 *
 * Le script retrouve seul le depot, son `.env` et ses migrations a partir de
 * son propre emplacement. Une sauvegarde sera lancee depuis un raccourci ou une
 * tache planifiee, jamais depuis un terminal deja place au bon endroit.
 *
 * `--verifier` relit le manifeste et recompte en base : c'est ce qui distingue
 * une sauvegarde d'un dossier de fichiers. Une sauvegarde qu'on n'a jamais
 * relue n'est pas une sauvegarde, c'est une intention.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

/**
 * La racine du depot, deduite de l'emplacement de **ce fichier**.
 *
 * Les autres scripts du depot lisent `.env` relativement au dossier courant, ce
 * qui les oblige a etre lances depuis la racine. Passe encore pour un semis de
 * donnees de test. Pas pour une sauvegarde : elle sera lancee depuis un
 * raccourci, une tache planifiee ou un autre disque, et `dotenv` **ne leve pas**
 * quand le fichier est absent — le script serait parti avec des variables vides
 * et aurait echoue plus loin, sur un message parlant d'autre chose.
 *
 * Meme raison pour `supabase/migrations` : lu depuis le mauvais dossier, le
 * manifeste aurait annonce « derniere migration : inconnue » sans que rien ne
 * s'arrete. Une sauvegarde dont on ignore la version de schema ne se restaure
 * pas.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

config({ path: join(RACINE, '.env') });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** PostgREST plafonne les reponses : on pagine, toujours. */
const PAGE = 1000;

interface EntreeTable {
  lignes: number;
  octets: number;
  empreinte: string;
}

interface Manifeste {
  faiteLe: string;
  projet: string;
  derniereMigration: string;
  tables: Record<string, EntreeTable>;
  fichiers: { nombre: number; octets: number; buckets: Record<string, number> };
  comptes: number;
  /** Ce que cette sauvegarde ne contient pas — ecrit, pas sous-entendu. */
  limites: string[];
}

function client() {
  if (!URL || !SERVICE) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absents de .env');
  }
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}

/**
 * Les tables exposees, lues dans la description OpenAPI de PostgREST.
 *
 * `definitions` porte une entree par table et par vue exposee. On ecarte les
 * entrees qui ne sont pas des tables de donnees — PostgREST y decrit aussi les
 * types composites de ses fonctions.
 */
async function listerTables(): Promise<string[]> {
  const reponse = await fetch(`${URL}/rest/v1/`, {
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}` },
  });
  if (!reponse.ok) throw new Error(`Description de l'API illisible : ${reponse.status}`);
  const spec = (await reponse.json()) as {
    definitions?: Record<string, unknown>;
    paths?: Record<string, unknown>;
  };

  // Les chemins font foi plutot que `definitions` : un chemin `/nom` existe
  // pour ce qui est interrogeable, et pour cela seulement.
  const chemins = Object.keys(spec.paths ?? {});
  return chemins
    .filter((c) => /^\/[a-z_][a-z0-9_]*$/.test(c))
    .map((c) => c.slice(1))
    .filter((t) => t !== 'rpc')
    .sort();
}

/** Toutes les lignes d'une table, page par page, en NDJSON. */
async function exporterTable(
  sb: ReturnType<typeof client>,
  table: string,
  chemin: string,
): Promise<EntreeTable> {
  const morceaux: string[] = [];
  let lignes = 0;

  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await sb.from(table).select('*').range(debut, debut + PAGE - 1);
    if (error) throw new Error(`${table} : ${error.message}`);
    if (!data || data.length === 0) break;
    for (const ligne of data) morceaux.push(JSON.stringify(ligne));
    lignes += data.length;
    if (data.length < PAGE) break;
  }

  const contenu = morceaux.length ? `${morceaux.join('\n')}\n` : '';
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, contenu, 'utf8');

  return {
    lignes,
    octets: Buffer.byteLength(contenu),
    empreinte: createHash('sha256').update(contenu).digest('hex').slice(0, 16),
  };
}

/** Parcourt un bucket en profondeur — `list` ne descend pas tout seul. */
async function listerFichiers(
  sb: ReturnType<typeof client>,
  bucket: string,
  prefixe = '',
): Promise<string[]> {
  const { data, error } = await sb.storage.from(bucket).list(prefixe, { limit: 1000 });
  if (error) throw new Error(`${bucket}/${prefixe} : ${error.message}`);

  const trouves: string[] = [];
  for (const entree of data ?? []) {
    const complet = prefixe ? `${prefixe}/${entree.name}` : entree.name;
    // Une entree sans `id` est un dossier : Storage n'a pas de type explicite.
    if (entree.id === null) trouves.push(...(await listerFichiers(sb, bucket, complet)));
    else trouves.push(complet);
  }
  return trouves;
}

async function sauvegarder(destination: string): Promise<void> {
  const sb = client();
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const racine = join(destination, horodatage);

  console.log(`Sauvegarde vers ${racine}\n`);

  // --- Les donnees ---------------------------------------------------------
  const tables = await listerTables();
  console.log(`${tables.length} tables exposees par l'API`);
  const inventaire: Record<string, EntreeTable> = {};
  let totalLignes = 0;

  for (const table of tables) {
    const entree = await exporterTable(sb, table, join(racine, 'donnees', `${table}.ndjson`));
    inventaire[table] = entree;
    totalLignes += entree.lignes;
    if (entree.lignes > 0) console.log(`  ${table.padEnd(28)} ${entree.lignes}`);
  }
  console.log(`  -> ${totalLignes} lignes\n`);

  // --- Les fichiers --------------------------------------------------------
  const { data: buckets, error: erreurBuckets } = await sb.storage.listBuckets();
  if (erreurBuckets) throw new Error(`Buckets illisibles : ${erreurBuckets.message}`);

  let nombreFichiers = 0;
  let octetsFichiers = 0;
  const parBucket: Record<string, number> = {};

  for (const bucket of buckets ?? []) {
    const fichiers = await listerFichiers(sb, bucket.name);
    parBucket[bucket.name] = fichiers.length;
    console.log(`bucket ${bucket.name} : ${fichiers.length} fichiers`);

    for (const fichier of fichiers) {
      const { data, error } = await sb.storage.from(bucket.name).download(fichier);
      if (error || !data) {
        throw new Error(`${bucket.name}/${fichier} : ${error?.message ?? 'illisible'}`);
      }
      const octets = Buffer.from(await data.arrayBuffer());
      const cible = join(racine, 'fichiers', bucket.name, fichier);
      mkdirSync(dirname(cible), { recursive: true });
      writeFileSync(cible, octets);
      nombreFichiers += 1;
      octetsFichiers += octets.length;
    }
  }
  console.log(`  -> ${nombreFichiers} fichiers, ${(octetsFichiers / 1024 / 1024).toFixed(1)} Mo\n`);

  // --- Les comptes ---------------------------------------------------------
  const comptes: unknown[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Comptes illisibles : ${error.message}`);
    if (!data.users.length) break;
    for (const u of data.users) {
      comptes.push({
        id: u.id,
        email: u.email,
        app_metadata: u.app_metadata,
        created_at: u.created_at,
        banned_until: (u as { banned_until?: string }).banned_until ?? null,
      });
    }
    if (data.users.length < 200) break;
  }
  writeFileSync(
    join(racine, 'comptes.ndjson'),
    comptes.map((c) => JSON.stringify(c)).join('\n') + '\n',
    'utf8',
  );
  console.log(`${comptes.length} comptes Auth\n`);

  // --- Le manifeste --------------------------------------------------------
  const dossierMigrations = join(RACINE, 'supabase', 'migrations');
  if (!existsSync(dossierMigrations)) {
    throw new Error(`Migrations introuvables dans ${dossierMigrations}`);
  }
  const migrations = readdirSync(dossierMigrations)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const manifeste: Manifeste = {
    faiteLe: new Date().toISOString(),
    projet: URL!,
    derniereMigration: migrations[migrations.length - 1] ?? 'inconnue',
    tables: inventaire,
    fichiers: { nombre: nombreFichiers, octets: octetsFichiers, buckets: parBucket },
    comptes: comptes.length,
    limites: [
      "Le schema n'est pas ici : il vit dans supabase/migrations/, donc dans Git.",
      "Les mots de passe ne sont pas exportables : une restauration impose une reinitialisation pour chaque compte.",
      "Les politiques RLS et les fonctions viennent des migrations, pas de ce dossier.",
    ],
  };
  writeFileSync(join(racine, 'manifeste.json'), JSON.stringify(manifeste, null, 2), 'utf8');

  console.log(`Manifeste ecrit. Derniere migration : ${manifeste.derniereMigration}`);
  console.log(`\nPour relire cette sauvegarde :`);
  console.log(`  npx tsx scripts/sauvegarde.ts --verifier "${racine}"`);
}

/**
 * Relit une sauvegarde et la compare a la base.
 *
 * Une sauvegarde qu'on n'a jamais relue n'est pas une sauvegarde. Ce mode
 * recompte en base et signale tout ecart — y compris les tables qui ont **plus**
 * de lignes aujourd'hui, ce qui est normal, et celles qui en ont moins, ce qui
 * ne l'est pas.
 */
async function verifier(dossier: string): Promise<void> {
  const sb = client();
  const chemin = join(dossier, 'manifeste.json');
  if (!existsSync(chemin)) throw new Error(`Aucun manifeste dans ${dossier}`);

  const manifeste = JSON.parse(readFileSync(chemin, 'utf8')) as Manifeste;
  console.log(`Sauvegarde du ${manifeste.faiteLe}`);
  console.log(`Migration : ${manifeste.derniereMigration}\n`);

  let anomalies = 0;

  for (const [table, entree] of Object.entries(manifeste.tables)) {
    const fichier = join(dossier, 'donnees', `${table}.ndjson`);
    if (!existsSync(fichier)) {
      console.log(`  MANQUE  ${table} : fichier absent de la sauvegarde`);
      anomalies += 1;
      continue;
    }
    const contenu = readFileSync(fichier, 'utf8');
    const lignesFichier = contenu ? contenu.trimEnd().split('\n').length : 0;
    if (lignesFichier !== entree.lignes) {
      console.log(`  ALTERE  ${table} : ${lignesFichier} lignes sur disque, ${entree.lignes} annoncees`);
      anomalies += 1;
      continue;
    }

    const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
    if (error) continue;
    if ((count ?? 0) < entree.lignes) {
      console.log(`  PERTE   ${table} : ${count} en base, ${entree.lignes} dans la sauvegarde`);
      anomalies += 1;
    }
  }

  let fichiersTrouves = 0;
  for (const [bucket, attendu] of Object.entries(manifeste.fichiers.buckets)) {
    const racineBucket = join(dossier, 'fichiers', bucket);
    const compter = (d: string): number =>
      existsSync(d)
        ? readdirSync(d, { withFileTypes: true }).reduce(
            (n, e) => n + (e.isDirectory() ? compter(join(d, e.name)) : 1),
            0,
          )
        : 0;
    const trouves = compter(racineBucket);
    fichiersTrouves += trouves;
    if (trouves !== attendu) {
      console.log(`  ALTERE  bucket ${bucket} : ${trouves} fichiers sur disque, ${attendu} annonces`);
      anomalies += 1;
    }
  }

  const comptes = join(dossier, 'comptes.ndjson');
  const nbComptes = existsSync(comptes)
    ? readFileSync(comptes, 'utf8').trimEnd().split('\n').filter(Boolean).length
    : 0;
  if (nbComptes !== manifeste.comptes) {
    console.log(`  ALTERE  comptes : ${nbComptes} sur disque, ${manifeste.comptes} annonces`);
    anomalies += 1;
  }

  const poids = (
    Object.values(manifeste.tables).reduce((n, t) => n + t.octets, 0) + manifeste.fichiers.octets
  );
  console.log(
    `\n${Object.keys(manifeste.tables).length} tables, ${fichiersTrouves} fichiers, ` +
      `${nbComptes} comptes, ${(poids / 1024 / 1024).toFixed(1)} Mo.`,
  );

  for (const limite of manifeste.limites) console.log(`  note : ${limite}`);

  if (anomalies > 0) {
    console.error(`\n${anomalies} anomalie(s). Cette sauvegarde n'est pas fiable.`);
    process.exit(1);
  }
  console.log('\nSauvegarde relue sans anomalie.');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const iVerif = args.indexOf('--verifier');
  if (iVerif !== -1) {
    const dossier = args[iVerif + 1];
    if (!dossier) throw new Error('--verifier attend le chemin du dossier de sauvegarde');
    await verifier(dossier);
    return;
  }

  const iVers = args.indexOf('--vers');
  // Sans `--vers`, on ecrit dans le depot — jamais dans le dossier courant, qui
  // depend d'ou la commande a ete tapee et disperserait les sauvegardes.
  // `sauvegardes/` est ignore par Git, precisement pour ce cas.
  const destination = iVers !== -1 ? args[iVers + 1] : join(RACINE, 'sauvegardes');
  if (!destination) throw new Error('--vers attend un chemin');
  await sauvegarder(resolve(destination));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
