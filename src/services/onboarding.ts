import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { etapesPourRole, type IdEtape } from '@/lib/onboarding/etapes';
import type { TenantContext } from './tenant';

/**
 * Progression du questionnaire de démarrage (`/demarrage`).
 *
 * L'avancement se **déduit des données** plutôt que de se stocker : une année
 * en statut ACTIVE existe-t-elle ? des cycles sont-ils activés ? des classes
 * existent-elles ? Dupliquer cet état dans une colonne le ferait diverger dès
 * qu'une configuration serait faite par les écrans habituels plutôt que par le
 * questionnaire.
 *
 * La table `onboarding_progression` ne porte donc que ce qui n'est pas
 * déductible : les étapes facultatives volontairement sautées, la fermeture de
 * la bannière, et — par sa seule existence — le fait que l'utilisateur a déjà
 * été redirigé une fois vers le questionnaire.
 *
 * Les comptages ci-dessous lisent les tables directement plutôt que d'appeler
 * les fonctions `list*` des services : `listProgramme` par exemple exige un
 * `niveauId` et imposerait une requête par niveau là où un `count` suffit. La
 * règle « passer par les services » vise les écritures, qui portent les gardes
 * et l'`auditLog` ; ces lectures restent filtrées explicitement sur
 * `etablissementId`, en défense en profondeur au-dessus de la RLS.
 */

export interface EtatEtape {
  id: IdEtape;
  /** Déduit des données, ou marqué comme volontairement sauté. */
  faite: boolean;
  ignoree: boolean;
}

export interface ProgressionOnboarding {
  etapes: EtatEtape[];
  /** Étape courante : la première ni faite ni ignorée. `null` si terminé. */
  etapeCourante: IdEtape | null;
  nombreFaites: number;
  nombreTotal: number;
  complete: boolean;
  /** La bannière du tableau de bord a été fermée. */
  masquee: boolean;
  /** L'utilisateur a déjà été redirigé une fois vers `/demarrage`. */
  dejaRedirige: boolean;
}

interface LigneProgression {
  etapesIgnorees: string[];
  masqueeLe: string | null;
  termineeLe: string | null;
}

async function lireLigne(ctx: TenantContext): Promise<LigneProgression | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('onboarding_progression')
    .select('"etapesIgnorees", "masqueeLe", "termineeLe"')
    .eq('etablissementId', ctx.etablissementId)
    .eq('utilisateurId', ctx.userId)
    .maybeSingle();
  if (error) throw error;
  return (data as LigneProgression | null) ?? null;
}

/** Nombre de lignes d'une table du tenant, sans les rapatrier. */
async function compter(
  table: string,
  etablissementId: string | null,
  filtres: Record<string, string | boolean> = {},
): Promise<number> {
  if (!etablissementId) return 0;
  const supabase = createClient();
  let requete = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId);
  for (const [colonne, valeur] of Object.entries(filtres)) {
    requete = requete.eq(colonne, valeur);
  }
  const { count, error } = await requete;
  if (error) throw error;
  return count ?? 0;
}

export async function getProgressionOnboarding(): Promise<ProgressionOnboarding> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const definitions = etapesPourRole(ctx.role);
  const ligne = await lireLigne(ctx);
  const ignorees = new Set(ligne?.etapesIgnorees ?? []);
  const supabase = createClient();

  // L'année active conditionne classes, coefficients et tarifs : on la résout
  // une fois, et les étapes qui en dépendent restent « non faites » sans elle.
  const { data: anneeActive, error: erreurAnnee } = await supabase
    .from('annee_scolaire')
    .select('id')
    .eq('etablissementId', ctx.etablissementId)
    .eq('statut', 'ACTIVE')
    .maybeSingle();
  if (erreurAnnee) throw erreurAnnee;
  const anneeId = (anneeActive as { id: string } | null)?.id ?? null;

  const faites = new Set<IdEtape>();

  for (const definition of definitions) {
    let faite = false;
    switch (definition.id) {
      case 'pin': {
        const { data, error } = await supabase
          .from('utilisateur')
          .select('"pinApprobationHash"')
          .eq('id', ctx.userId)
          .maybeSingle();
        if (error) throw error;
        faite = Boolean((data as { pinApprobationHash: string | null } | null)?.pinApprobationHash);
        break;
      }
      case 'annee-scolaire':
        faite = anneeId !== null;
        break;
      case 'cycles':
        faite = (await compter('cycle_etablissement', ctx.etablissementId, { actif: true })) > 0;
        break;
      case 'classes':
        faite =
          anneeId !== null &&
          (await compter('classe', ctx.etablissementId, { anneeScolaireId: anneeId })) > 0;
        break;
      case 'matieres':
        faite = (await compter('matiere', ctx.etablissementId)) > 0;
        break;
      case 'programme':
        faite = (await compter('programme_etablissement', ctx.etablissementId)) > 0;
        break;
      case 'coefficients': {
        // `coefficient_matiere` ne porte pas d'`etablissementId` : elle se
        // rattache au programme, lui-même scopé. On passe donc par l'année.
        if (anneeId === null) break;
        const { count, error } = await supabase
          .from('coefficient_matiere')
          .select('id', { count: 'exact', head: true })
          .eq('anneeScolaireId', anneeId);
        if (error) throw error;
        faite = (count ?? 0) > 0;
        break;
      }
      case 'enseignants':
        faite = (await compter('enseignant', ctx.etablissementId)) > 0;
        break;
      case 'utilisateurs': {
        // Le Directeur lui-même ne compte pas : l'étape vise l'équipe invitée.
        const { count, error } = await supabase
          .from('utilisateur')
          .select('id', { count: 'exact', head: true })
          .eq('etablissementId', ctx.etablissementId)
          .in('role', ['SECRETAIRE', 'COMPTABLE']);
        if (error) throw error;
        faite = (count ?? 0) > 0;
        break;
      }
      case 'types-frais':
        faite = (await compter('type_frais', ctx.etablissementId)) > 0;
        break;
      case 'tarifs':
        faite =
          anneeId !== null &&
          (await compter('tarif_scolaire', ctx.etablissementId, { anneeScolaireId: anneeId })) > 0;
        break;
    }
    if (faite) faites.add(definition.id);
  }

  const etapes: EtatEtape[] = definitions.map((definition) => ({
    id: definition.id,
    faite: faites.has(definition.id),
    ignoree: ignorees.has(definition.id),
  }));

  const etapeCourante = etapes.find((e) => !e.faite && !e.ignoree)?.id ?? null;

  return {
    etapes,
    etapeCourante,
    nombreFaites: etapes.filter((e) => e.faite).length,
    nombreTotal: etapes.length,
    complete: etapeCourante === null,
    masquee: Boolean(ligne?.masqueeLe),
    dejaRedirige: ligne !== null,
  };
}

