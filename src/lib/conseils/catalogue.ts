import type { Role } from '@/services/tenant';

/**
 * Catalogue des conseils affichés au fil de l'usage.
 *
 * **Le problème.** Un utilisateur a accès à la plateforme sans savoir ce
 * qu'elle sait faire. Personne ne lui dit qu'il peut composer un emploi du
 * temps par classe, importer ses élèves depuis un tableur ou poser un
 * filigrane sur ses bulletins. Le questionnaire de démarrage couvre la
 * configuration initiale et s'arrête là ; tout ce qui vient après reste à
 * découvrir seul.
 *
 * **Le principe.** Un conseil ne se marque pas « fait » : il **cesse d'être
 * pertinent** parce que la donnée qu'il réclamait existe. C'est la doctrine
 * déjà retenue pour `/demarrage` (voir `src/services/onboarding.ts`) —
 * l'avancement se déduit des données, le dupliquer dans une colonne le ferait
 * diverger dès qu'une configuration passe par les écrans habituels.
 *
 * **Module sans dépendance, délibérément.** Le panneau qui affiche un conseil
 * est un composant client ; importer un service y ferait entrer
 * `next/headers` dans le bundle et échouer la compilation Next — panne déjà
 * rencontrée le 2026-09-02 sur le formulaire de support. Le vocabulaire vit
 * ici, le service ne garde que les fonctions gardées.
 *
 * **Une fonctionnalité livrée sans son conseil est une fonctionnalité que
 * personne ne trouvera.** Ajouter une entrée ici fait partie de la livraison,
 * au même titre que sa migration et ses tests.
 */

/** Identifiant stable : il est stocké en base, il ne se renomme pas. */
export type IdConseil =
  // Fondation — sans quoi la plateforme ne produit rien
  | 'annee-scolaire'
  | 'classes'
  | 'programme'
  | 'coefficients'
  | 'eleves'
  // Exploitation — ce qui fait tourner l'école
  | 'import-eleves'
  | 'enseignants'
  | 'affectations'
  | 'evaluations'
  | 'emploi-du-temps'
  | 'types-frais'
  | 'tarifs'
  | 'import-versements'
  | 'bulletins'
  // Complétion — les trous partiels
  | 'emploi-du-temps-partiel'
  | 'professeur-principal'
  | 'eleves-sans-responsable'
  | 'factures-impayees'
  // Confort — l'outillage personnel
  | 'pin'
  | 'equipe-administrative'
  | 'logo-documents'
  | 'filigrane'
  | 'statistiques'
  | 'recherche-globale'
  | 'notes-hors-ligne';

/**
 * Ordre dans lequel les familles se vident. On ne descend jamais dans une
 * famille tant que la précédente a un candidat : proposer de choisir un
 * filigrane à une école qui n'a pas encore d'élèves serait absurde.
 */
export type Famille =
  | 'FONDATION'
  | 'EXPLOITATION'
  | 'COMPLETION'
  | 'CONFORT'
  | 'DECOUVERTE';

/**
 * `DECOUVERTE` vient en dernier, et c'est une correction apportee par les
 * tests : un conseil de decouverte n'a pas de sonde, donc rien ne le retire
 * tant qu'il n'a pas ete suivi. Range en EXPLOITATION, « saviez-vous que vous
 * pouvez importer vos eleves ? » masquait indefiniment « il manque l'emploi du
 * temps de deux classes » — une invitation a explorer couvrant un trou reel.
 * Un manque constate passe avant une fonctionnalite a faire connaitre.
 */
export const ORDRE_FAMILLES: Famille[] = [
  'FONDATION',
  'EXPLOITATION',
  'COMPLETION',
  'CONFORT',
  'DECOUVERTE',
];

/**
 * Nom de la sonde qui décide si un conseil a encore un sens. Un nom, jamais
 * une fonction : le conseil traverse la frontière serveur/client, et une
 * fonction y lèverait « Functions cannot be passed directly to Client
 * Components » — à l'exécution seulement, `tsc` l'acceptant sans rien dire.
 */
