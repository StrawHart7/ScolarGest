import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export interface ResultatProjection {
  /** Lignes de programme dotées du barème national. */
  projetes: number;
  /** Lignes laissées à la saisie de l'école, faute de barème national. */
  laissesLocaux: number;
}

interface LigneProjetee {
  programmeEtablissementId: string;
  serieId: string | null;
  coefficient: number;
  origine: 'OFFICIEL' | 'CONVERGENT';
  coefficientOfficielId: string;
}

/**
 * Année civile de référence du barème : l'année de **début** de l'année
 * scolaire. 2026 désigne 2026-2027, comme `coefficient_officiel.valableDe`.
 */
function anneeDeReference(dateDebut: string): number {
  return new Date(dateDebut).getUTCFullYear();
}

/**
 * Projette le barème national dans les coefficients d'une année scolaire, et
 * rattache l'année au référentiel.
 *
 * ## Pourquoi projeter plutôt que résoudre à la lecture
 *
 * Les lecteurs — `resultats-classe`, `rapport`, le bulletin — continuent de
 * lire `coefficient_matiere` avec exactement la même requête qu'avant. Aucun
 * d'eux n'est modifié, donc **aucun bulletin ne peut changer de valeur par
 * effet de bord**, et l'historisation est automatique : une année close n'est
 * jamais reprojetée. Voir la migration `20260912160000` pour l'alternative
 * écartée.
 *
 * ## Pourquoi la clé service-role
 *
 * Le déclencheur `fn_proteger_coefficients_nationaux` interdit à un
 * établissement d'écrire une ligne dont l'origine n'est pas `LOCAL` — sans
 * quoi une école se fabriquerait un coefficient « officiel » de son choix.
 * C'est donc à la plateforme d'écrire ces lignes, comme pour
 * `transaction_fedapay`, que le tenant ne peut pas écrire non plus.
 *
 * L'appartenance de l'année à l'établissement appelant est vérifiée **avant**
 * de prendre la clé d'administration, qui ne connaît aucun tenant. Même ordre
 * que `desactiverUtilisateur`.
 *
 * ## Ce qu'elle refuse
 *
 * Une année **clôturée** n'est pas reprojetable. Ses bulletins ont été émis
 * avec un barème donné ; le réécrire ferait diverger un document déjà remis
 * des familles de sa source. C'est l'invariant d'historisation du projet, et
 * c'est le seul refus dur de cette fonction.
 *
 * Idempotente : réappliquer récrit les mêmes valeurs.
 */
