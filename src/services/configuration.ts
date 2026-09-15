import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { PREREQUIS, type Domaine, type Prerequis } from '@/lib/configuration-domaines';
import { CATALOGUE, type Conseil, type IdConseil } from '@/lib/conseils/catalogue';
import { formaterTexte, sondeSatisfaite } from '@/lib/conseils/choix';
import { cheminAutorise } from '@/lib/navigation';
import { memoiserParRequete } from '@/lib/memo';
import { diagnostiquer } from './conseils';

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

// ---------------------------------------------------------------------------
// Le socle : la checklist permanente de configuration
// ---------------------------------------------------------------------------

export interface ElementSocle {
  id: IdConseil;
  titre: string;
  /** Le texte du catalogue, ses jetons `{fait}` / `{total}` déjà substitués. */
  texte: string;
  action: { label: string; href: string } | null;
  fait: boolean;
  /** Vrai quand l'écran visé est ouvert au rôle qui regarde. */
  actionnable: boolean;
}

export interface EtatSocle {
  requis: ElementSocle[];
  recommandes: ElementSocle[];
  /** Combien de `requis` sont faits, et combien il y en a. Les recommandés ne comptent pas. */
  faits: number;
  total: number;
  /** Vrai quand tous les requis sont faits : l'établissement est configuré. */
  complet: boolean;
}

/**
 * L'état de la configuration, déduit des données — jamais stocké.
 *
 * Même doctrine que `src/services/onboarding.ts`, et pour la même raison : un
 * avancement stocké diverge dès qu'un réglage est fait par le chemin ordinaire
 * plutôt que par la checklist. Ici il n'y a rien à faire diverger, la question
 * « y a-t-il au moins un tarif ? » n'a qu'une réponse.
 *
 * Le contenu vient du **catalogue des conseils**, pas d'une seconde liste. Les
 * vingt-deux entrées portaient déjà leur texte, leur sonde et leur lien ; il
 * leur manquait un axe — `socle` — et une surface. Recopier les libellés ici
 * aurait produit deux vérités, et c'est toujours celle qu'on ne relit pas qui
 * se trompe.
 *
 * `total === 0` sur une sonde veut dire **non applicable**, pas « rien de
 * fait » : une école sans classe ne doit pas lire « 0 emploi du temps sur 0 ».
 * Un élément non applicable est compté comme fait — sinon il figerait
 * définitivement le ratio d'une école à qui il ne s'adresse pas.
 */
export const etatSocle = memoiserParRequete(async function etatSocle(): Promise<EtatSocle> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const diagnostic = await diagnostiquer();

  const construire = (conseil: Conseil): ElementSocle => {
    const valeur = conseil.sonde ? diagnostic[conseil.sonde] : undefined;
    const nonApplicable = Boolean(valeur && valeur.total === 0);
    return {
      id: conseil.id,
      titre: conseil.titre,
      texte: formaterTexte(conseil.texte, valeur),
      action: conseil.action,
      fait: nonApplicable || sondeSatisfaite(valeur),
      actionnable: conseil.action ? cheminAutorise(conseil.action.href, ctx.role) : false,
    };
  };

  const duSocle = (niveau: 'REQUIS' | 'RECOMMANDE') =>
    CATALOGUE.filter((c) => c.socle === niveau).map(construire);

  const requis = duSocle('REQUIS');
  const recommandes = duSocle('RECOMMANDE');
  const faits = requis.filter((e) => e.fait).length;

  return { requis, recommandes, faits, total: requis.length, complet: faits === requis.length };
});

/**
 * Les neuf réglages indispensables sont-ils faits ?
 *
 * ## Pourquoi déléguer plutôt que recompter
 *
 * La tentation était de ne sonder que ce dont les entrées `REQUIS` ont besoin,
 * pour une page plus légère. Ce serait une **seconde vérité** : le jour où une
 * entrée du catalogue change de sonde, l'écran de configuration et la barre de
 * la section ne diraient plus la même chose, et c'est toujours celle qu'on ne
 * relit pas qui se trompe. Même raisonnement que pour `etatSocle`, qui puise
 * déjà dans le catalogue des conseils au lieu de tenir sa propre liste.
 *
 * La mémoïsation par requête est ce qui rend le partage gratuit : l'écran de
 * configuration appelle `etatSocle` pour son contenu, la barre appelle
 * `socleComplet` pour sa composition, et le diagnostic ne tourne qu'une fois.
 *
 * ## Elle ne lève jamais
 *
 * Une lecture qui échoue ne doit pas emporter la page : la barre de navigation
 * n'est pas le sujet de l'écran qu'on est venu voir. Le repli est **`false`**,
 * c'est-à-dire « on garde Configuration visible ». Se tromper dans ce sens
 * affiche une entrée de trop ; se tromper dans l'autre ferait disparaître le
 * seul chemin vers ce qui reste à régler, précisément à une école qui n'a pas
 * fini de se configurer.
 */
export async function socleComplet(): Promise<boolean> {
  try {
    return (await etatSocle()).complet;
  } catch {
    return false;
  }
}
