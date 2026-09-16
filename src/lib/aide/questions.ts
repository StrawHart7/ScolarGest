import type { Role } from '@/services/tenant';

/**
 * Les questions fréquentes, et leurs réponses.
 *
 * ## Pourquoi un module, et pourquoi sans dépendance
 *
 * Les sept rubriques vivaient dans `page.tsx`. Le fichier a grandi jusqu'à ce
 * que la page ne soit plus lisible, et la recherche côté client — indispensable
 * dès qu'on dépasse la dizaine de questions — a besoin des données dans un
 * composant client. Un composant client qui importerait un service ferait
 * entrer `next/headers` dans le bundle (panne du 2026-09-02) : le vocabulaire
 * vit donc ici, sans rien importer d'autre qu'un type.
 *
 * ## Ce qu'une réponse doit être
 *
 * **Vraie aujourd'hui.** Deux des sept réponses d'origine étaient devenues
 * fausses sans que personne le voie : « les lignes d'une facture sont figées dès
 * le premier versement » — règle retirée le 2026-09-16 — et « la réponse du
 * support s'affichera sur cette page, visible par votre établissement » — une
 * demande ne se relit que par son auteur depuis `20260907221109`. Une aide
 * fausse est pire qu'une aide absente : elle est crue.
 *
 * Corollaire de méthode : **toute modification de comportement doit venir
 * relire ce fichier**, au même titre que `CLAUDE.md`. C'est pourquoi chaque
 * réponse qui découle d'une décision porte sa date entre parenthèses dans le
 * code source — pas à l'écran, où elle n'intéresse personne.
 *
 * **Elle dit pourquoi, pas seulement quoi.** « Vous ne pouvez pas » sans raison
 * se lit comme une panne. Une école qui comprend la règle cesse de la
 * contourner.
 *
 * **Elle nomme l'écran où agir.** Une réponse qui n'indique pas où aller
 * oblige à chercher, et c'était déjà la raison d'ouvrir l'aide.
 */

export type ThemeAide =
  | 'DEMARRAGE'
  | 'CLASSES'
  | 'ELEVES'
  | 'NOTES'
  | 'FINANCES'
  | 'COMPTES'
  | 'DOCUMENTS'
  | 'ABONNEMENT'
  | 'PROBLEMES';

export interface Theme {
  id: ThemeAide;
  titre: string;
  /** Une ligne, pour que l'on sache si la réponse est probablement là. */
  description: string;
  /** Nom d'icône de `lucide-react`, résolu par l'écran. */
  icone: string;
}

/**
 * L'ordre est celui du parcours d'une école : on configure, on remplit, on
 * note, on encaisse, puis on s'occupe des comptes et du reste. « Quand ça ne
 * marche pas » est en dernier — c'est là qu'on descend quand on n'a pas trouvé
 * plus haut.
 */
export const THEMES: Theme[] = [
  {
    id: 'DEMARRAGE',
    titre: 'Démarrage et configuration',
    description: 'Le parcours guidé, le code de confirmation, ce qu’il reste à régler.',
    icone: 'Rocket',
  },
  {
    id: 'CLASSES',
    titre: 'Classes et structure',
    description: 'Cycles, niveaux, séries, noms et capacités des classes.',
    icone: 'School',
  },
  {
    id: 'ELEVES',
    titre: 'Élèves et inscriptions',
    description: 'Inscrire, changer de classe, importer, retrouver un dossier.',
    icone: 'Users',
  },
  {
    id: 'NOTES',
    titre: 'Notes et bulletins',
    description: 'Saisie, validation, moyennes, périodes, édition des bulletins.',
    icone: 'GraduationCap',
  },
  {
    id: 'FINANCES',
    titre: 'Frais, factures et versements',
    description: 'Tarifs, encaissements, reçus, suivi du recouvrement.',
    icone: 'Wallet',
  },
  {
    id: 'COMPTES',
    titre: 'Comptes et sécurité',
    description: 'Inviter, retirer un accès, mots de passe, qui voit quoi.',
    icone: 'ShieldCheck',
  },
  {
    id: 'DOCUMENTS',
    titre: 'Documents et identité',
    description: 'Logo, filigrane, numérotation, téléchargements.',
    icone: 'FileText',
  },
  {
    id: 'ABONNEMENT',
    titre: 'Abonnement',
    description: 'Échéances, lecture seule, renouvellement, vos données.',
    icone: 'CreditCard',
  },
  {
    id: 'PROBLEMES',
    titre: 'Quand ça ne marche pas',
    description: 'Erreurs, lenteurs, coupures de réseau, session fermée.',
    icone: 'LifeBuoy',
  },
];