export async function projeterReferentielNational(
  anneeScolaireId: string,
): Promise<ResultatProjection> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data: annee, error: erreurAnnee } = await supabase
    .from('annee_scolaire')
    .select('id, "dateDebut", statut')
    .eq('id', anneeScolaireId)
    .eq('etablissementId', ctx.etablissementId)
    .maybeSingle();
  if (erreurAnnee) throw erreurAnnee;
  if (!annee) throw new Error('Année scolaire introuvable dans votre établissement.');
  if (annee.statut === 'TERMINEE') {
    throw new Error(
      'Cette année est clôturée : son barème ne peut plus changer sans contredire les bulletins déjà émis.',
    );
  }

  const anneeReference = anneeDeReference(annee.dateDebut);

  // Le programme de l'école, avec le code de la matière et le cycle du niveau :
  // les deux ensemble désignent la matière officielle (migration `0021`).
  const { data: programme, error: erreurProgramme } = await supabase
    .from('programme_etablissement')
    .select('id, "niveauId", matiere:matiere(code), niveau:niveau("cycleId")')
    .eq('etablissementId', ctx.etablissementId);
  if (erreurProgramme) throw erreurProgramme;

  const lignes = (programme ?? []) as unknown as {
    id: string;
    niveauId: string;
    matiere: { code: string | null } | null;
    niveau: { cycleId: string } | null;
  }[];
  if (lignes.length === 0) {
    await rattacherAuReferentiel(anneeScolaireId, ctx.etablissementId);
    return { projetes: 0, laissesLocaux: 0 };
  }

  // `codeEcole` et non `code` : le ministère renomme la même discipline d'un
  // cycle à l'autre (ANG -> LV1, PCT -> PC) alors qu'une école n'a qu'une
  // matière « Anglais ». Voir migration `0022`.
  const { data: officielles, error: erreurOfficielles } = await supabase
    .from('matiere_officielle')
    .select('id, "codeEcole", "cycleId"');
  if (erreurOfficielles) throw erreurOfficielles;
  const parCycleEtCode = new Map(
    ((officielles ?? []) as { id: string; codeEcole: string; cycleId: string }[]).map((m) => [
      `${m.cycleId}|${m.codeEcole}`,
      m.id,
    ]),
  );

  // Les combinaisons niveau/série réellement ouvertes cette année. Traiter
  // toutes les séries du cycle créerait des coefficients pour des classes qui
  // n'existent pas.
  const { data: classes, error: erreurClasses } = await supabase
    .from('classe')
    .select('"niveauId", "serieId"')
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (erreurClasses) throw erreurClasses;

  const combinaisons = new Map<string, { niveauId: string; serieId: string | null }>();
  for (const c of (classes ?? []) as { niveauId: string; serieId: string | null }[]) {
    combinaisons.set(`${c.niveauId}|${c.serieId ?? ''}`, { niveauId: c.niveauId, serieId: c.serieId });
  }

  const voulues: LigneProjetee[] = [];
  const couvertes = new Set<string>();

  for (const { niveauId, serieId } of combinaisons.values()) {
    const bareme = await baremeEnVigueur(niveauId, serieId, anneeReference);
    if (bareme.length === 0) continue;
    const parMatiereOfficielle = new Map(bareme.map((b) => [b.matiereOfficielleId, b]));

    for (const ligne of lignes) {
      if (ligne.niveauId !== niveauId || !ligne.matiere?.code || !ligne.niveau) continue;
      const officielleId = parCycleEtCode.get(`${ligne.niveau.cycleId}|${ligne.matiere.code}`);
      if (!officielleId) continue;
      const source = parMatiereOfficielle.get(officielleId);
      if (!source) continue;

      voulues.push({
        programmeEtablissementId: ligne.id,
        serieId,
        coefficient: source.coefficient,
        origine: source.confiance,
        coefficientOfficielId: source.id,
      });
      couvertes.add(ligne.id);
    }
  }

  await ecrireProjection(anneeScolaireId, voulues);
  await rattacherAuReferentiel(anneeScolaireId, ctx.etablissementId);

  await auditLog({
    action: 'PROJETER_REFERENTIEL_NATIONAL',
    module: 'academique',
    objetType: 'AnneeScolaire',
    objetId: anneeScolaireId,
    nouvelleValeur: { anneeReference, projetes: voulues.length },
  });

  return { projetes: voulues.length, laissesLocaux: lignes.length - couvertes.size };
}

interface BaremeSource {
  id: string;
  matiereOfficielleId: string;
  coefficient: number;
  confiance: 'OFFICIEL' | 'CONVERGENT';
}

/**
 * Barème national en vigueur pour une année donnée.
 *
 * La borne haute est **exclue** : une ligne close en 2027 vaut encore pour
 * 2026-2027 et cesse de valoir à la rentrée 2027. Sans ce filtre, une
 * correction ferait remonter deux lignes pour la même matière — c'est
 * exactement l'avertissement écrit dans la migration `20260912120000`.
 */
