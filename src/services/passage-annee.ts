import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import type { DecisionFinAnnee } from './inscription';

export interface InscriptionACloturer {
  inscriptionId: string;
  eleveId: string;
  eleveNom: string;
  elevePrenoms: string;
  classeId: string;
  classeNom: string;
  niveauId: string;
  niveauSuivantId: string | null;
}

/**
 * Liste les inscriptions ACTIVE de l'année source, avec assez de contexte
 * (niveau + niveau suivant) pour proposer une décision de passage.
 */
export async function listInscriptionsACloturer(anneeSourceId: string): Promise<InscriptionACloturer[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('inscription')
    .select(
      'id, "eleveId", "classeId", eleve:eleve(nom, prenoms), classe:classe(nom, "niveauId", niveau:niveau(id, "niveauSuivantId"))',
    )
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', anneeSourceId)
    .eq('statut', 'ACTIVE');
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      eleveId: string;
      classeId: string;
      eleve: { nom: string; prenoms: string };
      classe: { nom: string; niveauId: string; niveau: { id: string; niveauSuivantId: string | null } };
    };
    return {
      inscriptionId: r.id,
      eleveId: r.eleveId,
      eleveNom: r.eleve.nom,
      elevePrenoms: r.eleve.prenoms,
      classeId: r.classeId,
      classeNom: r.classe.nom,
      niveauId: r.classe.niveauId,
      niveauSuivantId: r.classe.niveau.niveauSuivantId,
    };
  });
}

export interface DecisionProposee extends InscriptionACloturer {
  decisionProposee: DecisionFinAnnee;
}

/**
 * Pré-remplit une décision suggérée par élève : ADMIS si le niveau a un
 * niveau_suivant_id (progression naturelle), sinon DEPART (ex: dernière
 * classe du cursus). Purement indicatif — modifiable en UI avant validation.
 */
export function proposerDecisions(inscriptions: InscriptionACloturer[]): DecisionProposee[] {
  return inscriptions.map((i) => ({
    ...i,
    decisionProposee: i.niveauSuivantId ? 'ADMIS' : 'DEPART',
  }));
}

export interface DecisionCohorte {
  eleveId: string;
  inscriptionSourceId: string;
  decision: DecisionFinAnnee;
  classeCibleId?: string;
}

export interface ResultatPassageLigne {
  eleveId: string;
  ok: boolean;
  message: string;
  inscriptionCibleId?: string;
  factureCibleId?: string;
}

/**
 * Valide le passage de cohorte : appelle la RPC transactionnelle par lot
 * (ligne par ligne avec rapport, pas de rollback global — voir
 * fn_passer_cohorte). DEPART : aucune nouvelle inscription, statut élève
 * inchangé (décision produit confirmée).
 */
export async function validerPassageCohorte(
  anneeCibleId: string,
  decisions: DecisionCohorte[],
): Promise<ResultatPassageLigne[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const { data, error } = await supabase.rpc('fn_passer_cohorte', {
    p_etablissement_id: ctx.etablissementId,
    p_annee_cible_id: anneeCibleId,
    p_decisions: decisions,
  });
  if (error) throw new Error(error.message);

  const resultats = data as ResultatPassageLigne[];

  await auditLog({
    action: 'PASSAGE_COHORTE',
    module: 'eleves',
    objetType: 'PassageCohorte',
    nouvelleValeur: {
      anneeCibleId,
      total: resultats.length,
      succes: resultats.filter((r) => r.ok).length,
      echecs: resultats.filter((r) => !r.ok).length,
    },
  });

  return resultats;
}
