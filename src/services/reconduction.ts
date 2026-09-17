import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import {
  apparierClasses,
  propositionsTarifs,
  type ClasseAApparier,
  type PropositionTarif,
  type ConflitTarif,
} from '@/lib/reconduction';

/**
 * Reprendre d'une année sur l'autre ce qui ne change presque jamais.
 *
 * ## Pourquoi
 *
 * Constaté le 2026-09-17 en simulant une bascule d'année sur des données
 * réelles : au lendemain du changement, l'école repart de zéro sur ses classes,
 * ses tarifs, ses coefficients, ses créneaux, ses titularités **et** ses
 * affectations d'enseignants. Les coefficients se réappliquent déjà en un clic
 * depuis le barème national ; le reste se ressaisit à la main — quatre-vingt-
 * treize tarifs, cent treize affectations, treize titularités pour une école de
 * quatorze classes.
 *
 * Ce n'est pas seulement pénible. Sans affectation sur la nouvelle année,
 * `est_affecte()` rend `false` et **les enseignants ne peuvent pas saisir de
 * notes** : la corvée de rentrée est aussi une panne de rentrée.
 *
 * ## Deux régimes, et la différence est une décision produit
 *
 * **Les tarifs se proposent, ils ne s'écrivent pas.** Un tarif est immuable
 * après création (doc 08 § 6, `analysis.md` § 6) : le poser d'office
 * enfermerait l'école dans les prix de l'an dernier pour toute l'année, alors
 * qu'une rentrée est précisément le moment où les prix bougent. On remplit le
 * formulaire, le Directeur corrige ce qui a changé, et valide une fois.
 *
 * **Le reste se reconduit vraiment**, parce que rien ne l'interdit : une
 * affectation, une titularité et un créneau se créent et se suppriment
 * librement. Corriger après coup y est le geste normal.
 */

export interface ApercuReconduction {
  /** L'année dont on reprend, ou `null` s'il n'y en a aucune avant celle-ci. */
  source: { id: string; libelle: string } | null;
  classesAppariees: number;
  classesOrphelines: string[];
  /** Ce qui serait créé, à l'unité près. Zéro signifie « déjà fait », jamais « rien à faire ». */
  affectations: number;
  titularites: number;
  creneaux: number;
  tarifsProposes: number;
  conflitsTarifs: ConflitTarif[];
}

interface LigneClasse {
  id: string;
  nom: string;
  niveauId: string;
  serieId: string | null;
  anneeScolaireId: string;
}

/**
 * L'année précédente dont il y a quelque chose à reprendre.
 *
 * Par la date et non par le statut : au moment où l'on prépare la rentrée,
 * l'année précédente peut être encore `ACTIVE`, déjà `TERMINEE`, ou avoir été
 * clôturée dans le désordre. La chronologie, elle, ne ment pas.
 *
 * **Mais « la précédente » ne suffit pas : il faut la précédente qui a des
 * classes.** Constaté le 2026-09-17 en préparant l'essai sur des données
 * réelles — une école portait une année 2026-2027 entièrement vide, créée puis
 * abandonnée, intercalée entre l'année vivante et celle qu'on préparait. La
 * règle « strictement la précédente » l'aurait choisie et aurait annoncé « rien
 * à reprendre » alors que l'année d'avant offrait cent treize affectations.
 *
 * Une année créée en avance puis délaissée n'a rien d'exceptionnel, et le
 * symptôme aurait été le pire possible : un écran qui répond calmement qu'il
 * n'y a rien à faire.
 *
 * On saute donc les années sans classe. Le nombre d'années d'une école se
 * compte sur les doigts d'une main : les parcourir coûte deux requêtes, et
 * demander à PostgREST un `exists` corrélé en coûterait autant en lisibilité.
 */