export type NomSonde =
  | 'anneeActive'
  | 'classes'
  | 'programme'
  | 'coefficients'
  | 'eleves'
  | 'enseignants'
  | 'affectations'
  | 'evaluations'
  | 'creneaux'
  | 'typesFrais'
  | 'tarifs'
  | 'bulletins'
  | 'classesAvecEmploiDuTemps'
  | 'classesAvecProfesseurPrincipal'
  | 'elevesAvecResponsable'
  | 'facturesSoldees'
  | 'pinDefini'
  | 'logoDefini'
  | 'filigraneDefini'
  | 'equipeAdministrative';

/**
 * Intitules des familles, pour l'inventaire de l'aide. Ils decrivent ce que
 * la famille fait pour l'ecole, pas son rang : « Fondation » seul ne dirait
 * rien a un Directeur qui cherche ce qui lui reste a faire.
 */
export const LIBELLE_FAMILLE: Record<Famille, string> = {
  FONDATION: 'Ce qui doit exister avant tout',
  EXPLOITATION: "Faire tourner l'annee",
  COMPLETION: 'Ce qui est commence et pas fini',
  CONFORT: 'Confort et identite',
  DECOUVERTE: 'Bon a savoir',
};

export interface Conseil {
  id: IdConseil;
  titre: string;
  /**
   * Corps du conseil. Trois jetons y sont substitués par `formaterTexte` :
   * `{fait}`, `{total}` et `{restant}`. C'est ce qui permet à un conseil de
   * complétion de porter son propre chiffre — « 4 classes sur 6 » — sans
   * qu'une fonction ait à franchir la frontière client.
   */
  texte: string;
  /** Où aller pour le faire. `null` pour un conseil purement informatif. */
  action: { label: string; href: string } | null;
  roles: Role[];
  famille: Famille;
  /**
   * Chronologie, exprimée en dépendances plutôt qu'en numéro d'ordre : un
   * conseil dont un prérequis n'est pas satisfait n'est pas seulement rangé
   * après, il est **inéligible**. On ne parle pas de filigrane à quelqu'un
   * qui n'a pas encore de bulletin à filigraner.
   */
  prerequis: IdConseil[];
  /**
   * Ce qui décide si le conseil a encore un sens. `null` pour un conseil
   * purement informatif — « la recherche globale existe » ne correspond à
   * aucune donnée manquante. Ceux-là se retirent en étant suivis, pas en
   * devenant satisfaits.
   */
  sonde: NomSonde | null;
  /** Départage à famille égale. Plus haut passe devant. */
  poids: number;
  /**
   * Préfixes d'URL où le conseil passe devant — à famille égale seulement.
   * Sur l'écran des classes, le conseil sur les emplois du temps est plus
   * utile que les autres ; il ne devient pas pour autant prioritaire sur un
   * conseil de fondation.
   */
  contexte?: string[];
  /**
   * Le conseil mène à une écriture. Une école en lecture seule (abonnement
   * échu, suspension) ne le reçoit pas : elle se heurterait à un refus.
   */
  exigeEcriture?: boolean;
  /**
   * Date d'apparition de la fonctionnalité, en ISO. Un compte créé **avant**
   * cette date la découvre, et le conseil est annoncé comme une nouveauté ;
   * un compte créé après le reçoit dans le flux ordinaire — pour lui, la
   * fonctionnalité a toujours existé.
   */
  nouveaute?: string;
}

const ADMIN: Role[] = ['DIRECTEUR', 'SECRETAIRE'];
const FINANCE: Role[] = ['SECRETAIRE', 'COMPTABLE'];

