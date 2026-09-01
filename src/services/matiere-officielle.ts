import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';

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