async function anneeSource(
  supabase: ReturnType<typeof createClient>,
  etablissementId: string,
  anneeCibleId: string,
): Promise<{ id: string; libelle: string } | null> {
  const { data: cible, error: erreurCible } = await supabase
    .from('annee_scolaire')
    .select('id, "dateDebut"')
    .eq('id', anneeCibleId)
    .eq('etablissementId', etablissementId)
    .maybeSingle();
  if (erreurCible) throw erreurCible;
  if (!cible) throw new Error('Année scolaire introuvable.');

  const [{ data: precedentes, error }, { data: classes, error: erreurClasses }] = await Promise.all([
    supabase
      .from('annee_scolaire')
      .select('id, libelle')
      .eq('etablissementId', etablissementId)
      .lt('dateDebut', (cible as { dateDebut: string }).dateDebut)
      .order('dateDebut', { ascending: false }),
    supabase
      .from('classe')
      .select('"anneeScolaireId"')
      .eq('etablissementId', etablissementId),
  ]);
  if (error) throw error;
  if (erreurClasses) throw erreurClasses;

  const anneesPeuplees = new Set(
    ((classes ?? []) as { anneeScolaireId: string }[]).map((c) => c.anneeScolaireId),
  );

  return (
    ((precedentes ?? []) as { id: string; libelle: string }[]).find((a) =>
      anneesPeuplees.has(a.id),
    ) ?? null
  );
}

async function classesDe(
  supabase: ReturnType<typeof createClient>,
  etablissementId: string,
  anneeId: string,
): Promise<ClasseAApparier[]> {
  const { data, error } = await supabase
    .from('classe')
    .select('id, nom, "niveauId", "serieId"')
    .eq('etablissementId', etablissementId)
    .eq('anneeScolaireId', anneeId);
  if (error) throw error;
  return ((data ?? []) as LigneClasse[]).map((c) => ({
    id: c.id,
    nom: c.nom,
    niveauId: c.niveauId,
    serieId: c.serieId,
  }));
}

/**
 * Ce qu'on reprendrait, sans rien écrire.
 *
 * Ouvert au Comptable en lecture : il prépare la facturation de la rentrée et
 * doit pouvoir constater que les tarifs ne sont pas encore posés.
 */
export async function apercuReconduction(anneeCibleId: string): Promise<ApercuReconduction> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const etablissementId = ctx.etablissementId!;

  const source = await anneeSource(supabase, etablissementId, anneeCibleId);
  const vide: ApercuReconduction = {
    source: null,
    classesAppariees: 0,
    classesOrphelines: [],
    affectations: 0,
    titularites: 0,
    creneaux: 0,
    tarifsProposes: 0,
    conflitsTarifs: [],
  };
  if (!source) return vide;

  const [classesSource, classesCible] = await Promise.all([
    classesDe(supabase, etablissementId, source.id),
    classesDe(supabase, etablissementId, anneeCibleId),
  ]);
  if (classesCible.length === 0) return { ...vide, source };

  const { paires, orphelines } = apparierClasses(classesSource, classesCible);
  const idsSource = paires.map((p) => p.source.id);

  const [affectations, titularites, creneaux, tarifs, dejaTarifes] = await Promise.all([
    compterSource(supabase, 'affectation_enseignant', source.id, idsSource),
    compterSource(supabase, 'titularite_classe', source.id, idsSource),
    compterSource(supabase, 'emploi_du_temps_creneau', source.id, idsSource),
    tarifsSourceParNiveau(supabase, etablissementId, source.id),
    supabase
      .from('tarif_scolaire')
      .select('id', { count: 'exact', head: true })
      .eq('etablissementId', etablissementId)
      .eq('anneeScolaireId', anneeCibleId),
  ]);

  const { propositions, conflits } = propositionsTarifs(tarifs, classesCible);

  return {
    source,
    classesAppariees: paires.length,
    classesOrphelines: orphelines.map((o) => o.nom),
    affectations,
    titularites,
    creneaux,
    // Une année qui a déjà ses tarifs n'a rien à reprendre : proposer des
    // montants par-dessus ferait croire à une action possible, alors que
    // l'insertion serait refusée par l'unicité.
    tarifsProposes: (dejaTarifes.count ?? 0) > 0 ? 0 : propositions.length,
    conflitsTarifs: conflits,
  };
}

async function compterSource(
  supabase: ReturnType<typeof createClient>,
  table: string,
  anneeSourceId: string,
  classesSourceIds: string[],
): Promise<number> {
  if (classesSourceIds.length === 0) return 0;
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('anneeScolaireId', anneeSourceId)
    .in('classeId', classesSourceIds);
  if (error) throw error;
  return count ?? 0;
}

