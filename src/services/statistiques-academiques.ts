import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { listClasses } from './classe';
import { getResultatsClasse } from './resultats-classe';
import type { Periode } from './evaluation';
import {
  agregerStatistiques,
  type EleveEvalue,
  type StatistiquesAcademiques,
} from '@/lib/statistiques';

/**
 * Statistiques académiques de l'établissement, pour le pilotage pédagogique.
 *
 * **Directeur et Secrétaire.** Le pilotage pédagogique relève de la direction,
 * mais la Secrétaire saisit et suit déjà les notes, les bulletins et les
 * inscriptions : lui refuser la lecture d'ensemble de ce qu'elle produit
 * n'aurait pas de sens. Les rôles financiers en restent exclus — le Comptable
 * n'a rien à faire des moyennes par classe.
 *
 * **Aucune statistique par enseignant**, décision produit du 2026-09-01. La
 * moyenne des classes d'un professeur ne mesure pas son travail : elle mêle la
 * difficulté de la matière, le niveau du groupe hérité et l'effectif. Le
 * chiffre serait lu comme un classement, et se retournerait contre son sujet.
 *
 * **Les moyennes viennent de `getResultatsClasse`**, le même calcul que
 * l'écran « Moyennes & classement ». Recalculer ici, même à l'identique, ferait
 * courir le risque d'une divergence : une page annonçant 11,2 quand l'autre
 * affiche 11,4 détruit la confiance dans les deux. Le prix est une lecture par
 * classe plutôt qu'une requête globale — acceptable sur un écran de pilotage
 * qu'on ouvre quelques fois par trimestre.
 */

export type { StatistiquesAcademiques } from '@/lib/statistiques';
export { SEUIL_REUSSITE, TRANCHES } from '@/lib/statistiques';

export async function getStatistiquesAcademiques(
  anneeScolaireId: string,
  periode: Periode,
): Promise<StatistiquesAcademiques> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');
  const supabase = createClient();

  const classes = await listClasses(anneeScolaireId);
  if (classes.length === 0) {
    return agregerStatistiques([], []);
  }

  // Le sexe n'est pas porté par `getResultatsClasse` — une requête pour tout
  // l'établissement plutôt qu'une par classe.
  const { data: elevesBruts, error } = await supabase
    .from('eleve')
    .select('id, sexe')
    .eq('etablissementId', ctx.etablissementId);
  if (error) throw error;
  const sexeParEleve = new Map(
    ((elevesBruts ?? []) as { id: string; sexe: string }[]).map((e) => [e.id, e.sexe]),
  );

  const resultats = await Promise.all(
    classes.map(async (classe) => ({
      classe,
      resultats: await getResultatsClasse(classe.id, periode, anneeScolaireId),
    })),
  );

  const evalues: EleveEvalue[] = [];
  for (const { classe, resultats: r } of resultats) {
    for (const eleve of r.eleves) {
      evalues.push({
        eleveId: eleve.eleveId,
        classeId: classe.id,
        classeNom: classe.nom,
        niveauNom: classe.niveau.nom,
        sexe: sexeParEleve.get(eleve.eleveId) === 'F' ? 'F' : 'M',
        moyenne: eleve.moyenneTrimestrielle,
        matieres: eleve.matieres.map((m) => ({
          matiereId: m.matiereId,
          matiereNom: m.matiereNom,
          moyenne: m.moyenne,
        })),
      });
    }
  }

  return agregerStatistiques(
    evalues,
    classes.map((c) => ({ id: c.id, nom: c.nom, niveauNom: c.niveau.nom })),
  );
}
