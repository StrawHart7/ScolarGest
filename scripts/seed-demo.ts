/**
 * Jeu de données fictives pour les tests manuels.
 *
 * Peuple un établissement existant avec un cursus complet (cycles, classes,
 * matières, programme, coefficients, élèves, responsables, inscriptions,
 * enseignants, affectations, évaluations, notes) et le volet financier
 * (types de frais, tarifs, factures, paiements) afin de pouvoir exercer les
 * écrans Phase 2 à Phase 5 (dont bulletins et reçus) sans saisie manuelle.
 *
 * Le script écrit avec la clé service-role (RLS contournée) — usage local
 * uniquement, jamais depuis l'application.
 *
 * Usage:
 *   npm run seed:demo -- --etablissement <uuid> [--force]
 *   npm run seed:demo -- --list          (affiche les établissements)
 *   npm run seed:demo -- --purge --etablissement <uuid>
 *
 * `--purge` supprime UNIQUEMENT les données produites par ce script
 * (repérées par les préfixes de matricule DEMO). Réservé aux bases de test:
 * les invariants "pas de suppression physique" du produit ne s'appliquent
 * pas à un jeu de démonstration, mais ne l'exécutez jamais sur une base
 * contenant de vraies données.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ------------------------------------------------------------------
// Environnement
// ------------------------------------------------------------------

function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv();
const db: SupabaseClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ------------------------------------------------------------------
// Utilitaires
// ------------------------------------------------------------------

/** PRNG déterministe: deux exécutions produisent le même jeu de données. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260819);

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)] as T;
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
/** Note tirée autour d'un niveau moyen, bornée [0, 20] et arrondie au quart. */
function noteAleatoire(centre: number, dispersion: number): number {
  const v = centre + (rnd() + rnd() + rnd() - 1.5) * dispersion;
  return Math.max(0, Math.min(20, Math.round(v * 4) / 4));
}

function fail(msg: string): never {
  console.error(`\nErreur: ${msg}\n`);
  process.exit(1);
}

async function insert(
  table: string,
  rows: Record<string, unknown>[],
  select = 'id',
): Promise<{ id: string }[]> {
  if (rows.length === 0) return [];
  const out: { id: string }[] = [];
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { data, error } = await db.from(table).insert(slice).select(select);
    if (error) fail(`insert ${table} (lot ${i / CHUNK + 1}): ${error.message}`);
    out.push(...((data ?? []) as unknown as { id: string }[]));
    process.stdout.write(`\r  ${table}: ${out.length}/${rows.length}   `);
  }
  process.stdout.write(`\r  ${table}: ${out.length} lignes\n`);
  return out;
}

// ------------------------------------------------------------------
// Corpus de noms (Togo)
// ------------------------------------------------------------------

const NOMS = [
  'Adjovi', 'Agbeko', 'Agbodeka', 'Ahiavi', 'Akakpo', 'Akoto', 'Amegan', 'Amouzou',
  'Anani', 'Apedo', 'Assogba', 'Atchou', 'Awity', 'Ayite', 'Bakoumbo', 'Bassa',
  'Dagbe', 'Dogbe', 'Edorh', 'Fiadjoe', 'Folly', 'Gbedemah', 'Gnassingbe', 'Hounkpe',
  'Johnson', 'Kacou', 'Kodjo', 'Komlan', 'Lawson', 'Mensah', 'Nyaku', 'Ouro-Agoro',
  'Pana', 'Quashie', 'Sagbo', 'Sanvee', 'Tchalla', 'Tetteh', 'Vovor', 'Zinsou',
] as const;

const PRENOMS_M = [
  'Kossi', 'Komlan', 'Yao', 'Kodjo', 'Afi', 'Selom', 'Mawuli', 'Sena', 'Elom',
  'Kwami', 'Edem', 'Koffi', 'Dodzi', 'Etse', 'Nyuiadzi', 'Emmanuel', 'Jean-Marc',
  'Prosper', 'Isaac', 'Bertrand', 'Rodrigue', 'Fabrice', 'Samuel', 'Olivier',
] as const;

const PRENOMS_F = [
  'Akouvi', 'Adjoa', 'Ablavi', 'Afiwa', 'Sena', 'Enyonam', 'Mawusi', 'Delali',
  'Yawa', 'Essenam', 'Akosua', 'Sitsofe', 'Edoh', 'Rachelle', 'Bernadette',
  'Christelle', 'Fabiola', 'Gracia', 'Larissa', 'Muriel', 'Nadege', 'Sylvie',
] as const;

const VILLES = ['Lomé', 'Kpalimé', 'Sokodé', 'Kara', 'Atakpamé', 'Aného', 'Tsévié', 'Dapaong'] as const;
const PROFESSIONS = [
  'Commerçant', 'Enseignante', 'Infirmier', 'Fonctionnaire', 'Couturière',
  'Mécanicien', 'Agriculteur', 'Comptable', 'Chauffeur', 'Coiffeuse', 'Maçon',
] as const;
const QUARTIERS = [
  'Bè-Kpota', 'Adidogomé', 'Agoè-Nyivé', 'Tokoin', 'Nyékonakpoè', 'Hédzranawoé',
  'Baguida', 'Kodjoviakopé', 'Attiégou', 'Djidjolé',
] as const;

// ------------------------------------------------------------------
// Référentiel pédagogique
// ------------------------------------------------------------------