export const CATALOGUE: Conseil[] = [
  // ------------------------------------------------------------ FONDATION --
  {
    id: 'annee-scolaire',
    titre: 'Ouvrez votre année scolaire',
    texte:
      "Classes, notes et factures s'y rattachent. Tant qu'aucune année n'est active, la plateforme ne peut rien enregistrer.",
    action: { label: "Ouvrir l'année", href: '/etablissement/annees-scolaires' },
    roles: ['DIRECTEUR'],
    famille: 'FONDATION',
    prerequis: [],
    sonde: 'anneeActive',
    poids: 100,
    exigeEcriture: true,
  },
  {
    id: 'classes',
    titre: 'Créez vos classes',
    texte:
      "Les classes portent les élèves, les notes et les emplois du temps. C'est la première chose à poser après l'année.",
    action: { label: 'Créer les classes', href: '/etablissement/classes' },
    roles: ADMIN,
    famille: 'FONDATION',
    prerequis: ['annee-scolaire'],
    sonde: 'classes',
    poids: 90,
    exigeEcriture: true,
  },
  {
    id: 'programme',
    titre: 'Indiquez les matières de chaque niveau',
    texte:
      "Le programme dit ce qui est enseigné à chaque niveau. Sans lui, aucun bulletin ne peut être composé.",
    action: { label: 'Définir le programme', href: '/etablissement/programme' },
    roles: ADMIN,
    famille: 'FONDATION',
    prerequis: ['classes'],
    sonde: 'programme',
    poids: 80,
    exigeEcriture: true,
  },
  {
    id: 'coefficients',
    titre: 'Fixez vos coefficients',
    texte:
      "Ils pondèrent le calcul des moyennes. Au lycée, chaque série a sa propre colonne : une matière à 0 sort de la moyenne de cette série.",
    action: { label: 'Régler les coefficients', href: '/etablissement/programme/coefficients' },
    roles: ADMIN,
    famille: 'FONDATION',
    prerequis: ['programme'],
    sonde: 'coefficients',
    poids: 70,
    exigeEcriture: true,
  },
  {
    id: 'eleves',
    titre: 'Inscrivez vos élèves',
    texte: 'Une classe sans élève ne produit ni bulletin ni facture.',
    action: { label: 'Ajouter un élève', href: '/etablissement/eleves' },
    roles: ADMIN,
    famille: 'FONDATION',
    prerequis: ['classes'],
    sonde: 'eleves',
    poids: 60,
    exigeEcriture: true,
  },

  // --------------------------------------------------------- EXPLOITATION --
  {
    id: 'import-eleves',
    titre: 'Vos élèves sont déjà dans un tableur ?',
    texte:
      "Déposez votre fichier : la plateforme l'analyse, vous montre ce qui passe et ce qui bloque, puis n'écrit que sur votre confirmation.",
    action: { label: 'Importer une liste', href: '/etablissement/eleves/import' },
    roles: ADMIN,
    famille: 'DECOUVERTE',
    prerequis: ['classes'],
    sonde: null,
    poids: 65,
    contexte: ['/etablissement/eleves'],
    exigeEcriture: true,
  },
  {
    id: 'enseignants',
    titre: 'Ajoutez vos enseignants',
    texte:
      'Chaque enseignant reçoit une invitation par email et saisit ensuite ses notes lui-même.',
    action: { label: 'Ajouter un enseignant', href: '/etablissement/enseignants' },
    roles: ADMIN,
    famille: 'EXPLOITATION',
    prerequis: ['classes'],
    sonde: 'enseignants',
    poids: 55,
    exigeEcriture: true,
  },
  {
    id: 'affectations',
    titre: 'Affectez vos enseignants aux matières',
    texte:
      "Un enseignant ne voit que les classes et les matières qui lui sont affectées : c'est ce qui ouvre sa saisie de notes.",
    action: { label: 'Gérer les affectations', href: '/etablissement/enseignants' },
    roles: ADMIN,
    famille: 'EXPLOITATION',
    prerequis: ['enseignants'],
    sonde: 'affectations',
    poids: 50,
    exigeEcriture: true,
  },
  {
    id: 'evaluations',
    titre: 'Créez vos premières évaluations',
    texte:
      'Devoirs, compositions et interrogations se déclarent par classe et par matière, puis reçoivent leurs notes.',
    action: { label: 'Ouvrir la saisie', href: '/etablissement/notes/saisie' },
    // La saisie est l'ecran de l'enseignant : `navigation.ts` ne l'ouvre qu'a
    // lui, et y envoyer un Directeur produirait un refus. Le Directeur voit la
    // suite de la chaine par le conseil « bulletins », dont la sonde depend des
    // memes donnees.
    roles: ['ENSEIGNANT'],
    famille: 'EXPLOITATION',
    prerequis: ['coefficients'],
    sonde: 'evaluations',
    poids: 45,
    exigeEcriture: true,
  },
  {
    id: 'emploi-du-temps',
    titre: 'Composez vos emplois du temps',
    texte:
      "Chaque classe a sa grille hebdomadaire, exportable en PDF. La plateforme refuse de placer un enseignant à deux endroits à la fois.",
    action: { label: 'Ouvrir une classe', href: '/etablissement/classes' },
    roles: ADMIN,
    famille: 'EXPLOITATION',
    prerequis: ['affectations'],
    sonde: 'creneaux',
    poids: 40,
    contexte: ['/etablissement/classes'],
    exigeEcriture: true,
  },
  {
    id: 'types-frais',
    titre: 'Déclarez vos frais de scolarité',
    texte:
      'Inscription, scolarité, cantine, transport : chaque type de frais devient une ligne sur les factures.',
    action: { label: 'Déclarer les frais', href: '/etablissement/finances/types-frais' },
    roles: FINANCE,
    famille: 'EXPLOITATION',
    prerequis: [],
    sonde: 'typesFrais',
    poids: 58,
    exigeEcriture: true,
  },
  {
    id: 'tarifs',
    titre: 'Fixez vos tarifs',
    texte:
      "Le montant se définit par niveau et s'applique à ses classes. Il est figé sur l'année : le changer plus tard ne réécrira pas les factures déjà émises.",
    action: { label: 'Régler les tarifs', href: '/etablissement/finances/tarifs' },
    roles: FINANCE,
    famille: 'EXPLOITATION',
    prerequis: ['types-frais'],
    sonde: 'tarifs',
    poids: 52,
    exigeEcriture: true,
  },
  {
    id: 'import-versements',
    titre: 'Vos versements peuvent être importés',
    texte:
      'Un relevé de caisse en tableur s’importe en une fois, avec le même contrôle en deux temps que les élèves.',
    action: { label: 'Importer des versements', href: '/etablissement/finances/import' },
    roles: FINANCE,
    famille: 'DECOUVERTE',
    prerequis: ['tarifs'],
    sonde: null,
    poids: 30,
    contexte: ['/etablissement/finances'],
    exigeEcriture: true,
  },
  {
    id: 'bulletins',
    titre: 'Éditez vos bulletins',
    texte:
      'Une fois les notes approuvées, les bulletins se génèrent pour toute une classe et se téléchargent en un dossier.',
    action: { label: 'Voir les bulletins', href: '/etablissement/notes/bulletins' },
    roles: ADMIN,
    famille: 'EXPLOITATION',
    prerequis: ['evaluations'],
    sonde: 'bulletins',
    poids: 35,
    exigeEcriture: true,
  },

  // ----------------------------------------------------------- COMPLETION --
  {
    id: 'emploi-du-temps-partiel',
    titre: 'Il manque des emplois du temps',
    texte:
      '{fait} classes sur {total} ont leur grille hebdomadaire. Il en reste {restant} à composer.',
    action: { label: 'Compléter', href: '/etablissement/classes' },
    roles: ADMIN,
    famille: 'COMPLETION',
    prerequis: ['emploi-du-temps'],
    sonde: 'classesAvecEmploiDuTemps',
    poids: 40,
    contexte: ['/etablissement/classes'],
    exigeEcriture: true,
  },
  {
    id: 'professeur-principal',
    titre: 'Des classes sont sans professeur principal',
    texte:
      "{fait} classes sur {total} en ont un. Il apparaît sur les bulletins et porte l'appréciation générale.",
    action: { label: 'Désigner', href: '/etablissement/classes' },
    roles: ADMIN,
    famille: 'COMPLETION',
    prerequis: ['enseignants'],
    sonde: 'classesAvecProfesseurPrincipal',
    poids: 35,
    contexte: ['/etablissement/classes'],
    exigeEcriture: true,
  },
  {
    id: 'eleves-sans-responsable',
    titre: 'Des élèves sont sans responsable légal',
    texte:
      "{restant} élèves n'ont aucun responsable enregistré. Sans lui, personne à qui remettre une facture ou signaler une absence.",
    action: { label: 'Compléter les fiches', href: '/etablissement/eleves' },
    roles: ADMIN,
    famille: 'COMPLETION',
    prerequis: ['eleves'],
    sonde: 'elevesAvecResponsable',
    poids: 30,
    contexte: ['/etablissement/eleves'],
    exigeEcriture: true,
  },
  {
    id: 'factures-impayees',
    titre: 'Des factures restent impayées',
    texte:
      "{restant} factures ne sont pas soldées. L'écran des factures les filtre par statut et par classe.",
    action: { label: 'Voir les impayés', href: '/etablissement/finances/factures' },
    roles: FINANCE,
    famille: 'COMPLETION',
    prerequis: ['tarifs'],
    sonde: 'facturesSoldees',
    poids: 25,
    contexte: ['/etablissement/finances'],
  },

  // -------------------------------------------------------------- CONFORT --
  {
    id: 'pin',
    titre: 'Choisissez votre code de confirmation',
    texte:
      'Un code à six chiffres, distinct de votre mot de passe, demandé avant les décisions définitives.',
    action: { label: 'Définir le code', href: '/profil' },
    roles: ['DIRECTEUR', 'SECRETAIRE'],
    famille: 'CONFORT',
    prerequis: [],
    sonde: 'pinDefini',
    poids: 60,
    exigeEcriture: true,
  },
  {
    id: 'equipe-administrative',
    titre: 'Invitez votre équipe',
    texte:
      "Secrétaire, comptable : chacun n'accède qu'à ce que son rôle autorise. Vous n'avez pas à tout faire vous-même.",
    action: { label: 'Inviter quelqu’un', href: '/utilisateurs/inviter' },
    roles: ['DIRECTEUR'],
    famille: 'CONFORT',
    prerequis: ['classes'],
    sonde: 'equipeAdministrative',
    poids: 50,
    exigeEcriture: true,
  },
  {
    id: 'logo-documents',
    titre: 'Posez votre logo sur vos documents',
    texte: 'Il apparaîtra en tête de vos bulletins et de vos reçus.',
    action: { label: 'Déposer le logo', href: '/etablissement/documents' },
    roles: ['DIRECTEUR'],
    famille: 'CONFORT',
    prerequis: ['bulletins'],
    sonde: 'logoDefini',
    poids: 40,
    exigeEcriture: true,
  },
  {
    id: 'filigrane',
    titre: 'Ajoutez un filigrane',
    texte:
      "Un texte répété en fond de chaque page de vos documents. C'est un élément d'identité, pas une protection.",
    action: { label: 'Régler le filigrane', href: '/etablissement/documents' },
    roles: ['DIRECTEUR'],
    famille: 'CONFORT',
    prerequis: ['logo-documents'],
    sonde: 'filigraneDefini',
    poids: 20,
    exigeEcriture: true,
  },
  {
    id: 'statistiques',
    titre: 'Vos résultats se lisent en un écran',
    texte:
      'Moyennes par classe, taux de réussite, distribution des niveaux : tout est agrégé depuis les notes déjà saisies.',
    action: { label: 'Voir les statistiques', href: '/statistiques' },
    roles: ADMIN,
    famille: 'DECOUVERTE',
    prerequis: ['evaluations'],
    sonde: null,
    poids: 30,
  },
  {
    id: 'recherche-globale',
    titre: 'Cherchez sans naviguer',
    texte:
      "La barre de recherche en haut de l'écran trouve un élève, une classe ou un enseignant depuis n'importe quelle page.",
    action: null,
    roles: ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT'],
    famille: 'DECOUVERTE',
    prerequis: ['eleves'],
    sonde: null,
    poids: 10,
  },
  {
    id: 'notes-hors-ligne',
    titre: 'Saisissez vos notes même sans réseau',
    texte:
      "Votre saisie est conservée sur l'appareil et repart d'elle-même dès que la connexion revient.",
    action: { label: 'Ouvrir la saisie', href: '/etablissement/notes/saisie' },
    roles: ['ENSEIGNANT'],
    famille: 'DECOUVERTE',
    prerequis: [],
    sonde: null,
    poids: 45,
  },
];

/** Index par identifiant, pour la résolution des prérequis. */
export const PAR_ID: Map<IdConseil, Conseil> = new Map(CATALOGUE.map((c) => [c.id, c]));
