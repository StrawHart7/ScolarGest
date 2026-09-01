import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { definirCoefficients } from './coefficient';

/**
 * Catalogue officiel des matières et de leurs coefficients (migration `0020`).
 *
 * **Les coefficients sont fixés par le ministère, pas par l'école.** Jusqu'ici
 * le Directeur remplissait une grille niveau × matière avant de pouvoir éditer
 * le moindre bulletin, alors qu'il n'avait aucune latitude sur les valeurs.
 *
 * Trois zones où le catalogue ne dit rien, et où l'école reprend la main :
 *
 * - **Les séries techniques** (E, F, G) : absentes des documents officiels, qui
 *   ne traitent que l'enseignement général.
 * - **La Seconde** : les totaux du document ne se recoupent pas avec la lecture
 *   des cellules, et semer une valeur douteuse produirait des bulletins faux
 *   plutôt qu'une erreur visible. En attente de vérification sur papier.
 * - **Les matières sans coefficient** (Dessin, Musique, Langues nationales,
 *   Enseignement ménager) : elles ont un volume horaire officiel mais aucun
 *   coefficient. L'absence de ligne est l'information.
 *
 * Dans ces trois cas, `coefficientOfficiel` renvoie `null` et l'écran de saisie
 * reprend son rôle d'avant.
 *
 * Lecture ouverte à tous les rôles d'école : c'est un catalogue national, il
 * n'y a rien à y protéger. La garde existe parce qu'une fonction de service qui
 * ouvre un client Supabase doit en avoir une.
 */

export interface MatiereOfficielle {
  id: string;
  code: string;
  nom: string;
  ordreAffichage: number;
  /**
   * `false` pour les matières à volume horaire mais sans coefficient national.
   * L'école qui les enseigne fixe elle-même leur poids — jamais zéro, sans quoi
   * la matière figurerait au bulletin sans compter dans la moyenne.
   */
  aCoefficientOfficiel: boolean;
}

export async function listMatieresOfficielles(cycleId: string): Promise<MatiereOfficielle[]> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('matiere_officielle')
    .select('id, code, nom, "ordreAffichage"')
    .eq('cycleId', cycleId)
    .order('ordreAffichage');
  if (error) throw error;

  const matieres = (data ?? []) as unknown as Omit<
    MatiereOfficielle,
    'aCoefficientOfficiel'
  >[];
  if (matieres.length === 0) return [];

  const { data: coefficients, error: erreurCoefficients } = await supabase
    .from('coefficient_officiel')
    .select('"matiereOfficielleId"')
    .in(
      'matiereOfficielleId',
      matieres.map((m) => m.id),
    );
  if (erreurCoefficients) throw erreurCoefficients;

  const avecCoefficient = new Set(
    ((coefficients ?? []) as { matiereOfficielleId: string }[]).map(
      (c) => c.matiereOfficielleId,
    ),
  );

  return matieres.map((m) => ({ ...m, aCoefficientOfficiel: avecCoefficient.has(m.id) }));
}

export interface CoefficientOfficiel {
  matiereOfficielleId: string;
  coefficient: number;
}

/**
 * Barème national pour un niveau, éventuellement différencié par série.
 *
 * `serieId` nul au collège, où le programme ne se différencie pas. Un tableau
 * vide n'est pas une anomalie : il signifie que cette combinaison n'est pas
 * couverte par les documents officiels.
 */
export async function coefficientsOfficiels(
  niveauId: string,
  serieId: string | null,
): Promise<CoefficientOfficiel[]> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();

  const requete = supabase
    .from('coefficient_officiel')
    .select('"matiereOfficielleId", coefficient')
    .eq('niveauId', niveauId);

  const { data, error } = await (serieId
    ? requete.eq('serieId', serieId)
    : requete.is('serieId', null));
  if (error) throw error;

  return ((data ?? []) as { matiereOfficielleId: string; coefficient: number }[]).map((c) => ({
    matiereOfficielleId: c.matiereOfficielleId,
    coefficient: Number(c.coefficient),
  }));
}

export interface ResultatApplication {
  /** Lignes de programme dotées d'un coefficient national. */
  appliques: number;
  /** Lignes laissées à la saisie de l'école — hors barème officiel. */
  aSaisir: number;
}