async function tarifsSourceParNiveau(
  supabase: ReturnType<typeof createClient>,
  etablissementId: string,
  anneeSourceId: string,
) {
  const { data, error } = await supabase
    .from('tarif_scolaire')
    .select('montant, "typeFraisId", typeFrais:type_frais(nom), classe:classe("niveauId","serieId")')
    .eq('etablissementId', etablissementId)
    .eq('anneeScolaireId', anneeSourceId);
  if (error) throw error;

  return ((data ?? []) as unknown as {
    montant: number;
    typeFraisId: string;
    typeFrais: { nom: string } | null;
    classe: { niveauId: string; serieId: string | null } | null;
  }[])
    .filter((t) => t.classe !== null)
    .map((t) => ({
      niveauId: t.classe!.niveauId,
      serieId: t.classe!.serieId,
      typeFraisId: t.typeFraisId,
      typeFraisNom: t.typeFrais?.nom ?? 'Frais',
      montant: Number(t.montant),
    }));
}

/**
 * Montants pré-remplis pour l'écran des tarifs. **Aucune écriture.**
 *
 * Rend une liste vide dès que l'année cible porte déjà un tarif : l'unicité
 * `(année, classe, frais)` refuserait l'insertion, et proposer un formulaire
 * dont la validation échouera ligne par ligne est une promesse qu'on ne tient
 * pas.
 */
export async function tarifsAProposer(anneeCibleId: string): Promise<{
  source: { id: string; libelle: string } | null;
  propositions: PropositionTarif[];
  conflits: ConflitTarif[];
}> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const etablissementId = ctx.etablissementId!;

  const { count } = await supabase
    .from('tarif_scolaire')
    .select('id', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId)
    .eq('anneeScolaireId', anneeCibleId);
  if ((count ?? 0) > 0) return { source: null, propositions: [], conflits: [] };

  const source = await anneeSource(supabase, etablissementId, anneeCibleId);
  if (!source) return { source: null, propositions: [], conflits: [] };

  const [classesCible, tarifs] = await Promise.all([
    classesDe(supabase, etablissementId, anneeCibleId),
    tarifsSourceParNiveau(supabase, etablissementId, source.id),
  ]);

  const { propositions, conflits } = propositionsTarifs(tarifs, classesCible);
  return { source, propositions, conflits };
}

/**
 * Crée d'un coup les tarifs que le Directeur vient de relire.
 *
 * **Les identifiants arrivent du navigateur** : ils sont donc revérifiés ici,
 * classe par classe et frais par frais, contre l'établissement de l'appelant et
 * contre l'année visée. La RLS refuserait de toute façon une classe d'une autre
 * école, mais elle ne dirait rien d'une classe de la bonne école rattachée à
 * une **autre année** — et c'est précisément ce qui produisait des factures à
 * zéro avant la migration `0019`.
 *
 * Un seul `insert` et une seule ligne d'audit : passer par `createTarif`
 * quatre-vingt-treize fois ferait cent quatre-vingt-six allers-retours, et
 * journaliserait quatre-vingt-treize fois le même geste.
 */
export async function validerTarifsReconduits(
  anneeCibleId: string,
  lignes: { classeId: string; typeFraisId: string; montant: number }[],
): Promise<number> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const etablissementId = ctx.etablissementId!;

  if (lignes.length === 0) return 0;
  for (const l of lignes) {
    if (!Number.isFinite(l.montant) || l.montant < 0) {
      throw new Error('Un montant doit être un nombre positif.');
    }
  }

  const [{ data: classes, error: erreurClasses }, { data: frais, error: erreurFrais }] =
    await Promise.all([
      supabase
        .from('classe')
        .select('id')
        .eq('etablissementId', etablissementId)
        .eq('anneeScolaireId', anneeCibleId),
      supabase.from('type_frais').select('id').eq('etablissementId', etablissementId),
    ]);
  if (erreurClasses) throw erreurClasses;
  if (erreurFrais) throw erreurFrais;

  const classesValides = new Set((classes ?? []).map((c) => (c as { id: string }).id));
  const fraisValides = new Set((frais ?? []).map((f) => (f as { id: string }).id));

  const aCreer = lignes.filter(
    (l) => classesValides.has(l.classeId) && fraisValides.has(l.typeFraisId),
  );
  if (aCreer.length !== lignes.length) {
    throw new Error("Une classe ou un frais ne correspond pas à cette année. Rechargez la page.");
  }

  const { error } = await supabase.from('tarif_scolaire').insert(
    aCreer.map((l) => ({
      etablissementId,
      anneeScolaireId: anneeCibleId,
      classeId: l.classeId,
      typeFraisId: l.typeFraisId,
      montant: l.montant,
    })),
  );
  if (error) {
    if (error.code === '23505') {
      throw new Error(
        'Ces tarifs viennent déjà d’être créés. Un tarif est immuable : rechargez la page pour voir ceux qui sont en place.',
      );
    }
    throw error;
  }

  await auditLog({
    action: 'RECONDUIRE_TARIFS',
    module: 'finance',
    objetType: 'AnneeScolaire',
    objetId: anneeCibleId,
    nouvelleValeur: {
      nombre: aCreer.length,
      total: aCreer.reduce((s, l) => s + l.montant, 0),
    },
  });

  return aCreer.length;
}