async function baremeEnVigueur(
  niveauId: string,
  serieId: string | null,
  annee: number,
): Promise<BaremeSource[]> {
  const supabase = createClient();

  const requete = supabase
    .from('coefficient_officiel')
    .select('id, "matiereOfficielleId", coefficient, confiance')
    .eq('niveauId', niveauId)
    .lte('valableDe', annee)
    .or(`valableJusqua.is.null,valableJusqua.gt.${annee}`);

  const { data, error } = await (serieId ? requete.eq('serieId', serieId) : requete.is('serieId', null));
  if (error) throw error;

  return ((data ?? []) as BaremeSource[]).map((b) => ({
    id: b.id,
    matiereOfficielleId: b.matiereOfficielleId,
    coefficient: Number(b.coefficient),
    confiance: b.confiance,
  }));
}

/**
 * Écrit les lignes projetées, avec la clé d'administration.
 *
 * **Lecture avant écriture, jamais d'`upsert`.** La contrainte unique de
 * `coefficient_matiere` porte sur `(programme, année, série)`, et `serieId`
 * est nul au collège : deux NULL étant distincts en Postgres, un `upsert`
 * insérerait un doublon à chaque projection au lieu de mettre à jour. Le
 * dépôt s'est déjà fait prendre deux fois par ce piège — migrations `0018` et
 * `0020`.
 */
async function ecrireProjection(anneeScolaireId: string, voulues: LigneProjetee[]): Promise<void> {
  if (voulues.length === 0) return;
  const admin = createAdminClient();

  const { data: existantes, error } = await admin
    .from('coefficient_matiere')
    .select('id, "programmeEtablissementId", "serieId", coefficient, origine, "coefficientOfficielId"')
    .eq('anneeScolaireId', anneeScolaireId)
    .in(
      'programmeEtablissementId',
      voulues.map((v) => v.programmeEtablissementId),
    );
  if (error) throw error;

  const cle = (programmeEtablissementId: string, serieId: string | null) =>
    `${programmeEtablissementId}|${serieId ?? ''}`;
  const parCle = new Map(
    ((existantes ?? []) as {
      id: string;
      programmeEtablissementId: string;
      serieId: string | null;
      coefficient: number;
      origine: string;
      coefficientOfficielId: string | null;
    }[]).map((e) => [cle(e.programmeEtablissementId, e.serieId), e]),
  );

  const aInserer: Record<string, unknown>[] = [];

  for (const voulue of voulues) {
    const existante = parCle.get(cle(voulue.programmeEtablissementId, voulue.serieId));
    if (!existante) {
      aInserer.push({
        programmeEtablissementId: voulue.programmeEtablissementId,
        anneeScolaireId,
        serieId: voulue.serieId,
        coefficient: voulue.coefficient,
        origine: voulue.origine,
        coefficientOfficielId: voulue.coefficientOfficielId,
      });
      continue;
    }

    const identique =
      Number(existante.coefficient) === voulue.coefficient &&
      existante.origine === voulue.origine &&
      existante.coefficientOfficielId === voulue.coefficientOfficielId;
    if (identique) continue;

    const { error: erreurMaj } = await admin
      .from('coefficient_matiere')
      .update({
        coefficient: voulue.coefficient,
        origine: voulue.origine,
        coefficientOfficielId: voulue.coefficientOfficielId,
      })
      .eq('id', existante.id);
    if (erreurMaj) throw erreurMaj;
  }

  if (aInserer.length > 0) {
    const { error: erreurInsert } = await admin.from('coefficient_matiere').insert(aInserer);
    if (erreurInsert) throw erreurInsert;
  }
}

/**
 * Marque l'année comme suivant le référentiel national.
 *
 * Passe aussi par la clé d'administration : `fn_proteger_referentiel_annee`
 * interdit à un établissement de toucher ce drapeau, sans quoi un directeur le
 * remettrait à `false` et reprendrait la main sur ses coefficients.
 */
async function rattacherAuReferentiel(
  anneeScolaireId: string,
  etablissementId: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('annee_scolaire')
    .update({ referentielNational: true })
    .eq('id', anneeScolaireId)
    .eq('etablissementId', etablissementId);
  if (error) throw error;
}