/**
 * Recopie le barème national dans les coefficients de l'année scolaire.
 *
 * **Une copie, pas une lecture au vol.** Le catalogue est une valeur par défaut
 * au moment où l'année se configure ; le coefficient qui compte reste celui
 * stocké dans `coefficient_matiere`. Si on lisait le catalogue au moment de
 * calculer un bulletin, le jour où le ministère révise son barème, tous les
 * bulletins déjà édités changeraient rétroactivement — l'invariant
 * d'historisation du projet existe précisément pour ça. Même raisonnement que
 * `abonnement.montantTotal`, figé à la souscription plutôt que relu depuis le
 * catalogue des plans.
 *
 * **Le rattachement se fait par le code**, et non par une clé étrangère sur
 * `matiere`. Une école n'a qu'une matière « Français », alors que le catalogue
 * national en distingue une par cycle : la ligne de programme, elle, porte un
 * niveau donc un cycle, ce qui lève l'ambiguïté (voir migration `0021`).
 *
 * Un code sans correspondance — « INFO », une matière maison — n'est pas une
 * anomalie : il signifie qu'aucun barème national ne s'applique, et l'école
 * saisit son coefficient comme avant.
 *
 * Idempotente : réappliquer écrase par les mêmes valeurs. C'est aussi ce qui
 * permet d'offrir un « restaurer le barème officiel » sur l'écran de saisie.
 */
export async function appliquerCoefficientsOfficiels(
  anneeScolaireId: string,
): Promise<ResultatApplication> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  // Le programme de l'école, avec le code de la matière et le cycle du niveau :
  // les deux ensemble désignent la matière officielle.
  const { data: programme, error } = await supabase
    .from('programme_etablissement')
    .select('id, "niveauId", matiere:matiere(code), niveau:niveau("cycleId")')
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;

  const lignes = (programme ?? []) as unknown as {
    id: string;
    niveauId: string;
    matiere: { code: string | null } | null;
    niveau: { cycleId: string } | null;
  }[];
  if (lignes.length === 0) return { appliques: 0, aSaisir: 0 };

  // Table de correspondance (cycle, code) -> matiere officielle.
  const { data: officielles, error: erreurOfficielles } = await supabase
    .from('matiere_officielle')
    .select('id, "codeEcole", "cycleId"');
  if (erreurOfficielles) throw erreurOfficielles;
  // `codeEcole` et non `code` : le ministere renomme la meme discipline d'un
  // cycle a l'autre (ANG -> LV1, PCT -> PC) alors qu'une ecole n'a qu'une
  // matiere Anglais. Voir migration 0022.
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
    combinaisons.set(`${c.niveauId}|${c.serieId ?? ''}`, {
      niveauId: c.niveauId,
      serieId: c.serieId,
    });
  }

  let appliques = 0;
  const couvertes = new Set<string>();

  for (const { niveauId, serieId } of combinaisons.values()) {
    const officiels = await coefficientsOfficiels(niveauId, serieId);
    if (officiels.length === 0) continue;
    const parMatiereOfficielle = new Map(
      officiels.map((o) => [o.matiereOfficielleId, o.coefficient]),
    );

    const saisies = lignes
      .filter((l) => l.niveauId === niveauId && l.matiere?.code && l.niveau)
      .map((l) => {
        const officielleId = parCycleEtCode.get(`${l.niveau!.cycleId}|${l.matiere!.code}`);
        return {
          programmeEtablissementId: l.id,
          coefficient: officielleId ? parMatiereOfficielle.get(officielleId) : undefined,
        };
      })
      .filter((s): s is { programmeEtablissementId: string; coefficient: number } =>
        s.coefficient !== undefined,
      );

    if (saisies.length === 0) continue;
    // On passe par `definirCoefficients` plutot que d'ecrire directement : la
    // contrainte unique de `coefficient_matiere` inclut `serieId`, qui est nul
    // au college — et deux NULL etant distincts en Postgres, un `upsert`
    // insererait un doublon a chaque application au lieu de mettre a jour.
    // Cette fonction lit l'existant avant d'ecrire, et journalise.
    await definirCoefficients(anneeScolaireId, serieId, saisies);
    appliques += saisies.length;
    for (const s of saisies) couvertes.add(s.programmeEtablissementId);
  }

  return { appliques, aSaisir: lignes.length - couvertes.size };
}

/**
 * Barème national d'un niveau, indexé par le code que l'école utilise.
 *
 * Destiné à l'affichage : l'écran de saisie doit pouvoir distinguer, ligne par
 * ligne, ce qui vient du ministère de ce que l'école a choisi. Une carte vide
 * signifie que cette combinaison n'est pas couverte — série technique, Seconde,
 * ou cycle hors périmètre — et l'écran redevient entièrement éditable.
 */
export async function baremeOfficiel(
  niveauId: string,
  serieId: string | null,
): Promise<Map<string, number>> {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();

  const officiels = await coefficientsOfficiels(niveauId, serieId);
  if (officiels.length === 0) return new Map();

  const { data, error } = await supabase
    .from('matiere_officielle')
    .select('id, "codeEcole"')
    .in(
      'id',
      officiels.map((o) => o.matiereOfficielleId),
    );
  if (error) throw error;

  const codeParId = new Map(
    ((data ?? []) as { id: string; codeEcole: string }[]).map((m) => [m.id, m.codeEcole]),
  );

  const bareme = new Map<string, number>();
  for (const o of officiels) {
    const code = codeParId.get(o.matiereOfficielleId);
    if (code) bareme.set(code, o.coefficient);
  }
  return bareme;
}