export interface Question {
  /** Stable : il sert d'ancre dans l'adresse, et ne se renomme pas. */
  id: string;
  theme: ThemeAide;
  question: string;
  /** Un ou plusieurs paragraphes. Le premier répond, les suivants expliquent. */
  reponse: string[];
  roles: Role[];
  /** Où faire la chose dont on parle. */
  lien?: { label: string; href: string };
  /**
   * Mots que l'utilisateur taperait, et qui ne figurent pas dans le texte.
   * La recherche porte déjà sur la question et la réponse ; ceci rattrape le
   * vocabulaire de l'école quand il diffère du nôtre — « écolage » pour
   * « scolarité », « bordereau » pour « reçu ».
   */
  motsCles?: string[];
}

const TOUS: Role[] = ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT'];
const DIRECTION: Role[] = ['DIRECTEUR', 'SECRETAIRE'];
const FINANCE: Role[] = ['DIRECTEUR', 'COMPTABLE', 'SECRETAIRE'];

export const QUESTIONS: Question[] = [
  // ------------------------------------------------------ démarrage --
  {
    id: 'pin-role',
    theme: 'DEMARRAGE',
    question: 'À quoi sert le code de confirmation (PIN) ?',
    reponse: [
      'Il vous est demandé avant les décisions qu’on ne peut pas défaire. Aujourd’hui : activer ou clôturer une année scolaire, activer un cycle, valider ou rejeter des notes, modifier un emploi du temps, et réinitialiser le mot de passe d’un collègue.',
      'C’est une seconde barrière, distincte de votre mot de passe : il protège l’accès à votre compte, le code protège l’acte. Quelqu’un qui trouverait votre session ouverte ne pourrait toujours pas valider des notes.',
      'Tant qu’il n’est pas défini, ces actions restent bloquées et le message vous le dit.',
    ],
    roles: DIRECTION,
    lien: { label: 'Définir mon code', href: '/profil' },
    motsCles: ['code secret', 'six chiffres', 'mot de passe deuxième'],
  },
  {
    id: 'demarrage-reprendre',
    theme: 'DEMARRAGE',
    question: 'J’ai interrompu le parcours de démarrage. Puis-je le reprendre ?',
    reponse: [
      'Oui, et vous ne perdez rien. Chaque étape écrit en base au moment où vous la validez : ce qui est fait est fait, même si vous fermez la fenêtre au milieu.',
      'Le parcours reprend là où il s’était arrêté, parce qu’il déduit votre avancement de vos données plutôt que de le retenir quelque part.',
    ],
    roles: ['DIRECTEUR'],
    lien: { label: 'Reprendre le démarrage', href: '/demarrage' },
    motsCles: ['onboarding', 'assistant', 'questionnaire'],
  },
  {
    id: 'demarrage-retour',
    theme: 'DEMARRAGE',
    question: 'Pourquoi n’y a-t-il pas de bouton « Retour » dans le parcours ?',
    reponse: [
      'Parce qu’il mentirait. Chaque étape est écrite au moment où vous la validez, et certaines sont définitives — l’activation d’un cycle en particulier.',
      'Le rail de gauche montre ce qui a été fait ; il ne le défait pas. Ce qui se corrige après coup se corrige depuis les écrans habituels de l’établissement.',
    ],
    roles: ['DIRECTEUR'],
  },
  {
    id: 'configuration-reste',
    theme: 'DEMARRAGE',
    question: 'Où voir ce qu’il me reste à configurer ?',
    reponse: [
      'La page Configuration, dans la section Établissement, liste tout : ce qui est indispensable pour facturer et éditer des bulletins, et ce qui est seulement recommandé.',
      'Chaque ligne mène à l’écran qui la règle et y revient. Une fois tout coché, la page change de rôle : elle devient l’endroit où les nouvelles fonctionnalités vous sont présentées.',
    ],
    // L'écran de configuration est réservé au Directeur — vérifié contre
    // `cheminAutorise`, qui a refusé la Secrétaire au premier passage du test.
    roles: ['DIRECTEUR'],
    lien: { label: 'Voir la configuration', href: '/etablissement/configuration' },
    motsCles: ['checklist', 'à faire', 'liste'],
  },
  {
    id: 'cycle-definitif',
    theme: 'DEMARRAGE',
    question: 'J’ai activé un cycle par erreur. Comment le retirer ?',
    reponse: [
      'On ne peut pas, et c’est délibéré. Un cycle activé devient le socle de niveaux, de classes, de programmes et de coefficients ; le retirer laisserait tout cela suspendu dans le vide.',
      'Un cycle activé mais inutilisé ne coûte rien et ne gêne rien : aucune classe dessus, il ne paraît nulle part. C’est pour cette raison que l’activation demande votre code de confirmation.',
    ],
    roles: ['DIRECTEUR'],
  },

  // -------------------------------------------------------- classes --
  {
    id: 'ordre-classes',
    theme: 'CLASSES',
    question: 'Dans quel ordre les classes apparaissent-elles ?',
    reponse: [
      'Dans l’ordre de la scolarité : 6ème d’abord, Terminale en dernier, le collège avant le lycée. C’est vrai dans les listes comme dans les menus de choix et dans les exports.',
      'Les divisions d’un même niveau se suivent ensuite par leur nom — 6ème A puis 6ème B, Tle D1 puis Tle D2 puis Tle D10.',
    ],
    roles: TOUS,
    motsCles: ['tri', 'ranger', 'alphabétique', 'classement'],
  },
  {
    id: 'nom-classe',
    theme: 'CLASSES',
    question: 'Pourquoi je ne choisis pas le nom de mes classes ?',
    reponse: [
      'Le nom se compose tout seul à partir du niveau et, au lycée, de la série : « 6ème A », « Tle D1 ». Vous n’avez qu’à dire combien de classes vous ouvrez par niveau.',
      'La saisie libre produisait des noms incohérents dans une même école — « 6e A », « 6ème-A », « 6EME A » — que rien ne rattrapait ensuite dans les bulletins ni dans les exports.',
      'Une classe seule ne porte pas d’indice : si vous n’avez qu’une sixième, elle s’appelle « 6ème », pas « 6ème A ».',
    ],
    roles: DIRECTION,
    motsCles: ['renommer', 'intitulé', 'libellé'],
  },
  {
    id: 'capacite-classe',
    theme: 'CLASSES',
    question: 'Comment fixer le nombre maximum d’élèves par classe ?',
    reponse: [
      'Le parcours de démarrage vous demande la taille moyenne d’une classe et l’applique à toutes celles qu’il crée. Ensuite, chaque fiche de classe porte un champ « Capacité » que vous pouvez poser, changer ou effacer à tout moment.',
      'La capacité n’empêche aucune inscription : elle sert à signaler les classes qui débordent et à montrer où il reste de la place.',
    ],
    roles: ['DIRECTEUR'],
    lien: { label: 'Mes classes', href: '/etablissement/classes' },
    motsCles: ['effectif maximum', 'plafond', 'places'],
  },
  {
    id: 'serie-lycee',
    theme: 'CLASSES',
    question: 'Pourquoi les séries ne sont-elles proposées qu’au lycée ?',
    reponse: [
      'Parce que le collège n’en a pas : un élève de 5ème suit le même programme que tous les autres élèves de 5ème. Au lycée, la série change les matières et les coefficients — c’est précisément ce qui la définit.',
      'C’est aussi pourquoi le programme se décide par filière et non par niveau : la Seconde A4, la Seconde C et la Seconde D n’enseignent pas la même chose.',
    ],
    roles: DIRECTION,
    motsCles: ['filière', 'A4', 'série D', 'option'],
  },

  // --------------------------------------------------------- élèves --
  {
    id: 'changer-classe',
    theme: 'ELEVES',
    question: 'Je me suis trompé de classe en inscrivant un élève. Comment corriger ?',
    reponse: [
      'Depuis la fiche de l’élève, le bouton « Changer de classe ». Il fait tout en une fois : l’élève change de classe, son ancienne facture est annulée, une nouvelle est émise aux tarifs de la classe d’arrivée, et les versements déjà encaissés y sont reportés.',
      'Cela fonctionne aussi si vous aviez annulé l’inscription : elle est réactivée.',
      'Si la nouvelle classe coûte moins cher que ce qui a déjà été versé, l’écart vous est indiqué — la famille a payé d’avance, c’est à vous de décider quoi en faire.',
    ],
    roles: DIRECTION,
    lien: { label: 'Mes élèves', href: '/etablissement/eleves' },
    motsCles: ['erreur inscription', 'muter', 'transférer', 'déplacer élève'],
  },
  {
    id: 'supprimer-eleve',
    theme: 'ELEVES',
    question: 'Puis-je supprimer un élève ?',
    reponse: [
      'Non, et aucune donnée scolaire ou financière ne se supprime dans ScolarGest. Un élève parti change de statut ; son dossier, ses notes et ses factures restent consultables.',
      'C’est ce qui permet de rééditer un bulletin ou de retrouver un versement trois ans plus tard. Une suppression rendrait l’historique faux sans prévenir personne.',
    ],
    roles: DIRECTION,
    motsCles: ['effacer', 'retirer', 'radier', 'départ'],
  },
  {
    id: 'import-eleves',
    theme: 'ELEVES',
    question: 'Comment importer ma liste d’élèves depuis un tableur ?',
    reponse: [
      'L’écran d’import vous donne le modèle à remplir, puis se fait en deux temps : vous déposez le fichier, la plateforme vous montre ce qu’elle a compris, et rien n’est écrit tant que vous n’avez pas confirmé.',
      'Les doublons sont reconnus sur le nom, les prénoms et la date de naissance : redéposer le même fichier ne recrée pas les élèves. Les lignes refusées vous sont listées avec leur motif.',
    ],
    roles: DIRECTION,
    lien: { label: 'Importer des élèves', href: '/etablissement/eleves/import' },
    motsCles: ['excel', 'csv', 'fichier', 'liste', 'tableur'],
  },
  {
    id: 'recherche-globale',
    theme: 'ELEVES',
    question: 'Comment retrouver rapidement un élève ?',
    reponse: [
      'La barre de recherche en haut de l’écran, ou le raccourci Ctrl + K. Elle cherche parmi les élèves, les classes et les enseignants de votre établissement, sans quitter la page où vous êtes.',
    ],
    roles: TOUS,
    motsCles: ['chercher', 'trouver', 'raccourci'],
  },
  {
    id: 'responsables',
    theme: 'ELEVES',
    question: 'Un élève peut-il avoir plusieurs responsables ?',
    reponse: [
      'Oui. La fiche de l’élève accepte plusieurs responsables légaux, avec leur lien de parenté et leurs coordonnées. C’est utile quand la scolarité est réglée par une personne et le suivi assuré par une autre.',
    ],
    roles: DIRECTION,
    motsCles: ['parent', 'tuteur', 'père', 'mère', 'contact'],
  },

  // ---------------------------------------------------------- notes --
  {
    id: 'notes-soumission',
    theme: 'NOTES',
    question: 'J’ai soumis mes notes. Que se passe-t-il ensuite ?',
    reponse: [
      'Elles partent en file de validation. La direction ou le secrétariat les valide — ou les rejette avec un motif — en confirmant par son code.',
      'Tant qu’une note n’est pas validée, elle n’entre ni dans les moyennes, ni dans les classements, ni dans les bulletins.',
    ],
    roles: ['ENSEIGNANT'],
    motsCles: ['rendre', 'envoyer', 'validation', 'approbation'],
  },
  {
    id: 'notes-brouillon',
    theme: 'NOTES',
    question: 'Une note en brouillon compte-t-elle dans la moyenne ?',
    reponse: [
      'Non. Une note en brouillon est ignorée par les moyennes, les classements et les bulletins, exactement comme une note absente. Elle n’existe que pour vous, le temps de finir votre saisie.',
    ],
    roles: TOUS,
  },
  {
    id: 'notes-classes-absentes',
    theme: 'NOTES',
    question: 'Je ne vois pas toutes mes classes dans la saisie des notes.',
    reponse: [
      'Vous ne voyez que les couples classe-matière sur lesquels vous êtes affecté. C’est une barrière réelle, pas un filtre d’affichage : elle vous empêche aussi d’écrire ailleurs.',
      'S’il manque une classe, c’est l’affectation qui manque. La direction la pose depuis la fiche de la classe.',
    ],
    roles: ['ENSEIGNANT'],
    motsCles: ['manquante', 'affectation', 'matière absente'],
  },
  {
    id: 'trimestre-semestre',
    theme: 'NOTES',
    question: 'Trimestres ou semestres ?',
    reponse: [
      'Le collège est au trimestre, toujours — c’est le régime national et il ne se règle pas.',
      'Le lycée choisit : trimestres ou semestres. Le réglage se trouve dans les paramètres de l’établissement, et il ne vous est proposé que si vous avez un lycée.',
      'Dans un complexe, les deux cohabitent sans se gêner : chaque bulletin nomme sa période d’après le cycle de la classe.',
    ],
    roles: TOUS,
    motsCles: ['période', 'découpage', 'semestriel', 'trimestriel'],
  },
  {
    id: 'matiere-absente-bulletin',
    theme: 'NOTES',
    question: 'Une matière n’apparaît pas sur le bulletin.',
    reponse: [
      'Une matière sans coefficient pour cette classe n’entre pas dans la moyenne, et au lycée elle est retirée du bulletin : c’est ainsi qu’une matière propre à la série A4 ne figure pas sur un bulletin de série C.',
      'Au collège, en revanche, une matière sans coefficient est le signe d’une configuration inachevée : elle reste visible pour que vous la remarquiez.',
      'Les coefficients se règlent dans le programme, par niveau et par série.',
    ],
    roles: DIRECTION,
    lien: { label: 'Programme et coefficients', href: '/etablissement/programme' },
    motsCles: ['coefficient', 'manquante', 'disparue'],
  },
  {
    id: 'regenerer-bulletin',
    theme: 'NOTES',
    question: 'Je régénère un bulletin. L’ancien est-il perdu ?',
    reponse: [
      'Non. L’ancien est marqué comme périmé, il n’est pas supprimé, et son fichier reste en stockage.',
      'Un seul bulletin fait foi par élève et par période : c’est le dernier édité. Les écrans et les téléchargements groupés ne sortent que celui-là.',
    ],
    roles: DIRECTION,
    motsCles: ['réimprimer', 'refaire', 'doublon bulletin'],
  },
  {
    id: 'notes-hors-ligne',
    theme: 'NOTES',
    question: 'Puis-je saisir des notes sans réseau ?',
    reponse: [
      'Oui. Votre saisie est conservée sur l’appareil et repart toute seule au retour du réseau. Une coupure de courant ou de connexion ne vous fait pas perdre votre travail.',
      'Attention à un point : ces brouillons sont effacés à la déconnexion, pour qu’un poste partagé ne laisse pas votre saisie au suivant. L’application vous avertit du nombre de lignes en attente avant de vous déconnecter.',
    ],
    roles: ['ENSEIGNANT', 'DIRECTEUR'],
    motsCles: ['coupure', 'internet', 'offline', 'panne réseau', 'délestage'],
  },

  // ------------------------------------------------------- finances --
  {
    id: 'tarif-fige',
    theme: 'FINANCES',
    question: 'Pourquoi ne puis-je pas modifier un tarif déjà appliqué ?',
    reponse: [
      'Les tarifs sont rattachés à une année scolaire et ne changent pas rétroactivement : une facture déjà émise doit rester conforme à ce qui a été annoncé à la famille.',
      'Pour changer un montant, posez un nouveau tarif sur la nouvelle année. Pour un cas particulier — remise, enfant du personnel — modifiez les lignes de la facture concernée.',
    ],
    roles: FINANCE,
    lien: { label: 'Les tarifs', href: '/etablissement/finances/tarifs' },
    motsCles: ['prix', 'écolage', 'scolarité', 'montant'],
  },
  {
    id: 'lignes-facture',
    theme: 'FINANCES',
    question: 'Puis-je modifier une facture après un versement ?',
    reponse: [
      'Oui, à tout moment, tant que la facture n’est pas annulée. Une famille qui prend la cantine en janvier ou le transport au deuxième trimestre n’a pas à voir sa facture annulée pour autant.',
      'Le total et le solde se recalculent aussitôt ; les versements déjà encaissés ne bougent pas.',
      'Si le nouveau total passe sous ce qui a déjà été payé, l’écran vous le dit avant que vous n’enregistriez. L’écriture reste possible — le remboursement est votre décision, pas celle de la plateforme.',
    ],
    roles: FINANCE,
    motsCles: ['ajouter une ligne', 'cantine', 'transport', 'remise', 'corriger facture'],
  },
  {
    id: 'facture-annulee-total',
    theme: 'FINANCES',
    question: 'Une facture annulée compte-t-elle dans le total dû ?',
    reponse: [
      'Non. Une facture annulée sort du total dû et du reste à recouvrer : elle ne se réclame plus à personne.',
      'Elle reste affichée dans la liste, marquée « Annulé », parce qu’elle a existé et qu’un reçu remis à la famille la mentionne peut-être.',
      'Les versements qui avaient été encaissés dessus, eux, restent comptés dans l’encaissé : l’argent a bien été reçu. C’est d’ailleurs le seul moyen de voir qu’un remboursement est dû.',
    ],
    roles: FINANCE,
    motsCles: ['annulation', 'total faux', 'reste à recouvrer', 'recouvrement'],
  },
  {
    id: 'annuler-versement',
    theme: 'FINANCES',
    question: 'Comment corriger un versement saisi par erreur ?',
    reponse: [
      'Depuis la facture, « Annuler le versement », avec un motif. Le versement n’est pas effacé : il passe en annulé, cesse de compter dans l’encaissé, et le solde de la facture se recalcule.',
      'La trace reste, parce qu’une caisse dont les erreurs disparaissent n’est plus vérifiable.',
    ],
    roles: FINANCE,
    motsCles: ['erreur de saisie', 'supprimer paiement', 'rembourser'],
  },
  {
    id: 'recu',
    theme: 'FINANCES',
    question: 'Où trouver le reçu d’un versement ?',
    reponse: [
      'Sur la facture, en face du versement : « Générer le reçu ». Il porte un numéro unique, le logo et le filigrane de votre établissement si vous les avez posés.',
      'Un reçu déjà édité reste valable même si la facture est ensuite annulée ou modifiée : il prouve qu’un versement a été reçu, et cela ne change pas.',
    ],
    roles: FINANCE,
    motsCles: ['quittance', 'bordereau', 'justificatif', 'pdf'],
  },
  {
    id: 'qui-encaisse',
    theme: 'FINANCES',
    question: 'Qui peut encaisser un versement ?',
    reponse: [
      'La direction, le secrétariat et la comptabilité. L’enseignant n’a aucun accès aux finances, et cette barrière est posée dans la base elle-même, pas seulement dans l’affichage.',
    ],
    roles: FINANCE,
    motsCles: ['droits', 'caisse', 'rôle'],
  },
  {
    id: 'suivi-recouvrement',
    theme: 'FINANCES',
    question: 'Comment savoir qui n’a pas payé ?',
    reponse: [
      'Le suivi des paiements donne une ligne par élève : total dû, déjà encaissé, reste à recouvrer, avec le statut. Vous pouvez filtrer par classe et par statut.',
      'Les totaux affichés portent sur ce qui est à l’écran, filtres compris — c’est écrit au-dessus. Ils disparaissent pendant une recherche, parce qu’un total qui ne correspond pas aux lignes affichées ment.',
    ],
    roles: FINANCE,
    lien: { label: 'Suivi des paiements', href: '/etablissement/finances/factures' },
    motsCles: ['impayés', 'relance', 'créances', 'arriérés'],
  },

  // -------------------------------------------------------- comptes --
  {
    id: 'inviter',
    theme: 'COMPTES',
    question: 'Comment donner un accès à un collègue ?',
    reponse: [
      'Depuis l’écran Utilisateurs. Deux façons : par email, la personne reçoit une invitation et choisit son mot de passe ; ou par identifiant, quand elle n’a pas d’adresse — vous lui remettez alors un mot de passe provisoire qu’elle devra changer à sa première connexion.',
      'La seconde existe parce qu’exiger une adresse email écartait des secrétaires et des enseignants qui n’en ont pas.',
    ],
    roles: ['DIRECTEUR'],
    lien: { label: 'Les utilisateurs', href: '/utilisateurs' },
    motsCles: ['ajouter compte', 'inviter', 'nouveau collègue', 'sans email'],
  },
  {
    id: 'desactiver',
    theme: 'COMPTES',
    question: 'J’ai désactivé quelqu’un. A-t-il encore accès ?',
    reponse: [
      'Sa connexion est fermée immédiatement : il ne peut plus entrer, ni renouveler son accès.',
      'Une réserve honnête : si la personne est connectée au moment où vous la désactivez, sa session en cours peut rester valable jusqu’à une heure. Pour une urgence réelle — un vol d’appareil — écrivez au support, qui peut couper sans attendre.',
      'La désactivation est réversible : le compte se réactive, avec son historique.',
    ],
    roles: ['DIRECTEUR'],
    lien: { label: 'Les utilisateurs', href: '/utilisateurs' },
    motsCles: ['licencier', 'départ', 'retirer accès', 'bloquer'],
  },
  {
    id: 'mot-de-passe-oublie',
    theme: 'COMPTES',
    question: 'Quelqu’un a oublié son mot de passe.',
    reponse: [
      'S’il a une adresse email, il utilise « Mot de passe oublié » sur l’écran de connexion.',
      'Sinon, la direction le réinitialise depuis la fiche de l’utilisateur, en confirmant par son code. Un mot de passe provisoire est affiché une seule fois : notez-le avant de fermer, il ne sera pas réaffiché.',
    ],
    roles: ['DIRECTEUR', 'SECRETAIRE'],
    motsCles: ['perdu', 'réinitialiser', 'nouveau mot de passe'],
  },
  {
    id: 'qui-voit-quoi',
    theme: 'COMPTES',
    question: 'Qui voit quoi dans l’application ?',
    reponse: [
      'La direction voit tout son établissement. Le secrétariat gère les élèves, les inscriptions, les notes et l’encaissement. La comptabilité voit les finances. L’enseignant voit ses classes affectées et rien d’autre.',
      'Deux établissements ne se voient jamais, en aucune circonstance : la séparation est posée dans la base, pas dans les écrans.',
    ],
    roles: TOUS,
    motsCles: ['rôles', 'permissions', 'droits', 'confidentialité'],
  },

  // ------------------------------------------------------ documents --
  {
    id: 'logo-filigrane',
    theme: 'DOCUMENTS',
    question: 'Comment mettre mon logo sur les bulletins et les reçus ?',
    reponse: [
      'Dans Établissement, écran Documents. Vous y déposez votre logo et vous pouvez activer un filigrane portant le texte de votre choix.',
      'Les deux apparaissent sur les bulletins et les reçus, le filigrane sur toutes les pages.',
    ],
    roles: ['DIRECTEUR'],
    lien: { label: 'Documents', href: '/etablissement/documents' },
    motsCles: ['en-tête', 'papier à en-tête', 'tampon', 'identité'],
  },
  {
    id: 'filigrane-protection',
    theme: 'DOCUMENTS',
    question: 'Le filigrane empêche-t-il qu’on copie mes bulletins ?',
    reponse: [
      'Non, et il ne faut pas compter dessus. Un filigrane se recopie ; c’est un élément d’identité visuelle, pas une sécurité.',
      'Ce qui authentifie un document, aujourd’hui, c’est son numéro unique et le fait que vous puissiez le retrouver dans la plateforme.',
    ],
    roles: DIRECTION,
    motsCles: ['sécurité', 'faux', 'copie', 'authenticité'],
  },

  // ----------------------------------------------------- abonnement --
  {
    id: 'expiration',
    theme: 'ABONNEMENT',
    question: 'Que se passe-t-il quand mon abonnement expire ?',
    reponse: [
      'L’application passe en lecture seule. Vous gardez l’accès à toutes vos données, à vos bulletins et à vos exports ; seules les écritures sont suspendues.',
      'Vos données ne sont jamais retenues, et rien n’est supprimé. Le renouvellement rouvre l’écriture immédiatement.',
      'Vous êtes prévenu avant l’échéance, pas le jour même.',
    ],
    roles: ['DIRECTEUR', 'COMPTABLE'],
    lien: { label: 'Mon abonnement', href: '/abonnement' },
    motsCles: ['échéance', 'renouveler', 'payer', 'bloqué', 'lecture seule'],
  },
  {
    id: 'suspension',
    theme: 'ABONNEMENT',
    question: 'Mon établissement est suspendu et je ne sais pas pourquoi.',
    reponse: [
      'Une suspension est toujours accompagnée d’un motif, affiché sur la page Abonnement. Une école coupée sans explication ne pourrait même pas dire au support de quoi elle parle.',
    ],
    // Le Directeur et le Comptable, et eux seuls : `/abonnement` ne figure dans
    // la navigation que pour ces deux rôles — vérifié contre `cheminAutorise`,
    // qui a refusé la Secrétaire. Le point est signalé à l'utilisateur : elle
    // subit la lecture seule sans avoir de chemin vers le motif.
    roles: ['DIRECTEUR', 'COMPTABLE'],
    lien: { label: 'Mon abonnement', href: '/abonnement' },
  },

  // ------------------------------------------------------ problèmes --
  {
    id: 'session-fermee',
    theme: 'PROBLEMES',
    question: 'On me dit que ma session ne correspond plus à aucun établissement.',
    reponse: [
      'Votre session a survécu à ce qu’elle désignait — un compte ou un établissement qui n’existe plus. Elle est fermée automatiquement et vous êtes ramené à l’écran de connexion : reconnectez-vous, c’est tout.',
      'Si l’écran tourne en rond, ouvrez le site dans une fenêtre de navigation privée, ou effacez les données du site depuis le cadenas à gauche de l’adresse.',
    ],
    roles: TOUS,
    motsCles: ['déconnecté', 'boucle', 'impossible de se connecter', 'erreur connexion'],
  },
  {
    id: 'erreur-reference',
    theme: 'PROBLEMES',
    question: 'Une page affiche « Une erreur est survenue » avec une référence.',
    reponse: [
      'Appuyez d’abord sur « Réessayer » : une bonne partie de ces erreurs sont des à-coups de réseau qui passent au second essai.',
      'Si elle revient, utilisez « Signaler au support » sur la page d’erreur. La référence et le contexte partent avec le message — c’est ce qui nous permet de retrouver l’incident dans les journaux sans vous demander de le décrire.',
    ],
    roles: TOUS,
    lien: { label: 'Contacter le support', href: '/profil/support' },
    motsCles: ['bug', 'plantage', 'page blanche', 'référence'],
  },
  {
    id: 'lenteur',
    theme: 'PROBLEMES',
    question: 'L’application est lente.',
    reponse: [
      'Vérifiez d’abord votre connexion : la plateforme reste utilisable sur un réseau faible, mais les premiers chargements y sont plus longs.',
      'Si la lenteur est générale et ne vient pas de votre réseau, signalez-le au support avec l’heure approximative. C’est mesurable de notre côté, et c’est souvent réparable.',
    ],
    roles: TOUS,
    lien: { label: 'Contacter le support', href: '/profil/support' },
    motsCles: ['rame', 'long', 'chargement', 'attente'],
  },
  {
    id: 'coupure-courant',
    theme: 'PROBLEMES',
    question: 'Que se passe-t-il si le courant ou le réseau coupe en pleine saisie ?',
    reponse: [
      'Les pages déjà consultées restent consultables hors ligne, et la saisie de notes est conservée sur l’appareil pour repartir au retour du réseau.',
      'Les encaissements sont traités différemment, et volontairement : un versement mis en attente porte un libellé qui le dit, et il ne sera enregistré qu’une seule fois même si l’envoi est rejoué. Un encaissement compté deux fois se découvrirait au recouvrement.',
    ],
    roles: TOUS,
    motsCles: ['délestage', 'panne', 'électricité', 'hors ligne'],
  },
  {
    id: 'support-reponse',
    theme: 'PROBLEMES',
    question: 'J’ai écrit au support. Où verrai-je la réponse ?',
    reponse: [
      'Sur la page Support, dans votre profil. Vos demandes n’y sont visibles que par vous : ni vos collègues ni les autres comptes de l’établissement n’y ont accès, y compris aux pièces jointes.',
      'C’est délibéré — une demande raconte souvent un blocage personnel, et la savoir lisible par toute l’école dissuaderait d’écrire.',
    ],
    roles: TOUS,
    lien: { label: 'Mes demandes', href: '/profil/support' },
    motsCles: ['ticket', 'réclamation', 'assistance', 'contacter'],
  },
];

/** Les questions ouvertes à un rôle, dans l'ordre du catalogue. */
export function questionsPourRole(role: Role): Question[] {
  return QUESTIONS.filter((q) => q.roles.includes(role));
}

/**
 * Filtre de recherche. Porte sur la question, la réponse **et** les mots-clés :
 * une école qui tape « écolage » doit tomber sur les tarifs, même si le mot
 * n'est écrit nulle part dans la réponse.
 *
 * Les accents sont retirés des deux côtés — on ne va pas demander à quelqu'un
 * de taper « périmé » avec son accent pour trouver sa réponse.
 */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function correspond(question: Question, terme: string): boolean {
  const cible = normaliser(terme).trim();
  if (!cible) return true;
  const grain = normaliser(
    [question.question, ...question.reponse, ...(question.motsCles ?? [])].join(' '),
  );
  // Tous les mots saisis doivent apparaître : « facture annulée » ne doit pas
  // ramener toutes les questions qui parlent de facture.
  return cible.split(/\s+/).every((mot) => grain.includes(mot));
}