export interface BilanReconduction {
  affectations: number;
  titularites: number;
  creneaux: number;
  ignores: number;
}

/**
 * Reconduit affectations, titularités et emploi du temps sur l'année cible.
 *
 * **Idempotente par construction** : chaque insertion est précédée d'une
 * lecture de ce qui existe déjà sur l'année cible, et les doublons sont
 * comptés dans `ignores` plutôt que tentés. Relancer après un ajout manuel ne
 * doit ni échouer ni dupliquer — l'emploi du temps porte d'ailleurs deux index
 * uniques qui lèveraient, et une reconduction qui s'arrête au milieu laisserait
 * l'école dans un état qu'elle n'a pas choisi.
 *
 * **Les enseignants partis sont écartés**, pas reconduits : reprendre une
 * affectation vers un compte désactivé recréerait un cours sans professeur, que
 * personne ne verrait avant la rentrée.
 */
export async function reconduireAnnee(anneeCibleId: string): Promise<BilanReconduction> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const etablissementId = ctx.etablissementId!;

  const source = await anneeSource(supabase, etablissementId, anneeCibleId);
  if (!source) throw new Error("Aucune année antérieure : il n'y a rien à reprendre.");

  const [classesSource, classesCible] = await Promise.all([
    classesDe(supabase, etablissementId, source.id),
    classesDe(supabase, etablissementId, anneeCibleId),
  ]);
  const { paires } = apparierClasses(classesSource, classesCible);
  if (paires.length === 0) {
    throw new Error(
      "Aucune classe de cette année ne correspond à l'année précédente : créez d'abord les classes.",
    );
  }

  const versCible = new Map(paires.map((p) => [p.source.id, p.cible.id]));
  const idsSource = [...versCible.keys()];

  // Les enseignants encore en poste. `statut` plutôt que l'existence de la
  // fiche : un enseignant parti garde sa fiche, ses notes et son historique.
  const { data: actifs, error: erreurActifs } = await supabase
    .from('enseignant')
    .select('id')
    .eq('etablissementId', etablissementId)
    .eq('statut', 'ACTIF');
  if (erreurActifs) throw erreurActifs;
  const enPoste = new Set((actifs ?? []).map((e) => (e as { id: string }).id));

  let ignores = 0;

  // ------------------------------------------------------------ affectations
  const { data: affSource, error: erreurAff } = await supabase
    .from('affectation_enseignant')
    .select('"enseignantId", "classeId", "matiereId"')
    .eq('anneeScolaireId', source.id)
    .in('classeId', idsSource);
  if (erreurAff) throw erreurAff;

  const { data: affCible } = await supabase
    .from('affectation_enseignant')
    .select('"enseignantId", "classeId", "matiereId"')
    .eq('anneeScolaireId', anneeCibleId);
  const affExistantes = new Set(
    ((affCible ?? []) as { enseignantId: string; classeId: string; matiereId: string }[]).map(
      (a) => `${a.enseignantId}|${a.classeId}|${a.matiereId}`,
    ),
  );

  const nouvellesAff = [];
  for (const a of (affSource ?? []) as {
    enseignantId: string;
    classeId: string;
    matiereId: string;
  }[]) {
    const classeCible = versCible.get(a.classeId);
    if (!classeCible || !enPoste.has(a.enseignantId)) {
      ignores += 1;
      continue;
    }
    const cle = `${a.enseignantId}|${classeCible}|${a.matiereId}`;
    if (affExistantes.has(cle)) {
      ignores += 1;
      continue;
    }
    affExistantes.add(cle);
    nouvellesAff.push({
      etablissementId,
      anneeScolaireId: anneeCibleId,
      enseignantId: a.enseignantId,
      classeId: classeCible,
      matiereId: a.matiereId,
    });
  }
  if (nouvellesAff.length > 0) {
    const { error } = await supabase.from('affectation_enseignant').insert(nouvellesAff);
    if (error) throw error;
  }

  // ------------------------------------------------------------ titularités
  const { data: titSource, error: erreurTit } = await supabase
    .from('titularite_classe')
    .select('"classeId", "enseignantId"')
    .eq('anneeScolaireId', source.id)
    .in('classeId', idsSource);
  if (erreurTit) throw erreurTit;

  const { data: titCible } = await supabase
    .from('titularite_classe')
    .select('"classeId"')
    .eq('anneeScolaireId', anneeCibleId);
  const titExistantes = new Set(
    ((titCible ?? []) as { classeId: string }[]).map((t) => t.classeId),
  );

  const nouvellesTit = [];
  for (const t of (titSource ?? []) as { classeId: string; enseignantId: string }[]) {
    const classeCible = versCible.get(t.classeId);
    if (!classeCible || !enPoste.has(t.enseignantId) || titExistantes.has(classeCible)) {
      ignores += 1;
      continue;
    }
    titExistantes.add(classeCible);
    nouvellesTit.push({
      anneeScolaireId: anneeCibleId,
      classeId: classeCible,
      enseignantId: t.enseignantId,
    });
  }
  if (nouvellesTit.length > 0) {
    const { error } = await supabase.from('titularite_classe').insert(nouvellesTit);
    if (error) throw error;
  }

  // --------------------------------------------------------- emploi du temps
  const { data: creSource, error: erreurCre } = await supabase
    .from('emploi_du_temps_creneau')
    .select('"classeId", jour, rang, "matiereId", "enseignantId", salle')
    .eq('anneeScolaireId', source.id)
    .in('classeId', idsSource);
  if (erreurCre) throw erreurCre;

  const { data: creCible } = await supabase
    .from('emploi_du_temps_creneau')
    .select('"classeId", jour, rang, "enseignantId"')
    .eq('anneeScolaireId', anneeCibleId);

  // Deux index uniques protègent cette table : (classe, jour, rang) et, en
  // partiel, (enseignant, jour, rang). On reproduit les deux ici pour écarter
  // avant d'insérer — sinon le lot entier échouerait sur une seule collision.
  const creneauxPris = new Set<string>();
  const profsPris = new Set<string>();
  for (const c of (creCible ?? []) as {
    classeId: string;
    jour: number;
    rang: number;
    enseignantId: string | null;
  }[]) {
    creneauxPris.add(`${c.classeId}|${c.jour}|${c.rang}`);
    if (c.enseignantId) profsPris.add(`${c.enseignantId}|${c.jour}|${c.rang}`);
  }

  const nouveauxCre = [];
  for (const c of (creSource ?? []) as {
    classeId: string;
    jour: number;
    rang: number;
    matiereId: string;
    enseignantId: string | null;
    salle: string | null;
  }[]) {
    const classeCible = versCible.get(c.classeId);
    if (!classeCible) {
      ignores += 1;
      continue;
    }
    const cleCreneau = `${classeCible}|${c.jour}|${c.rang}`;
    const enseignant = c.enseignantId && enPoste.has(c.enseignantId) ? c.enseignantId : null;
    const cleProf = enseignant ? `${enseignant}|${c.jour}|${c.rang}` : null;

    if (creneauxPris.has(cleCreneau) || (cleProf && profsPris.has(cleProf))) {
      ignores += 1;
      continue;
    }
    creneauxPris.add(cleCreneau);
    if (cleProf) profsPris.add(cleProf);

    nouveauxCre.push({
      etablissementId,
      anneeScolaireId: anneeCibleId,
      classeId: classeCible,
      jour: c.jour,
      rang: c.rang,
      matiereId: c.matiereId,
      // Un créneau dont le professeur est parti reste au programme : la matière
      // et l'heure sont justes, c'est le nom qui manque. L'effacer perdrait
      // l'horaire que l'école a construit.
      enseignantId: enseignant,
      salle: c.salle,
    });
  }
  if (nouveauxCre.length > 0) {
    const { error } = await supabase.from('emploi_du_temps_creneau').insert(nouveauxCre);
    if (error) throw error;
  }

  const bilan: BilanReconduction = {
    affectations: nouvellesAff.length,
    titularites: nouvellesTit.length,
    creneaux: nouveauxCre.length,
    ignores,
  };

  await auditLog({
    action: 'RECONDUIRE_ANNEE',
    module: 'structure',
    objetType: 'AnneeScolaire',
    objetId: anneeCibleId,
    nouvelleValeur: { source: source.libelle, ...bilan },
  });

  return bilan;
}
