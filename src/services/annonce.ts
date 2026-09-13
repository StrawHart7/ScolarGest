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
    // La plus récemment ouverte en tête : c'est celle que le lecteur n'a pas
    // encore vue. Une annonce qui traîne depuis deux semaines a déjà été lue,
    // ou ne le sera jamais.
    .order('debuteLe', { ascending: false })
    .limit(MAX_ANNONCES_AFFICHEES + 1);
  if (error) throw error;

  const annonces = (data ?? []) as unknown as AnnonceEnCours[];

  // Aucune annonce ciblée : inutile d'aller lire les cycles de l'école. Ce
  // bandeau est rendu sur **toutes** les pages de l'espace applicatif, et le
  // cas ordinaire — rien à annoncer, ou une annonce générale — ne doit coûter
  // qu'une seule requête.
  const cible = annonces.some((annonce) => annonce.cycleId !== null);
  const cyclesActifs = cible && ctx.etablissementId ? await lireCyclesActifs(ctx.etablissementId) : [];

  return annonces
    .filter((annonce) => annonceConcerneEcole(annonce, cyclesActifs))
    .slice(0, MAX_ANNONCES_AFFICHEES);
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
