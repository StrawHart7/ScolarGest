import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { trierClasses } from '@/lib/tri-classes';

export interface Classe {
  id: string;
  etablissementId: string;
  anneeScolaireId: string;
  niveauId: string;
  serieId: string | null;
  nom: string;
  capacite: number | null;
  createdAt: string;
  /**
   * `ordre` est embarqué pour le tri : voir `src/lib/tri-classes.ts`. Sans lui,
   * les classes reviendraient dans l'ordre du dictionnaire — 1ère avant 6ème.
   */
  niveau: { nom: string; ordre: number | null; cycle: { nom: string; ordre: number | null } | null };
  serie: { nom: string } | null;
}

export interface CreateClasseInput {
  anneeScolaireId: string;
  niveauId: string;
  serieId?: string | null;
  nom: string;
  capacite?: number | null;
}

/**
 * Les classes de l'année, **dans l'ordre de la scolarité** — 6ème d'abord,
 * Terminale en dernier.
 *
 * Le tri se fait côté application et non en SQL : PostgREST ne sait pas
 * ordonner sur une ressource imbriquée à deux niveaux (`niveau` puis `cycle`),
 * et une école compte quelques dizaines de classes. C'est cette fonction qui
 * alimente presque tous les menus de choix d'une classe : la corriger ici les
 * corrige tous.
 */
export async function listClasses(anneeScolaireId: string): Promise<Classe[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classe')
    .select(
      'id, "etablissementId", "anneeScolaireId", "niveauId", "serieId", nom, capacite, "createdAt", niveau:niveau(nom, ordre, cycle:cycle(nom, ordre)), serie:serie(nom)',
    )
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (error) throw error;
  return trierClasses((data ?? []) as unknown as Classe[]);
}

export async function getClasse(id: string): Promise<Classe> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classe')
    .select(
      'id, "etablissementId", "anneeScolaireId", "niveauId", "serieId", nom, capacite, "createdAt", niveau:niveau(nom, ordre, cycle:cycle(nom, ordre)), serie:serie(nom)',
    )
    .eq('id', id)
    .eq('etablissementId', ctx.etablissementId)
    .single();
  if (error) throw error;
  return data as unknown as Classe;
}

export async function createClasse(input: CreateClasseInput): Promise<Classe> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('classe')
    .insert({
      etablissementId: ctx.etablissementId,
      anneeScolaireId: input.anneeScolaireId,
      niveauId: input.niveauId,
      serieId: input.serieId || null,
      nom: input.nom,
      capacite: input.capacite || null,
    })
    .select(
      'id, "etablissementId", "anneeScolaireId", "niveauId", "serieId", nom, capacite, "createdAt", niveau:niveau(nom, ordre, cycle:cycle(nom, ordre)), serie:serie(nom)',
    )
    .single();
  if (error) throw error;

  await auditLog({
    action: 'CREATE_CLASSE',
    module: 'structure',
    objetType: 'Classe',
    objetId: data.id,
    nouvelleValeur: { nom: input.nom },
  });

  return data as unknown as Classe;
}

/**
 * Pose ou retire la capacité d'une classe **après** sa création.
 *
 * Il n'existait aucune écriture sur `classe` en dehors de `createClasse`, si
 * bien qu'une classe née dans `/demarrage` — où la capacité n'est pas
 * demandée, et c'est un choix : on y crée douze classes d'affilée — ne pouvait
 * plus jamais en recevoir une. La fiche de classe affichait « Capacité — » sans
 * aucun moyen d'y remédier, et les trois écrans qui s'appuient dessus (la
 * répartition du tableau de bord, le rapport d'effectifs, l'alerte de
 * surcapacité) restaient muets pour toute l'école.
 *
 * **Seule la capacité est modifiable ici, délibérément.** Le nom est composé à
 * partir du niveau et de la série (`lib/noms-classes.ts`) et n'est pas une
 * saisie libre ; quant au niveau et à la série, les changer déplacerait sous
 * les pieds d'une classe déjà notée son programme, ses coefficients et ses
 * bulletins. Un renommage se fait en créant la bonne classe.
 *
 * `null` est une valeur, pas un échec : une école qui ne veut pas plafonner ses
 * effectifs doit pouvoir revenir en arrière, sinon poser une capacité par
 * curiosité serait irréversible.
 */
export async function definirCapaciteClasse(
  classeId: string,
  capacite: number | null,
): Promise<void> {
  const ctx = await requireRole('DIRECTEUR');
  const supabase = createClient();

  if (capacite !== null && (!Number.isInteger(capacite) || capacite < 1)) {
    throw new Error('La capacité doit être un nombre entier d’au moins 1.');
  }

  // L'ancienne valeur est lue avant l'écriture, pour le journal d'audit : sans
  // elle, « capacité modifiée » ne dit pas de quoi vers quoi. La lecture porte
  // la garde d'établissement, ce qui vérifie aussi que la classe est bien celle
  // de l'appelant avant qu'on ne touche à quoi que ce soit.
  const avant = await getClasse(classeId);

  const { data, error } = await supabase
    .from('classe')
    .update({ capacite })
    .eq('id', classeId)
    .eq('etablissementId', ctx.etablissementId)
    .select('id');
  if (error) throw error;

  // La RLS ne lève pas sur un UPDATE : elle filtre les lignes. Un refus revient
  // sans erreur et sans ligne, et annoncer un succès là où rien n'a été écrit
  // est le piège déjà payé le 2026-09-11.
  if (!data || data.length === 0) {
    throw new Error("Cette classe n'a pas pu être modifiée.");
  }

  await auditLog({
    action: 'DEFINIR_CAPACITE_CLASSE',
    module: 'structure',
    objetType: 'Classe',
    objetId: classeId,
    ancienneValeur: { capacite: avant.capacite },
    nouvelleValeur: { capacite },
  });
}