/**
 * Crée la ligne de progression si elle n'existe pas, et indique si c'est la
 * première fois. Le tableau de bord s'en sert pour ne rediriger vers
 * `/demarrage` qu'une seule fois : au retour, la ligne existe déjà et la
 * redirection ne se déclenche plus — c'est ce qui rend le parcours
 * interruptible plutôt que forcé.
 */
export async function marquerRedirectionOnboarding(): Promise<boolean> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  if (!ctx.etablissementId) return false;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('onboarding_progression')
    .upsert(
      { etablissementId: ctx.etablissementId, utilisateurId: ctx.userId },
      { onConflict: 'etablissementId,utilisateurId', ignoreDuplicates: true },
    )
    .select('id');
  if (error) throw error;
  // `ignoreDuplicates` ne renvoie une ligne que si l'insertion a bien eu lieu.
  return (data ?? []).length > 0;
}

async function majLigne(
  ctx: TenantContext,
  champs: Record<string, unknown>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('onboarding_progression').upsert(
    { etablissementId: ctx.etablissementId, utilisateurId: ctx.userId, ...champs },
    { onConflict: 'etablissementId,utilisateurId' },
  );
  if (error) throw error;
}

/** Mémorise qu'une étape facultative a été volontairement sautée. */
export async function ignorerEtape(etape: IdEtape): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const ligne = await lireLigne(ctx);
  const ignorees = new Set(ligne?.etapesIgnorees ?? []);
  ignorees.add(etape);
  await majLigne(ctx, { etapesIgnorees: [...ignorees] });
}

/** Ferme la bannière de rappel du tableau de bord. */
export async function masquerOnboarding(): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  await majLigne(ctx, { masqueeLe: new Date().toISOString() });
}

export interface BilanOnboarding {
  cycles: number;
  classes: number;
  matieres: number;
  coefficients: number;
  enseignants: number;
  eleves: number;
  typesFrais: number;
  tarifs: number;
  anneeLibelle: string | null;
}

/**
 * Ce que la configuration a réellement produit, pour l'écran de fin.
 *
 * Compté à la demande plutôt que cumulé au fil des étapes : le Directeur a pu
 * créer des classes depuis les écrans habituels, et un compteur maintenu à
 * part afficherait alors moins que la réalité.
 */
export async function getBilanOnboarding(): Promise<BilanOnboarding> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();

  const { data: annee } = await supabase
    .from('annee_scolaire')
    .select('id, libelle')
    .eq('etablissementId', ctx.etablissementId)
    .eq('statut', 'ACTIVE')
    .maybeSingle();
  const anneeCourante = annee as { id: string; libelle: string } | null;

  // `coefficient_matiere` ne porte pas d'`etablissementId` : on passe par
  // l'année active, elle-même scopée.
  let coefficients = 0;
  if (anneeCourante) {
    const { count } = await supabase
      .from('coefficient_matiere')
      .select('id', { count: 'exact', head: true })
      .eq('anneeScolaireId', anneeCourante.id);
    coefficients = count ?? 0;
  }

  const anneeFiltre = anneeCourante ? { anneeScolaireId: anneeCourante.id } : undefined;

  const [cycles, classes, matieres, enseignants, eleves, typesFrais, tarifs] = await Promise.all([
    compter('cycle_etablissement', ctx.etablissementId, { actif: true }),
    anneeFiltre ? compter('classe', ctx.etablissementId, anneeFiltre) : 0,
    compter('matiere', ctx.etablissementId),
    compter('enseignant', ctx.etablissementId),
    compter('eleve', ctx.etablissementId),
    compter('type_frais', ctx.etablissementId),
    anneeFiltre ? compter('tarif_scolaire', ctx.etablissementId, anneeFiltre) : 0,
  ]);

  return {
    cycles,
    classes,
    matieres,
    coefficients,
    enseignants,
    eleves,
    typesFrais,
    tarifs,
    anneeLibelle: anneeCourante?.libelle ?? null,
  };
}

export async function terminerOnboarding(): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  await majLigne(ctx, { termineeLe: new Date().toISOString() });
}
