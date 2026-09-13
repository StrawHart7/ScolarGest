import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import {
  annonceConcerneEcole,
  MAX_ANNONCES_AFFICHEES,
  type AnnonceEnCours,
} from '@/lib/annonce';

/**
 * Lecture des annonces de la plateforme, côté école.
 *
 * C'est le consommateur qui manquait à `public.evenement_global_publie` :
 * la table était écrite par la Régie et lue par personne, si bien que l'écran
 * « Annonces » de la console écrivait dans le vide. Une table écrite et jamais
 * lue est la même faute qu'une colonne morte — ce dépôt en a déjà payé deux
 * (`etablissement.logo`, `matiere.matiereOfficielleId`).
 *
 * ## Ce qui filtre quoi
 *
 * La **fenêtre** et la **publication** sont filtrées en base, et la policy RLS
 * `evenement_global_lecture` refuse déjà tout brouillon : la condition est donc
 * écrite aux deux endroits, délibérément. La clé anon est publique, et une
 * lecture qui passerait un jour à côté de ce service trouverait quand même la
 * RLS — un brouillon d'annonce ne doit jamais atteindre une école.
 *
 * Le **cycle**, lui, se filtre ici : il demande de savoir ce que l'école
 * enseigne, ce qu'une policy sur une table sans `etablissementId` ne peut pas
 * dire.
 *
 * ## Le silence en cas d'échec
 *
 * Cette fonction ne lève pas — même parti pris que `AbonnementBanner` et
 * `getConseilDuMoment` : une annonce est un supplément, et faire tomber toutes
 * les pages de l'application parce qu'un bandeau d'information n'a pas pu être
 * lu serait un très mauvais échange.
 */
export async function listAnnoncesEnCours(): Promise<AnnonceEnCours[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();

  const maintenant = new Date().toISOString();
  const { data, error } = await supabase
    .from('evenement_global_publie')
    .select('id, type, titre, message, "cycleId", "finitLe"')
    .not('publieLe', 'is', null)
    .lte('debuteLe', maintenant)
    .gt('finitLe', maintenant)
    // **La plus périssable en tête.** L'ordre décide maintenant laquelle est
    // mise en avant : depuis la refonte de la barre latérale, la première garde
    // sa carte et la suivante devient une rangée d'une ligne.
    //
    // Trier par date d'ouverture mettait en avant la plus ancienne — celle
    // qu'on a déjà vue quatre jours de suite — et reléguait une maintenance
    // prévue ce soir. La date de fin la plus proche est le bon critère, et il
    // se passe d'une hiérarchie entre les types : une maintenance a une fenêtre
    // courte par nature, elle passe devant toute seule.
    .order('finitLe', { ascending: true })
    // De la marge : on filtre ensuite par cycle **et** par ce que la personne a
    // déjà écarté. Demander le strict nécessaire rendrait une liste vide à
    // quelqu'un qui a lu la première d'une série.
    .limit(MAX_ANNONCES_AFFICHEES + 6);
  if (error) throw error;

  const candidates = (data ?? []) as unknown as AnnonceEnCours[];
  if (candidates.length === 0) return [];

  // Aucune annonce ciblée : inutile d'aller lire les cycles de l'école. Ce
  // bandeau est rendu sur **toutes** les pages de l'espace applicatif, et le
  // cas ordinaire — rien à annoncer, ou une annonce générale — ne doit coûter
  // qu'une seule requête.
  const cible = candidates.some((annonce) => annonce.cycleId !== null);
  const cyclesActifs = cible && ctx.etablissementId ? await lireCyclesActifs(ctx.etablissementId) : [];

  const pourCetteEcole = candidates.filter((annonce) =>
    annonceConcerneEcole(annonce, cyclesActifs),
  );
  if (pourCetteEcole.length === 0) return [];

  const lues = await lecturesDe(
    ctx.userId,
    pourCetteEcole.map((a) => a.id),
  );

  return pourCetteEcole.filter((a) => !lues.has(a.id)).slice(0, MAX_ANNONCES_AFFICHEES);
}

/**
 * Ce que **cette personne** a déjà écarté.
 *
 * Par personne et non par école, délibérément : si la Directrice écarte « les
 * épreuves du BAC commencent lundi », la Secrétaire et le Comptable ne doivent
 * pas la perdre. Le raisonnement complet est dans la migration
 * `20260913150152`.
 *
 * La requête est bornée aux annonces qu'on vient de lire : la liste des marques
 * d'une personne grandit avec le temps, celle des annonces en cours non.
 */
async function lecturesDe(userId: string, annonceIds: string[]): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('annonce_lue')
    .select('"evenementGlobalId"')
    .eq('userId', userId)
    .in('evenementGlobalId', annonceIds);
  if (error) throw error;
  return new Set(
    (data ?? []).map((l) => (l as { evenementGlobalId: string }).evenementGlobalId),
  );
}

/**
 * « J'ai lu. »
 *
 * Le geste n'existe **qu'au bas du lecteur plein texte** : il faut avoir ouvert
 * pour pouvoir écarter. La carte de la barre latérale, elle, ne se ferme
 * toujours pas — c'est ce qui donne à une annonce sa durée.
 *
 * `on conflict do nothing` : marquer deux fois n'est pas une faute, c'est un
 * double clic. Lever ici afficherait une erreur pour un geste qui a abouti.
 *
 * L'établissement n'est pas reçu de l'appelant : il vient du contexte tenant,
 * et la policy le revérifie contre le JWT. Une école ne gonfle pas le compteur
 * de lecture d'une autre.
 */
export async function marquerAnnonceLue(evenementGlobalId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  if (!ctx.etablissementId) return;

  const supabase = createClient();
  const { error } = await supabase
    .from('annonce_lue')
    .upsert(
      {
        evenementGlobalId,
        userId: ctx.userId,
        etablissementId: ctx.etablissementId,
      },
      { onConflict: 'evenementGlobalId,userId', ignoreDuplicates: true },
    );
  if (error) throw error;
}

/**
 * Les cycles que l'école enseigne.
 *
 * Lecture directe plutôt qu'un appel à `listCyclesActifs()` : celle-ci porte sa
 * propre garde de rôle, qui serait vérifiée une seconde fois pour rien, et rend
 * les cycles complets là où on n'a besoin que d'identifiants.
 *
 * Elle ne filtre **pas** `cycle.disponible`, comme `listCyclesActifs`. Une
 * école qui garde des classes de primaire enseigne toujours le primaire : lui
 * cacher une annonce qui la concerne parce qu'on ne vend plus ce cycle serait
 * confondre le catalogue commercial avec la réalité de l'école.
 */
async function lireCyclesActifs(etablissementId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cycle_etablissement')
    .select('"cycleId"')
    .eq('etablissementId', etablissementId)
    .eq('actif', true);
  if (error) throw error;
  return (data ?? []).map((ligne) => (ligne as { cycleId: string }).cycleId);
}