const MATIERES = [
  { nom: 'Français', code: 'FRA' },
  { nom: 'Mathématiques', code: 'MAT' },
  { nom: 'Anglais', code: 'ANG' },
  { nom: 'Histoire-Géographie', code: 'HG' },
  { nom: 'Sciences de la Vie et de la Terre', code: 'SVT' },
  { nom: 'Physique-Chimie', code: 'PC' },
  { nom: 'Education Civique et Morale', code: 'ECM' },
  { nom: 'Education Physique et Sportive', code: 'EPS' },
  { nom: 'Informatique', code: 'INFO' },
  { nom: 'Philosophie', code: 'PHILO' },
] as const;

type CodeMatiere = (typeof MATIERES)[number]['code'];

/** Programme + coefficient par cycle. Les coefficients par série surchargent. */
const PROGRAMME_PAR_CYCLE: Record<string, { code: CodeMatiere; coef: number; obligatoire: boolean }[]> = {
  COLLEGE: [
    { code: 'FRA', coef: 4, obligatoire: true },
    { code: 'MAT', coef: 4, obligatoire: true },
    { code: 'ANG', coef: 3, obligatoire: true },
    { code: 'HG', coef: 3, obligatoire: true },
    { code: 'SVT', coef: 2, obligatoire: true },
    { code: 'PC', coef: 2, obligatoire: true },
    { code: 'ECM', coef: 1, obligatoire: true },
    { code: 'EPS', coef: 1, obligatoire: false },
    { code: 'INFO', coef: 1, obligatoire: false },
  ],
  LYCEE: [
    { code: 'FRA', coef: 3, obligatoire: true },
    { code: 'MAT', coef: 4, obligatoire: true },
    { code: 'ANG', coef: 2, obligatoire: true },
    { code: 'HG', coef: 2, obligatoire: true },
    { code: 'SVT', coef: 3, obligatoire: true },
    { code: 'PC', coef: 4, obligatoire: true },
    { code: 'PHILO', coef: 2, obligatoire: true },
    { code: 'ECM', coef: 1, obligatoire: true },
    { code: 'EPS', coef: 1, obligatoire: false },
    { code: 'INFO', coef: 1, obligatoire: false },
  ],
};

/** Surcharges de coefficient par série (série C = maths, D = sciences nat.). */
const COEF_PAR_SERIE: Record<string, Partial<Record<CodeMatiere, number>>> = {
  C: { MAT: 6, PC: 5, SVT: 2, FRA: 2, PHILO: 2 },
  D: { MAT: 4, PC: 4, SVT: 5, FRA: 2, PHILO: 2 },
  A4: { FRA: 5, PHILO: 5, HG: 4, MAT: 1, PC: 1, SVT: 1 },
};

/** Classes à créer: niveau, série éventuelle, suffixe, effectif. */
const CLASSES_A_CREER = [
  { niveau: '6ème', serie: null, nom: '6ème A', effectif: 26 },
  { niveau: '6ème', serie: null, nom: '6ème B', effectif: 26 },
  { niveau: '5ème', serie: null, nom: '5ème A', effectif: 24 },
  { niveau: '4ème', serie: null, nom: '4ème A', effectif: 24 },
  { niveau: '3ème', serie: null, nom: '3ème A', effectif: 22 },
  { niveau: '2nde', serie: null, nom: '2nde A', effectif: 22 },
  { niveau: '1ère', serie: 'D', nom: '1ère D', effectif: 20 },
  { niveau: 'Tle', serie: 'C', nom: 'Tle C', effectif: 18 },
] as const;

const TYPES_FRAIS = [
  { nom: 'Frais d’inscription', description: 'Payable à l’inscription' },
  { nom: 'Scolarité 1er trimestre', description: 'Echéance octobre' },
  { nom: 'Scolarité 2e trimestre', description: 'Echéance janvier' },
  { nom: 'Scolarité 3e trimestre', description: 'Echéance avril' },
  { nom: 'Cantine', description: 'Option annuelle' },
  { nom: 'Transport scolaire', description: 'Option annuelle' },
  { nom: 'Tenue scolaire', description: 'Deux tenues' },
] as const;

/** Tarifs par cycle: inscription, scolarité/trimestre, cantine, transport, tenue. */
const TARIFS_PAR_CYCLE: Record<string, number[]> = {
  COLLEGE: [20000, 65000, 65000, 65000, 60000, 50000, 15000],
  LYCEE: [25000, 85000, 85000, 85000, 60000, 50000, 15000],
};

const PERIODES = ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'] as const;
type Periode = (typeof PERIODES)[number];

/** Fenêtre de dates d'évaluation par trimestre (année scolaire 2025-2026). */
const FENETRE_PERIODE: Record<Periode, [string, string]> = {
  TRIMESTRE_1: ['2025-10-06', '2025-12-12'],
  TRIMESTRE_2: ['2026-01-12', '2026-03-20'],
  TRIMESTRE_3: ['2026-04-13', '2026-06-19'],
};

function dateDansFenetre(p: Periode, ratio: number): string {
  const [d1, d2] = FENETRE_PERIODE[p];
  const t1 = Date.parse(`${d1}T09:00:00Z`);
  const t2 = Date.parse(`${d2}T09:00:00Z`);
  return new Date(t1 + (t2 - t1) * ratio).toISOString();
}

const MODES_PAIEMENT = ['ESPECES', 'ESPECES', 'MOBILE_MONEY', 'MOBILE_MONEY', 'VIREMENT', 'CHEQUE'] as const;

// ------------------------------------------------------------------
// Arguments
// ------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
};

const MATRICULE_ELEVE_PREFIX = 'ELV-';
const MATRICULE_ENSEIGNANT_PREFIX = 'ENS-';

