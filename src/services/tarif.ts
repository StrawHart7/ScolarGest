import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';

export interface TarifScolaire {
  id: string;
  etablissementId: string;
  anneeScolaireId: string;
  classeId: string;
  typeFraisId: string;
  montant: number;
  createdAt: string;
  typeFrais?: { id: string; nom: string };
  classe?: { id: string; nom: string };
}

export interface CreateTarifInput {
  anneeScolaireId: string;
  classeId: string;
  typeFraisId: string;
  montant: number;
}

const TARIF_FIELDS =
  'id, "etablissementId", "anneeScolaireId", "classeId", "typeFraisId", montant, "createdAt"';
const TARIF_FIELDS_JOIN = `${TARIF_FIELDS}, typeFrais:type_frais(id, nom), classe:classe(id, nom)`;

/**
 * Tarifs d'une année scolaire, optionnellement filtrés sur une classe.
 * Le tarif est défini **par classe** (décision Q7 d'`analysis.md`, doc 08 §5).
 */
export async function listTarifs(
  anneeScolaireId: string,
  classeId?: string,
): Promise<TarifScolaire[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  let query = supabase
    .from('tarif_scolaire')
    .select(TARIF_FIELDS_JOIN)
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeScolaireId);
  if (classeId) query = query.eq('classeId', classeId);
  const { data, error } = await query.order('createdAt');
  if (error) throw error;
  return (data ?? []) as unknown as TarifScolaire[];
}

/**
 * Crée un tarif. **Immuable après création** (doc 08 §6, décision d'analysis.md
 * §6 « pas de workflow, interdiction pure et simple de modification ») : il n'y
 * a délibérément aucune fonction `updateTarif` ni `deleteTarif` dans ce
 * service. Corriger un montant = créer un nouveau tarif sur une autre année
 * scolaire, ou ajuster les lignes des factures concernées tant qu'aucun
 * versement n'a été encaissé.
 *
 * La contrainte unique (anneeScolaireId, classeId, typeFraisId) de
 * `0001_init.sql` garantit qu'un même frais ne peut pas être tarifé deux fois
 * pour la même classe et la même année — l'immuabilité serait sinon
 * contournable par un doublon.
 */
export async function createTarif(input: CreateTarifInput): Promise<TarifScolaire> {
  const ctx = await requireRole('COMPTABLE', 'SECRETAIRE');

  if (!Number.isFinite(input.montant) || input.montant < 0) {
    throw new Error('Le montant doit être un nombre positif.');
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('tarif_scolaire')
    .insert({
      etablissementId: ctx.etablissementId,
      anneeScolaireId: input.anneeScolaireId,
      classeId: input.classeId,
      typeFraisId: input.typeFraisId,
      montant: input.montant,
    })
    .select(TARIF_FIELDS)
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error(
        'Ce frais est déjà tarifé pour cette classe et cette année scolaire. Un tarif est immuable : il ne peut pas être redéfini.',
      );
    }
    throw error;
  }

  await auditLog({
    action: 'CREATE_TARIF',
    module: 'finance',
    objetType: 'TarifScolaire',
    objetId: data.id,
    nouvelleValeur: {
      anneeScolaireId: input.anneeScolaireId,
      classeId: input.classeId,
      typeFraisId: input.typeFraisId,
      montant: input.montant,
    },
  });

  return data as unknown as TarifScolaire;
}

/** Somme des tarifs d'une classe pour une année — total facturé par défaut. */
export function totalTarifs(tarifs: Pick<TarifScolaire, 'montant'>[]): number {
  return tarifs.reduce((somme, t) => somme + Number(t.montant), 0);
}
