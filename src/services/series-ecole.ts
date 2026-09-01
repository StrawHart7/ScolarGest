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
 * Bornes mensuelles d'une annee scolaire, incluses.
 *
 * Une ecole ne raisonne pas en douze mois glissants mais en **annee
 * scolaire**. La fenetre glissante avait un defaut visible des la premiere
 * mise en service : une ecole qui inscrit tous ses eleves en septembre voit son
 * histogramme se vider le 1er octobre suivant, alors que l'annee est en cours.
 * Elle repondait a « ces douze derniers mois », question que personne ne se
 * pose dans une ecole.
 */
export function moisDeLAnnee(dateDebut: string, dateFin: string): string[] {
  const debut = new Date(dateDebut);
  const fin = new Date(dateFin);
  const mois: string[] = [];
  const curseur = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), 1));
  const borne = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), 1));
  // Garde-fou : une annee mal saisie ne doit pas produire une boucle infinie
  // ni une serie de plusieurs centaines de colonnes.
  while (curseur <= borne && mois.length < 24) {
    mois.push(cleMois(curseur));
    curseur.setUTCMonth(curseur.getUTCMonth() + 1);
  }
  return mois;
}

function cleMois(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Assemble une serie complete a partir de lignes datees et d'une liste de mois.
 *
 * Exportee pour etre testable sans base : c'est ici que vit la seule logique
 * non triviale du module — le remplissage des mois vides et le rejet des
 * lignes hors fenetre.
 */
export function construireSerie(
  lignes: { date: string; valeur: number }[],
  mois: string[],
): PointMensuel[] {
  const cases = new Map<string, number>();
  for (const m of mois) cases.set(m, 0);
  for (const ligne of lignes) {
    const cle = cleMois(new Date(ligne.date));
    // Une ligne hors fenetre est ignoree plutot qu'ajoutee au premier mois :
    // la borne SQL peut laisser passer un decalage de fuseau, et la rattacher
    // creerait un pic artificiel en debut de courbe.
    if (cases.has(cle)) cases.set(cle, (cases.get(cle) ?? 0) + ligne.valeur);
  }
  return [...cases.entries()].map(([m, valeur]) => ({ mois: m, valeur }));
}

/**
 * Une serie annuelle, avec de quoi la situer.
 *
 * `variation` compare a l'annee scolaire precedente **sur son entierete**, pas
 * au meme rang de mois : une annee en cours a moins de mois ecoules, et la
 * comparer a une annee complete ferait apparaitre une chute qui n'existe pas.
 * `comparable` dit si la comparaison a un sens ; l'interface s'abstient sinon.
 */
export interface SerieAnnuelle {
  points: PointMensuel[];
  total: number;
  totalPrecedent: number | null;
  /** Variation en %, arrondie. `null` s'il n'y a pas de precedent exploitable. */
  variation: number | null;
}

interface Fenetre {
  id: string;
  dateDebut: string;
  dateFin: string;
}

/** Annee demandee et celle qui la precede, par date de debut. */
async function fenetres(anneeScolaireId: string): Promise<{ courante: Fenetre; precedente: Fenetre | null }> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('annee_scolaire')
    .select('id, "dateDebut", "dateFin"')
    .eq('etablissementId', ctx.etablissementId)
    .order('dateDebut', { ascending: false });
  if (error) throw error;

  const annees = (data ?? []) as unknown as Fenetre[];
  const index = annees.findIndex((a) => a.id === anneeScolaireId);
  if (index === -1) throw new Error('Annee scolaire introuvable.');
  return { courante: annees[index]!, precedente: annees[index + 1] ?? null };
}

function variation(total: number, precedent: number | null): number | null {
  // Une progression depuis zero n'est pas un pourcentage : « +infini » ne se
  // dit pas, et « +100 % » serait faux.
  if (precedent === null || precedent === 0) return null;
  return Math.round(((total - precedent) / precedent) * 100);
}

/** Somme des paiements PAYE d'une fenetre, rattaches au tenant par leur facture. */
async function lignesPaiements(
  etablissementId: string,
  debut: string,
  fin: string,
): Promise<{ date: string; valeur: number }[]> {
  const supabase = createClient();

  // `paiement` **ne porte pas** de colonne `etablissementId` : il est rattache
  // au tenant par sa facture. Filtrer directement dessus ne renvoie pas un
  // resultat vide, cela leve.
  const { data: factures, error: erreurFactures } = await supabase
    .from('facture_eleve')
    .select('id')
    .eq('etablissementId', etablissementId)
    .neq('statut', 'ANNULE');
  if (erreurFactures) throw erreurFactures;

  const ids = (factures ?? []).map((f) => (f as { id: string }).id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('paiement')
    .select('montant, "datePaiement"')
    .in('factureId', ids)
    .eq('statut', 'PAYE')
    .gte('datePaiement', debut)
    .lte('datePaiement', fin);
  if (error) throw error;

  return (data ?? []).map((p) => ({
    date: (p as { datePaiement: string }).datePaiement,
    valeur: Number((p as { montant: string | number }).montant),
  }));
}

/**
 * Encaissements mois par mois sur une annee scolaire.
 *
 * Seuls les paiements PAYE comptent : un paiement annule reste en base — les
 * donnees financieres ne se suppriment pas — et le compter gonflerait la
 * courbe d'argent jamais recu.
 */
export async function encaissementsAnnee(anneeScolaireId: string): Promise<SerieAnnuelle> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');
  const { courante, precedente } = await fenetres(anneeScolaireId);

  const lignes = await lignesPaiements(ctx.etablissementId, courante.dateDebut, courante.dateFin);
  const points = construireSerie(lignes, moisDeLAnnee(courante.dateDebut, courante.dateFin));
  const total = points.reduce((s, p) => s + p.valeur, 0);

  let totalPrecedent: number | null = null;
  if (precedente) {
    const avant = await lignesPaiements(
      ctx.etablissementId,
      precedente.dateDebut,
      precedente.dateFin,
    );
    totalPrecedent = avant.reduce((s, l) => s + l.valeur, 0);
  }

  return { points, total, totalPrecedent, variation: variation(total, totalPrecedent) };
}

/**
 * Inscriptions mois par mois sur une annee scolaire.
 *
 * Compte l'acte d'inscrire, pas l'effectif : une inscription TERMINEE ou en
 * ABANDON reste dans le mois ou elle a eu lieu. Seul ANNULEE est ecarte — une
 * annulation est une saisie reprise, pas un depart, et la compter ferait
 * apparaitre une affluence qui n'a pas existe.
 */
export async function inscriptionsAnnee(anneeScolaireId: string): Promise<SerieAnnuelle> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const { courante, precedente } = await fenetres(anneeScolaireId);
  const supabase = createClient();

  const compter = async (annee: Fenetre) => {
    const { data, error } = await supabase
      .from('inscription')
      .select('"dateInscription"')
      .eq('etablissementId', ctx.etablissementId)
      .eq('anneeScolaireId', annee.id)
      .neq('statut', 'ANNULEE');
    if (error) throw error;
    return (data ?? []).map((i) => ({
      date: (i as { dateInscription: string }).dateInscription,
      valeur: 1,
    }));
  };

  const lignes = await compter(courante);
  const points = construireSerie(lignes, moisDeLAnnee(courante.dateDebut, courante.dateFin));
  const total = points.reduce((s, p) => s + p.valeur, 0);

  let totalPrecedent: number | null = null;
  if (precedente) totalPrecedent = (await compter(precedente)).length;

  return { points, total, totalPrecedent, variation: variation(total, totalPrecedent) };
}
