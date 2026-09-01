import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';

/**
 * Series temporelles d'une ecole, pour les graphes du tableau de bord.
 *
 * Separe de `dashboard.ts`, qui repond a « ou en est-on maintenant ». Ici on
 * repond a « comment on y est arrive » — deux questions, deux formes de
 * donnees, et melanger les deux ferait grossir un service deja dense.
 *
 * **Aucune table d'historique n'est necessaire.** Les flux portent leur propre
 * date : `paiement.datePaiement` et `inscription.dateInscription` suffisent a
 * reconstituer l'exact, mois par mois. Ce qui n'est pas reconstituable, en
 * revanche, c'est l'**etat retroactif** — `statut` est modifie sur place, sans
 * trace. « Combien de factures etaient impayees en juin » est hors de portee,
 * et le restera tant qu'on n'ecrira pas d'instantanes. Ne pas confondre les
 * deux en ajoutant ici une serie qui mentirait.
 *
 * Les gardes reprennent celles de `paiement.ts` et `inscription.ts` : la
 * Secretaire a un acces finance en lecture seule (doc 08 § 17), le Comptable
 * n'a rien a faire du cote academique.
 */

/** Un point de serie : un mois, une valeur. */
export interface PointMensuel {
  /** Premier jour du mois, en `yyyy-MM` — cle stable, independante du fuseau. */
  mois: string;
  valeur: number;
}

/**
 * Les mois vides doivent exister dans la serie.
 *
 * Un mois sans paiement est une information — c'est un creux, et un creux se
 * voit sur une courbe. Si on se contente des mois presents en base, la courbe
 * relie decembre a fevrier en ligne droite et efface un janvier a zero.
 */
function squelette(nombreMois: number, fin: Date): Map<string, number> {
  const cases = new Map<string, number>();
  for (let i = nombreMois - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - i, 1));
    cases.set(cleMois(d), 0);
  }
  return cases;
}

function cleMois(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Debut du mois le plus ancien de la fenetre, en ISO — borne de la requete. */
function debutFenetre(nombreMois: number, fin: Date): string {
  return new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - (nombreMois - 1), 1)).toISOString();
}

/**
 * Assemble une serie complete a partir de lignes datees.
 *
 * Exportee pour etre testable sans base : c'est ici que vit la seule logique
 * non triviale du module — le remplissage des mois vides et le rejet des
 * lignes hors fenetre.
 */
export function construireSerie(
  lignes: { date: string; valeur: number }[],
  nombreMois: number,
  fin: Date = new Date(),
): PointMensuel[] {
  return agreger(squelette(nombreMois, fin), lignes);
}

function agreger(
  cases: Map<string, number>,
  lignes: { date: string; valeur: number }[],
): PointMensuel[] {
  for (const ligne of lignes) {
    const cle = cleMois(new Date(ligne.date));
    // Une ligne hors fenetre est ignoree plutot qu'ajoutee : la borne SQL peut
    // laisser passer un decalage de fuseau de quelques heures.
    if (cases.has(cle)) cases.set(cle, (cases.get(cle) ?? 0) + ligne.valeur);
  }
  return [...cases.entries()].map(([mois, valeur]) => ({ mois, valeur }));
}

/**
 * Encaissements reels par mois, sur les `nombreMois` derniers mois.
 *
 * Seuls les paiements en statut PAYE sont comptes : un paiement annule reste
 * en base (invariant « pas de suppression dure » sur les donnees financieres)
 * et le compter gonflerait la courbe d'argent jamais recu.
 */
export async function encaissementsParMois(nombreMois = 12): Promise<PointMensuel[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const fin = new Date();

  // `paiement` **ne porte pas** de colonne `etablissementId` : il est rattache
  // au tenant par sa facture. Filtrer directement dessus ne renvoie pas un
  // resultat vide, cela leve — et faisait tomber tout le tableau de bord.
  // Meme piege que lors de la suppression du doublon d'etablissement, ou trois
  // controles avaient echoue en silence pour cette raison.
  const { data: factures, error: erreurFactures } = await supabase
    .from('facture_eleve')
    .select('id')
    .eq('etablissementId', ctx.etablissementId)
    .neq('statut', 'ANNULE');
  if (erreurFactures) throw erreurFactures;

  const idsFactures = (factures ?? []).map((f) => (f as { id: string }).id);
  if (idsFactures.length === 0) return construireSerie([], nombreMois, fin);

  const { data, error } = await supabase
    .from('paiement')
    .select('montant, "datePaiement"')
    .in('factureId', idsFactures)
    .eq('statut', 'PAYE')
    .gte('datePaiement', debutFenetre(nombreMois, fin));
  if (error) throw error;

  return construireSerie(
    (data ?? []).map((p) => ({
      date: (p as { datePaiement: string }).datePaiement,
      valeur: Number((p as { montant: string | number }).montant),
    })),
    nombreMois,
    fin,
  );
}

/**
 * Inscriptions par mois, sur les `nombreMois` derniers mois.
 *
 * Compte l'acte d'inscrire, pas l'effectif : une inscription TERMINEE ou en
 * ABANDON garde sa date et reste dans la courbe du mois ou elle a eu lieu. La
 * serie repond a « quand les familles s'inscrivent-elles », question de
 * saisonnalite, et non a « combien d'eleves avons-nous », que `dashboard.ts`
 * traite deja sur le statut ACTIVE.
 *
 * Seul ANNULEE est exclu : une inscription annulee n'a jamais eu lieu — c'est
 * une saisie reprise, pas un depart. La compter ferait apparaitre une affluence
 * qui n'a pas existe.
 */
export async function inscriptionsParMois(nombreMois = 12): Promise<PointMensuel[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();
  const fin = new Date();

  const { data, error } = await supabase
    .from('inscription')
    .select('"dateInscription"')
    .eq('etablissementId', ctx.etablissementId)
    .neq('statut', 'ANNULEE')
    .gte('dateInscription', debutFenetre(nombreMois, fin));
  if (error) throw error;

  return construireSerie(
    (data ?? []).map((i) => ({
      date: (i as { dateInscription: string }).dateInscription,
      valeur: 1,
    })),
    nombreMois,
    fin,
  );
}