async function listerEtablissements() {
  const { data, error } = await db.from('etablissement').select('id, nom, ville, statut');
  if (error) fail(error.message);
  console.log('\nEtablissements:\n');
  for (const e of data ?? []) {
    console.log(`  ${e.id}  ${e.nom}${e.ville ? ` (${e.ville})` : ''}  [${e.statut}]`);
  }
  console.log('');
}

// ------------------------------------------------------------------
// Purge (bases de test uniquement)
// ------------------------------------------------------------------

async function purger(etablissementId: string) {
  console.log('\nPurge des données de démonstration...');
  const ids = async (table: string, col = 'etablissementId') => {
    const { data, error } = await db.from(table).select('id').eq(col, etablissementId);
    if (error) fail(`${table}: ${error.message}`);
    return (data ?? []).map((r: { id: string }) => r.id);
  };

  const factureIds = await ids('facture_eleve');
  const eleveIds = await ids('eleve');
  const classeIds = await ids('classe');

  const del = async (table: string, col: string, values: string[]) => {
    if (values.length === 0) return;
    for (let i = 0; i < values.length; i += 200) {
      const { error } = await db.from(table).delete().in(col, values.slice(i, i + 200));
      if (error) fail(`delete ${table}: ${error.message}`);
    }
    console.log(`  ${table}: purgé`);
  };

  await del('paiement', 'factureId', factureIds);
  await del('ligne_facture', 'factureId', factureIds);
  await del('facture_eleve', 'id', factureIds);

  const { data: evals } = await db.from('evaluation').select('id').in('classeId', classeIds);
  const evalIds = (evals ?? []).map((e: { id: string }) => e.id);
  await del('note', 'evaluationId', evalIds);
  await del('evaluation', 'id', evalIds);

  await del('eleve_responsable', 'eleveId', eleveIds);
  await del('inscription', 'eleveId', eleveIds);
  await del('eleve', 'id', eleveIds);
  await del('responsable', 'id', await ids('responsable'));

  await del('titularite_classe', 'classeId', classeIds);
  await del('affectation_enseignant', 'id', await ids('affectation_enseignant'));
  await del('enseignant', 'id', await ids('enseignant'));

  await del('tarif_scolaire', 'id', await ids('tarif_scolaire'));
  await del('type_frais', 'id', await ids('type_frais'));

  const { data: progs } = await db
    .from('programme_etablissement')
    .select('id')
    .eq('etablissementId', etablissementId);
  const progIds = (progs ?? []).map((p: { id: string }) => p.id);
  await del('coefficient_matiere', 'programmeEtablissementId', progIds);
  await del('programme_etablissement', 'id', progIds);
  await del('matiere', 'id', await ids('matiere'));
  await del('document', 'id', await ids('document'));

  // Les classes créées par le script portent un nom du référentiel ci-dessus.
  const nomsGeneres = CLASSES_A_CREER.map((c) => c.nom);
  const { error: classeErr } = await db
    .from('classe')
    .delete()
    .eq('etablissementId', etablissementId)
    .in('nom', nomsGeneres);
  if (classeErr) fail(`delete classe: ${classeErr.message}`);
  console.log('  classe: purgé (classes générées)');

  console.log('\nPurge terminée.\n');
}

// ------------------------------------------------------------------
// Seed
// ------------------------------------------------------------------

