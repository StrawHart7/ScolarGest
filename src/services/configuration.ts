import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { PREREQUIS, type Domaine, type Prerequis } from '@/lib/configuration-domaines';

export interface EtatDomaine {
  /** Vrai quand tous les prérequis sont réunis : la section fonctionne. */
  ouvert: boolean;
  /** Ce qui manque, dans l'ordre où il faut s'y prendre. Vide si ouvert. */
  manques: Prerequis[];
}

/**
 * Les quelques comptages dont un verrou a besoin, et rien de plus.
 *
 * `diagnostiquer()` mesure déjà les vingt sondes du catalogue — c'est ce qu'il
 * faut à la checklist, qui montre tout. Ce n'est **pas** ce qu'il faut ici :
 * ce verrou est lu à chaque ouverture d'une page de finances, et vingt
 * comptages par page seraient payés toute la journée pour deux réponses.
 *
 * La règle, elle, n'est pas dupliquée : elle vit une seule fois dans
 * `src/lib/configuration-domaines.ts`, sous le même vocabulaire de sondes que
 * le diagnostic. Ce fichier ne décide de rien, il compte ce qu'on lui nomme.
 */
async function compter(
  table: string,
  etablissementId: string,
  filtres: Record<string, string> = {},
): Promise<number> {
  const supabase = createClient();
  let requete = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId);
  for (const [colonne, valeur] of Object.entries(filtres)) requete = requete.eq(colonne, valeur);

  const { count, error } = await requete;
  // On lève plutôt que de rendre zéro. Un comptage avalé donnerait « rien n'est
  // configuré » à une école qui l'est parfaitement, et lui fermerait ses
  // finances sur un à-coup de passerelle. C'est le défaut de `bilanCloture`,
  // qui annonçait zéro facture impayée parce que `error` n'était pas relu.
  if (error) throw error;
  return count ?? 0;
}

/**
 * Un domaine est-il utilisable, et sinon que manque-t-il ?
 *
 * La garde nomme les quatre rôles d'école : un Enseignant qui ouvre la saisie
 * des notes a autant besoin de savoir pourquoi elle est vide. Ce qu'il ne peut
 * pas, c'est la réparer — c'est l'affichage qui s'en occupe, en ne lui
 * proposant que les remèdes que son rôle lui ouvre.
 */
export async function etatDomaine(domaine: Domaine): Promise<EtatDomaine> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const etablissementId = ctx.etablissementId;
  if (!etablissementId) return { ouvert: true, manques: [] };

  const supabase = createClient();
  const { data: annee, error: erreurAnnee } = await supabase
    .from('annee_scolaire')
    .select('id')
    .eq('etablissementId', etablissementId)
    .eq('statut', 'ACTIVE')
    .maybeSingle();
  if (erreurAnnee) throw erreurAnnee;
  const anneeId = (annee as { id: string } | null)?.id ?? null;

  // Sans année active, rien n'est rattachable : le verrou n'a rien à dire que
  // `/demarrage` n'ait déjà dit, et l'ouvrir évite un second mur juste
  // derrière le premier.
  if (!anneeId) return { ouvert: true, manques: [] };

  const prerequis = PREREQUIS[domaine];
  const comptes = await Promise.all(
    prerequis.map((p) => {
      switch (p.sonde) {
        case 'typesFrais':
          return compter('type_frais', etablissementId);
        case 'tarifs':
          return compter('tarif_scolaire', etablissementId, { anneeScolaireId: anneeId });
        case 'enseignants':
          return compter('enseignant', etablissementId);
        case 'affectations':
          return compter('affectation_enseignant', etablissementId, { anneeScolaireId: anneeId });
        default:
          // Une sonde ajoutée au catalogue sans son comptage ici passerait pour
          // satisfaite et ouvrirait le domaine en silence. On préfère le dire.
          throw new Error(`Sonde « ${p.sonde} » sans comptage dans etatDomaine.`);
      }
    }),
  );

  const manques = prerequis.filter((_, i) => (comptes[i] ?? 0) === 0);
  return { ouvert: manques.length === 0, manques };
}