async function seed(etablissementId: string, force: boolean) {
  const { data: etab, error: etabErr } = await db
    .from('etablissement')
    .select('id, nom, ville')
    .eq('id', etablissementId)
    .maybeSingle();
  if (etabErr) fail(etabErr.message);
  if (!etab) fail(`Etablissement ${etablissementId} introuvable.`);

  const { count: nbEleves } = await db
    .from('eleve')
    .select('*', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId);
  if ((nbEleves ?? 0) > 0 && !force) {
    fail(
      `${etab.nom} contient déjà ${nbEleves} élève(s). Relancez avec --force pour ajouter, ` +
        'ou --purge pour repartir de zéro.',
    );
  }

  const { data: annee, error: anneeErr } = await db
    .from('annee_scolaire')
    .select('id, libelle, dateDebut, dateFin')
    .eq('etablissementId', etablissementId)
    .eq('statut', 'ACTIVE')
    .maybeSingle();
  if (anneeErr) fail(anneeErr.message);
  if (!annee) fail(`Aucune année scolaire ACTIVE pour ${etab.nom}. Créez-en une d'abord.`);

  const anneeId = annee.id as string;
  const anneeDebut = new Date(annee.dateDebut as string).getUTCFullYear();
  console.log(`\nEtablissement : ${etab.nom}`);
  console.log(`Année scolaire: ${annee.libelle} (${anneeId})\n`);

  // --- Catalogues système ---------------------------------------------
  const { data: cyclesRows } = await db.from('cycle').select('id, nom');
  const cycleParNom = new Map((cyclesRows ?? []).map((c: { id: string; nom: string }) => [c.nom, c.id]));
  const { data: niveauxRows } = await db.from('niveau').select('id, nom, cycleId');
  const niveauParNom = new Map(
    (niveauxRows ?? []).map((n: { id: string; nom: string; cycleId: string }) => [n.nom, n]),
  );
  const { data: seriesRows } = await db.from('serie').select('id, nom');
  const serieParNom = new Map((seriesRows ?? []).map((s: { id: string; nom: string }) => [s.nom, s.id]));
  const cycleNomParId = new Map((cyclesRows ?? []).map((c: { id: string; nom: string }) => [c.id, c.nom]));

  // --- Cycles activés pour l'établissement -----------------------------
  const { data: cyclesEtab } = await db
    .from('cycle_etablissement')
    .select('cycleId')
    .eq('etablissementId', etablissementId);
  const dejaActifs = new Set((cyclesEtab ?? []).map((c: { cycleId: string }) => c.cycleId));
  const aActiver = ['COLLEGE', 'LYCEE']
    .map((n) => cycleParNom.get(n)!)
    .filter((id) => !dejaActifs.has(id))
    .map((cycleId) => ({ etablissementId, cycleId, actif: true }));
  await insert('cycle_etablissement', aActiver);

  // --- Matières ---------------------------------------------------------
  const { data: matieresExistantes } = await db
    .from('matiere')
    .select('id, nom')
    .eq('etablissementId', etablissementId);
  const matiereParNom = new Map(
    (matieresExistantes ?? []).map((m: { id: string; nom: string }) => [m.nom, m.id]),
  );
  const matieresACreer = MATIERES.filter((m) => !matiereParNom.has(m.nom)).map((m) => ({
    etablissementId,
    nom: m.nom,
    code: m.code,
    statut: 'ACTIF',
  }));
  const nouvellesMatieres = await insert('matiere', matieresACreer, 'id, nom');
  for (const m of nouvellesMatieres as unknown as { id: string; nom: string }[]) {
    matiereParNom.set(m.nom, m.id);
  }
  const matiereParCode = new Map(
    MATIERES.map((m) => [m.code as CodeMatiere, matiereParNom.get(m.nom)!]),
  );

  // --- Classes ----------------------------------------------------------
  const { data: classesExistantes } = await db
    .from('classe')
    .select('id, nom, niveauId, serieId')
    .eq('etablissementId', etablissementId)
    .eq('anneeScolaireId', anneeId);
  const classeParNom = new Map(
    (classesExistantes ?? []).map((c: { nom: string }) => [c.nom, c as unknown as ClasseRef]),
  );

  const classesACreer = CLASSES_A_CREER.filter((c) => !classeParNom.has(c.nom)).map((c) => ({
    etablissementId,
    anneeScolaireId: anneeId,
    niveauId: niveauParNom.get(c.niveau)!.id,
    serieId: c.serie ? serieParNom.get(c.serie)! : null,
    nom: c.nom,
    capacite: c.effectif + 5,
  }));
  const nouvellesClasses = await insert('classe', classesACreer, 'id, nom, niveauId, serieId');
  for (const c of nouvellesClasses as unknown as ClasseRef[]) classeParNom.set(c.nom, c);

  interface ClasseRef {
    id: string;
    nom: string;
    niveauId: string;
    serieId: string | null;
  }

  /** Classes à peupler: celles du référentiel + celles déjà présentes en base. */
  const classes: (ClasseRef & { effectif: number; cycle: string })[] = [];
  for (const [nom, ref] of classeParNom) {
    const prevu = CLASSES_A_CREER.find((c) => c.nom === nom);
    const niveau = (niveauxRows ?? []).find((n: { id: string }) => n.id === ref.niveauId)!;
    const cycle = cycleNomParId.get(niveau.cycleId)!;
    classes.push({ ...ref, effectif: prevu?.effectif ?? int(12, 18), cycle });
  }
  console.log(`  classes à peupler: ${classes.length}`);

  // --- Programme + coefficients ----------------------------------------
  const niveauxUtilises = [...new Set(classes.map((c) => c.niveauId))];
  const { data: progExistants } = await db
    .from('programme_etablissement')
    .select('id, niveauId, matiereId')
    .eq('etablissementId', etablissementId);
  const cleProg = (n: string, m: string) => `${n}|${m}`;
  const progParCle = new Map(
    (progExistants ?? []).map((p: { id: string; niveauId: string; matiereId: string }) => [
      cleProg(p.niveauId, p.matiereId),
      p.id,
    ]),
  );

  const progsACreer: Record<string, unknown>[] = [];
  for (const niveauId of niveauxUtilises) {
    const niveau = (niveauxRows ?? []).find((n: { id: string }) => n.id === niveauId)!;
    const cycle = cycleNomParId.get(niveau.cycleId)!;
    const plan = PROGRAMME_PAR_CYCLE[cycle];
    if (!plan) continue;
    plan.forEach((item, ordre) => {
      const matiereId = matiereParCode.get(item.code)!;
      if (progParCle.has(cleProg(niveauId, matiereId))) return;
      progsACreer.push({
        etablissementId,
        niveauId,
        matiereId,
        obligatoire: item.obligatoire,
        ordreAffichage: ordre,
      });
    });
  }
  const nouveauxProgs = await insert('programme_etablissement', progsACreer, 'id, niveauId, matiereId');
  for (const p of nouveauxProgs as unknown as { id: string; niveauId: string; matiereId: string }[]) {
    progParCle.set(cleProg(p.niveauId, p.matiereId), p.id);
  }

  // Un coefficient par (programme, année, série effectivement utilisée par une classe).
  const seriesParNiveau = new Map<string, Set<string | null>>();
  for (const c of classes) {
    if (!seriesParNiveau.has(c.niveauId)) seriesParNiveau.set(c.niveauId, new Set());
    seriesParNiveau.get(c.niveauId)!.add(c.serieId);
  }
  const serieNomParId = new Map(
    (seriesRows ?? []).map((s: { id: string; nom: string }) => [s.id, s.nom]),
  );

  const { data: coefExistants } = await db
    .from('coefficient_matiere')
    .select('programmeEtablissementId, serieId')
    .eq('anneeScolaireId', anneeId);
  const cleCoef = (p: string, s: string | null) => `${p}|${s ?? 'null'}`;
  const coefsPresents = new Set(
    (coefExistants ?? []).map((c: { programmeEtablissementId: string; serieId: string | null }) =>
      cleCoef(c.programmeEtablissementId, c.serieId),
    ),
  );

  const coefsACreer: Record<string, unknown>[] = [];
  for (const niveauId of niveauxUtilises) {
    const niveau = (niveauxRows ?? []).find((n: { id: string }) => n.id === niveauId)!;
    const cycle = cycleNomParId.get(niveau.cycleId)!;
    const plan = PROGRAMME_PAR_CYCLE[cycle];
    if (!plan) continue;
    for (const serieId of seriesParNiveau.get(niveauId) ?? [null]) {
      const serieNom = serieId ? serieNomParId.get(serieId) : undefined;
      for (const item of plan) {
        const progId = progParCle.get(cleProg(niveauId, matiereParCode.get(item.code)!));
        if (!progId || coefsPresents.has(cleCoef(progId, serieId))) continue;
        const surcharge = serieNom ? COEF_PAR_SERIE[serieNom]?.[item.code] : undefined;
        coefsACreer.push({
          programmeEtablissementId: progId,
          anneeScolaireId: anneeId,
          serieId,
          coefficient: surcharge ?? item.coef,
        });
        coefsPresents.add(cleCoef(progId, serieId));
      }
    }
  }
  await insert('coefficient_matiere', coefsACreer);

  // --- Enseignants -------------------------------------------------------
  const { data: ensExistants } = await db
    .from('enseignant')
    .select('matricule')
    .eq('etablissementId', etablissementId);
  let seqEns = (ensExistants ?? []).length;

  const NB_ENSEIGNANTS = 28;
  const enseignantsACreer = Array.from({ length: NB_ENSEIGNANTS }, () => {
    seqEns += 1;
    const sexe = rnd() < 0.55 ? 'M' : 'F';
    const prenoms = sexe === 'M' ? pick(PRENOMS_M) : pick(PRENOMS_F);
    const nom = pick(NOMS);
    return {
      etablissementId,
      matricule: `${MATRICULE_ENSEIGNANT_PREFIX}${anneeDebut}-${String(seqEns).padStart(4, '0')}`,
      nom,
      prenoms,
      sexe,
      dateNaissance: new Date(Date.UTC(int(1970, 1996), int(0, 11), int(1, 28))).toISOString(),
      telephone: `9${int(0, 9)}${int(100000, 999999)}`,
      email: `${prenoms.toLowerCase().replace(/[^a-z]/g, '')}.${nom.toLowerCase().replace(/[^a-z]/g, '')}${seqEns}@exemple.tg`,
      adresse: `${pick(QUARTIERS)}, ${pick(VILLES)}`,
      dateEmbauche: new Date(Date.UTC(int(2015, 2025), int(0, 11), int(1, 28))).toISOString(),
      statut: rnd() < 0.9 ? 'ACTIF' : pick(['CONGE', 'INACTIF'] as const),
    };
  });
  const enseignants = (await insert(
    'enseignant',
    enseignantsACreer,
    'id, nom, prenoms',
  )) as unknown as { id: string; nom: string; prenoms: string }[];

  // --- Affectations + titularités ---------------------------------------
  const affectations: Record<string, unknown>[] = [];
  const titularites: Record<string, unknown>[] = [];
  const { data: titExistantes } = await db
    .from('titularite_classe')
    .select('classeId')
    .eq('anneeScolaireId', anneeId);
  const dejaTitulaire = new Set((titExistantes ?? []).map((t: { classeId: string }) => t.classeId));

  classes.forEach((classe, idx) => {
    const niveau = (niveauxRows ?? []).find((n: { id: string }) => n.id === classe.niveauId)!;
    const plan = PROGRAMME_PAR_CYCLE[cycleNomParId.get(niveau.cycleId)!] ?? [];
    plan.forEach((item, j) => {
      const ens = enseignants[(idx * 3 + j * 5) % enseignants.length]!;
      affectations.push({
        etablissementId,
        anneeScolaireId: anneeId,
        enseignantId: ens.id,
        classeId: classe.id,
        matiereId: matiereParCode.get(item.code)!,
      });
    });
    if (!dejaTitulaire.has(classe.id)) {
      titularites.push({
        anneeScolaireId: anneeId,
        classeId: classe.id,
        enseignantId: enseignants[idx % enseignants.length]!.id,
      });
    }
  });
  await insert('affectation_enseignant', affectations);
  await insert('titularite_classe', titularites);

  // --- Elèves, responsables, inscriptions --------------------------------
  const { data: elevesExistants } = await db
    .from('eleve')
    .select('matricule')
    .eq('etablissementId', etablissementId);
  let seqEleve = (elevesExistants ?? []).length;

  const elevesACreer: Record<string, unknown>[] = [];
  const affectationEleve: { classeIdx: number }[] = [];
  classes.forEach((classe, classeIdx) => {
    const niveau = (niveauxRows ?? []).find((n: { id: string }) => n.id === classe.niveauId)!;
    const cycle = cycleNomParId.get(niveau.cycleId)!;
    const ageBase = cycle === 'COLLEGE' ? 13 : 17;
    for (let i = 0; i < classe.effectif; i += 1) {
      seqEleve += 1;
      const sexe = rnd() < 0.5 ? 'M' : 'F';
      const prenoms =
        rnd() < 0.35
          ? `${sexe === 'M' ? pick(PRENOMS_M) : pick(PRENOMS_F)} ${sexe === 'M' ? pick(PRENOMS_M) : pick(PRENOMS_F)}`
          : sexe === 'M'
            ? pick(PRENOMS_M)
            : pick(PRENOMS_F);
      const naissance = anneeDebut - ageBase - int(0, 1);
      elevesACreer.push({
        etablissementId,
        matricule: `${MATRICULE_ELEVE_PREFIX}${anneeDebut}-${String(seqEleve).padStart(6, '0')}`,
        nom: pick(NOMS),
        prenoms,
        sexe,
        dateNaissance: new Date(Date.UTC(naissance, int(0, 11), int(1, 28))).toISOString(),
        lieuNaissance: pick(VILLES),
        nationalite: rnd() < 0.9 ? 'Togolaise' : pick(['Béninoise', 'Ghanéenne', 'Ivoirienne'] as const),
        statut: rnd() < 0.96 ? 'ACTIF' : pick(['TRANSFERE', 'INACTIF'] as const),
      });
      affectationEleve.push({ classeIdx });
    }
  });
  const eleves = (await insert('eleve', elevesACreer, 'id')) as { id: string }[];

  // Un responsable principal par élève, un second pour 40 % d'entre eux.
  const responsablesACreer: Record<string, unknown>[] = [];
  const liensPlan: { eleveIdx: number; respIdx: number; lien: string; principal: boolean }[] = [];
  eleves.forEach((_, eleveIdx) => {
    const nomFamille = (elevesACreer[eleveIdx] as { nom: string }).nom;
    const typePrincipal = rnd() < 0.55 ? 'PERE' : 'MERE';
    responsablesACreer.push({
      etablissementId,
      nom: nomFamille,
      prenoms: typePrincipal === 'PERE' ? pick(PRENOMS_M) : pick(PRENOMS_F),
      telephone: `9${int(0, 9)}${int(100000, 999999)}`,
      email: rnd() < 0.6 ? `resp${eleveIdx + 1}@exemple.tg` : null,
      adresse: `${pick(QUARTIERS)}, ${pick(VILLES)}`,
      profession: pick(PROFESSIONS),
      type: typePrincipal,
    });
    liensPlan.push({
      eleveIdx,
      respIdx: responsablesACreer.length - 1,
      lien: typePrincipal === 'PERE' ? 'Père' : 'Mère',
      principal: true,
    });
    if (rnd() < 0.4) {
      const second = typePrincipal === 'PERE' ? 'MERE' : 'PERE';
      responsablesACreer.push({
        etablissementId,
        nom: nomFamille,
        prenoms: second === 'PERE' ? pick(PRENOMS_M) : pick(PRENOMS_F),
        telephone: `9${int(0, 9)}${int(100000, 999999)}`,
        email: null,
        adresse: `${pick(QUARTIERS)}, ${pick(VILLES)}`,
        profession: pick(PROFESSIONS),
        type: second,
      });
      liensPlan.push({
        eleveIdx,
        respIdx: responsablesACreer.length - 1,
        lien: second === 'PERE' ? 'Père' : 'Mère',
        principal: false,
      });
    }
  });
  const responsables = (await insert('responsable', responsablesACreer, 'id')) as { id: string }[];
  await insert(
    'eleve_responsable',
    liensPlan.map((l) => ({
      eleveId: eleves[l.eleveIdx]!.id,
      responsableId: responsables[l.respIdx]!.id,
      lienParente: l.lien,
      principal: l.principal,
    })),
  );

  await insert(
    'inscription',
    eleves.map((e, i) => ({
      etablissementId,
      eleveId: e.id,
      anneeScolaireId: anneeId,
      classeId: classes[affectationEleve[i]!.classeIdx]!.id,
      dateInscription: new Date(Date.UTC(anneeDebut, 8, int(1, 28))).toISOString(),
      statut: (elevesACreer[i] as { statut: string }).statut === 'ACTIF' ? 'ACTIVE' : 'ABANDON',
    })),
  );

  // Elèves actifs par classe (base des notes et des factures).
  const elevesParClasse = new Map<string, string[]>();
  eleves.forEach((e, i) => {
    if ((elevesACreer[i] as { statut: string }).statut !== 'ACTIF') return;
    const classeId = classes[affectationEleve[i]!.classeIdx]!.id;
    if (!elevesParClasse.has(classeId)) elevesParClasse.set(classeId, []);
    elevesParClasse.get(classeId)!.push(e.id);
  });

  // --- Evaluations -------------------------------------------------------
  // Par classe × matière × trimestre: 2 interrogations, 1 devoir, 1 composition.
  const structure = [
    { type: 'INTERROGATION', numero: 1, ratio: 0.15 },
    { type: 'INTERROGATION', numero: 2, ratio: 0.4 },
    { type: 'DEVOIR', numero: 1, ratio: 0.6 },
    { type: 'COMPOSITION', numero: 1, ratio: 0.95 },
  ] as const;

  const evaluationsACreer: Record<string, unknown>[] = [];
  const metaEval: { classeId: string; periode: Periode; type: string }[] = [];
  for (const classe of classes) {
    const niveau = (niveauxRows ?? []).find((n: { id: string }) => n.id === classe.niveauId)!;
    const plan = PROGRAMME_PAR_CYCLE[cycleNomParId.get(niveau.cycleId)!] ?? [];
    for (const periode of PERIODES) {
      for (const item of plan) {
        for (const s of structure) {
          evaluationsACreer.push({
            anneeScolaireId: anneeId,
            classeId: classe.id,
            matiereId: matiereParCode.get(item.code)!,
            type: s.type,
            periode,
            numero: s.numero,
            date: dateDansFenetre(periode, s.ratio),
          });
          metaEval.push({ classeId: classe.id, periode, type: s.type });
        }
      }
    }
  }
  const evaluations = (await insert('evaluation', evaluationsACreer, 'id')) as { id: string }[];

  // --- Notes -------------------------------------------------------------
  // Niveau moyen propre à chaque élève, pour un classement stable et crédible.
  const niveauEleve = new Map<string, number>();
  for (const e of eleves) niveauEleve.set(e.id, 8 + rnd() * 8);

  // Une classe reste en saisie non validée au 3e trimestre, pour exercer le
  // circuit de soumission/approbation des notes.
  const classeEnSaisie = classes[classes.length - 1]?.id;

  const notesACreer: Record<string, unknown>[] = [];
  evaluations.forEach((ev, i) => {
    const meta = metaEval[i]!;
    const inscrits = elevesParClasse.get(meta.classeId) ?? [];
    for (const eleveId of inscrits) {
      // 2 % d'absences: note nulle non saisie.
      const absent = rnd() < 0.02;
      const centre = niveauEleve.get(eleveId)! + (meta.type === 'COMPOSITION' ? -0.7 : 0.3);
      let statut: string = 'VALIDE';
      if (meta.periode === 'TRIMESTRE_3' && meta.classeId === classeEnSaisie) {
        statut = rnd() < 0.5 ? 'BROUILLON' : 'SOUMISE';
      }
      notesACreer.push({
        evaluationId: ev.id,
        eleveId,
        valeur: absent ? null : noteAleatoire(centre, 2.6),
        observation: absent ? 'Absent' : null,
        statut,
      });
    }
  });
  await insert('note', notesACreer, 'id');

  // --- Finance -----------------------------------------------------------
  const { data: fraisExistants } = await db
    .from('type_frais')
    .select('id, nom')
    .eq('etablissementId', etablissementId);
  const fraisParNom = new Map(
    (fraisExistants ?? []).map((f: { id: string; nom: string }) => [f.nom, f.id]),
  );
  const fraisACreer = TYPES_FRAIS.filter((f) => !fraisParNom.has(f.nom)).map((f) => ({
    etablissementId,
    nom: f.nom,
    description: f.description,
    statut: 'ACTIF',
  }));
  const nouveauxFrais = await insert('type_frais', fraisACreer, 'id, nom');
  for (const f of nouveauxFrais as unknown as { id: string; nom: string }[]) {
    fraisParNom.set(f.nom, f.id);
  }
  const fraisOrdonnes = TYPES_FRAIS.map((f) => ({ nom: f.nom, id: fraisParNom.get(f.nom)! }));

  const tarifsACreer: Record<string, unknown>[] = [];
  const tarifParClasse = new Map<string, { typeFraisId: string; nom: string; montant: number }[]>();
  for (const classe of classes) {
    const grille = TARIFS_PAR_CYCLE[classe.cycle] ?? TARIFS_PAR_CYCLE.COLLEGE!;
    const lignes = fraisOrdonnes.map((f, i) => ({
      typeFraisId: f.id,
      nom: f.nom,
      montant: grille[i]!,
    }));
    tarifParClasse.set(classe.id, lignes);
    for (const l of lignes) {
      tarifsACreer.push({
        etablissementId,
        anneeScolaireId: anneeId,
        classeId: classe.id,
        typeFraisId: l.typeFraisId,
        montant: l.montant,
      });
    }
  }
  await insert('tarif_scolaire', tarifsACreer);

  // Une facture par élève inscrit: frais obligatoires + options tirées au sort.
  const facturesACreer: Record<string, unknown>[] = [];
  const lignesPlan: { factureIdx: number; typeFraisId: string; designation: string; montant: number }[] = [];
  const paiementsPlan: { factureIdx: number; montant: number; mode: string; date: string; statut: string }[] = [];

  eleves.forEach((eleve, i) => {
    if ((elevesACreer[i] as { statut: string }).statut !== 'ACTIF') return;
    const classe = classes[affectationEleve[i]!.classeIdx]!;
    const grille = tarifParClasse.get(classe.id)!;
    // Indices 0..3 obligatoires (inscription + 3 trimestres), 4..6 optionnels.
    const lignes = grille.filter((_, idx) => idx <= 3 || rnd() < 0.35);
    const total = lignes.reduce((s, l) => s + l.montant, 0);

    const tirage = rnd();
    const annulee = tirage > 0.985;
    let paye = 0;
    if (!annulee) {
      if (tirage < 0.45) paye = total;
      else if (tirage < 0.85) paye = Math.round((total * (0.3 + rnd() * 0.5)) / 500) * 500;
      else paye = 0;
    }

    const factureIdx = facturesACreer.length;
    facturesACreer.push({
      etablissementId,
      eleveId: eleve.id,
      anneeScolaireId: anneeId,
      montantTotal: total,
      statut: annulee ? 'ANNULE' : paye >= total ? 'PAYE' : paye > 0 ? 'PARTIEL' : 'IMPAYE',
      dateCreation: new Date(Date.UTC(anneeDebut, 8, int(20, 30))).toISOString(),
    });
    for (const l of lignes) {
      lignesPlan.push({
        factureIdx,
        typeFraisId: l.typeFraisId,
        designation: `${l.nom} - ${classe.nom}`,
        montant: l.montant,
      });
    }

    // Le montant payé est réparti sur 1 à 3 versements échelonnés.
    if (paye > 0) {
      const nbVersements = paye >= total ? int(2, 3) : int(1, 2);
      let reste = paye;
      for (let v = 0; v < nbVersements; v += 1) {
        const dernier = v === nbVersements - 1;
        const montant = dernier ? reste : Math.round(reste / (nbVersements - v) / 500) * 500;
        reste -= montant;
        if (montant <= 0) continue;
        paiementsPlan.push({
          factureIdx,
          montant,
          mode: pick(MODES_PAIEMENT),
          date: dateDansFenetre(PERIODES[Math.min(v, 2)]!, rnd()),
          statut: 'PAYE',
        });
      }
    }
    // Quelques paiements annulés pour tester l'affichage des statuts.
    if (!annulee && rnd() < 0.03) {
      paiementsPlan.push({
        factureIdx,
        montant: 5000,
        mode: 'CHEQUE',
        date: dateDansFenetre('TRIMESTRE_2', rnd()),
        statut: 'ANNULE',
      });
    }
  });

  const factures = (await insert('facture_eleve', facturesACreer, 'id')) as { id: string }[];
  await insert(
    'ligne_facture',
    lignesPlan.map((l) => ({
      factureId: factures[l.factureIdx]!.id,
      typeFraisId: l.typeFraisId,
      designation: l.designation,
      montant: l.montant,
    })),
  );
  await insert(
    'paiement',
    paiementsPlan.map((p, i) => ({
      factureId: factures[p.factureIdx]!.id,
      montant: p.montant,
      datePaiement: p.date,
      modePaiement: p.mode,
      reference: p.mode === 'ESPECES' ? null : `${p.mode.slice(0, 3)}-${anneeDebut}-${String(i + 1).padStart(5, '0')}`,
      statut: p.statut,
    })),
  );

  // --- Comptes de test ----------------------------------------------------
  await creerComptesDeTest(etablissementId, enseignants);

  // --- Récapitulatif ------------------------------------------------------
  console.log('\nRécapitulatif');
  for (const t of [
    'classe',
    'matiere',
    'programme_etablissement',
    'coefficient_matiere',
    'enseignant',
    'affectation_enseignant',
    'eleve',
    'responsable',
    'inscription',
    'evaluation',
    'note',
    'type_frais',
    'tarif_scolaire',
    'facture_eleve',
    'ligne_facture',
    'paiement',
  ]) {
    const { count } = await db.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t.padEnd(26)} ${count}`);
  }
  console.log('\nTerminé.\n');
}

// ------------------------------------------------------------------
// Comptes Supabase Auth pour tester chaque rôle
// ------------------------------------------------------------------

const MOT_DE_PASSE_DEMO = 'Demo2026!';

async function creerComptesDeTest(
  etablissementId: string,
  enseignants: { id: string; nom: string; prenoms: string }[],
) {
  const comptes: { email: string; nom: string; prenom: string; role: string; enseignantIdx?: number }[] = [
    { email: 'secretaire.demo@scolargest.test', nom: 'Mensah', prenom: 'Akouvi', role: 'SECRETAIRE' },
    { email: 'comptable.demo@scolargest.test', nom: 'Lawson', prenom: 'Kodjo', role: 'COMPTABLE' },
    { email: 'enseignant.demo@scolargest.test', nom: enseignants[0]?.nom ?? 'Folly', prenom: enseignants[0]?.prenoms ?? 'Yao', role: 'ENSEIGNANT', enseignantIdx: 0 },
    { email: 'enseignant2.demo@scolargest.test', nom: enseignants[1]?.nom ?? 'Adjovi', prenom: enseignants[1]?.prenoms ?? 'Sena', role: 'ENSEIGNANT', enseignantIdx: 1 },
  ];

  console.log('\nComptes de test');
  for (const c of comptes) {
    const { data: existant } = await db
      .from('utilisateur')
      .select('id')
      .eq('email', c.email)
      .maybeSingle();
    if (existant) {
      console.log(`  ${c.email.padEnd(38)} ${c.role.padEnd(11)} (déjà présent)`);
      continue;
    }

    const { data: created, error } = await db.auth.admin.createUser({
      email: c.email,
      password: MOT_DE_PASSE_DEMO,
      email_confirm: true,
      app_metadata: { etablissement_id: etablissementId, role: c.role },
    });
    if (error || !created.user) {
      console.log(`  ${c.email.padEnd(38)} ECHEC: ${error?.message}`);
      continue;
    }

    const { error: dbError } = await db.from('utilisateur').insert({
      id: created.user.id,
      etablissementId,
      nom: c.nom,
      prenom: c.prenom,
      email: c.email,
      role: c.role,
      statut: 'ACTIF',
    });
    if (dbError) {
      console.log(`  ${c.email.padEnd(38)} ECHEC (utilisateur): ${dbError.message}`);
      continue;
    }

    // Rattache le compte à une fiche enseignant existante.
    if (c.enseignantIdx !== undefined && enseignants[c.enseignantIdx]) {
      await db
        .from('enseignant')
        .update({ utilisateurId: created.user.id, email: c.email })
        .eq('id', enseignants[c.enseignantIdx]!.id);
    }

    console.log(`  ${c.email.padEnd(38)} ${c.role.padEnd(11)} mot de passe: ${MOT_DE_PASSE_DEMO}`);
  }
}

// ------------------------------------------------------------------
// Point d'entrée
// ------------------------------------------------------------------

async function main() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    fail('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env');
  }
  if (flag('list')) {
    await listerEtablissements();
    return;
  }
  const etablissementId = opt('etablissement');
  if (!etablissementId) {
    await listerEtablissements();
    fail('Précisez --etablissement <uuid> (voir la liste ci-dessus).');
  }
  if (flag('purge')) {
    await purger(etablissementId);
    if (!flag('seed')) return;
  }
  await seed(etablissementId, flag('force'));
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
