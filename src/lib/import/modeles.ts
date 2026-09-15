import { ELEVE_IMPORT_COLUMNS } from './eleve-import-schema';
import { ENSEIGNANT_IMPORT_COLUMNS } from './enseignant-import-schema';
import { PAIEMENT_IMPORT_COLUMNS } from './paiement-import-schema';

/**
 * Le modèle de fichier, et ce qu'il faut savoir pour le remplir.
 *
 * ## Pourquoi un modèle téléchargeable
 *
 * L'écran d'import affichait ses quinze en-têtes en une ligne de code, à
 * recopier à la main dans un tableur. C'est la source du seul échec qui arrête
 * tout : une colonne mal orthographiée et le fichier entier est illisible.
 * Donner le fichier déjà en-tête supprime la classe d'erreur au lieu de mieux
 * la signaler.
 *
 * ## Ce module ne dépend de rien
 *
 * Il est lu par le composant client qui décrit les colonnes, et par la route
 * serveur qui fabrique le classeur. Importer un service ici ferait entrer
 * `next/headers` dans un bundle client — la panne du 2026-09-02.
 *
 * ## L'exemple est une ligne réelle, pas un gabarit vide
 *
 * Un fichier sans exemple laisse deviner le format d'une date ou la casse d'un
 * sexe. La ligne d'exemple répond aux deux sans une phrase, et se supprime
 * d'un clic droit. Les noms sont volontairement neutres et togolais ; aucun
 * n'est celui d'une personne réelle.
 */

export type DomaineImport = 'eleves' | 'enseignants' | 'paiements';

export interface ColonneModele {
  /** Le nom exact attendu en première ligne du fichier. */
  cle: string;
  /** Ce que la colonne contient, dit comme l'école le dirait. */
  description: string;
  obligatoire: boolean;
}

export interface Modele {
  /** Nom du fichier proposé au téléchargement, sans extension. */
  fichier: string;
  /** Titre de l'écran et du classeur. */
  libelle: string;
  colonnes: ColonneModele[];
  /** Une ligne d'exemple, dans l'ordre des colonnes. */
  exemple: string[];
}

/** Décrit une colonne à partir de sa clé, pour garder l'ordre du schéma. */
function decrire(
  cles: readonly string[],
  descriptions: Record<string, string>,
  obligatoires: readonly string[],
): ColonneModele[] {
  return cles.map((cle) => ({
    cle,
    description: descriptions[cle] ?? '',
    obligatoire: obligatoires.includes(cle),
  }));
}

export const MODELES: Record<DomaineImport, Modele> = {
  eleves: {
    fichier: 'modele-eleves-scolargest',
    libelle: 'Élèves et responsables',
    colonnes: decrire(
      ELEVE_IMPORT_COLUMNS,
      {
        nom: 'Nom de famille de l’élève',
        prenoms: 'Prénoms de l’élève',
        sexe: 'M ou F',
        date_naissance: 'Format AAAA-MM-JJ',
        lieu_naissance: 'Ville ou village de naissance',
        nationalite: 'Togolaise, Béninoise…',
        classe: 'Nom exact d’une classe déjà créée pour l’année en cours',
        nom_responsable: 'Nom du parent ou tuteur',
        prenoms_responsable: 'Prénoms du parent ou tuteur',
        telephone_responsable: 'Numéro joignable',
        email_responsable: 'Adresse email, si vous l’avez',
        type_responsable: 'PERE, MERE ou TUTEUR',
        principal: 'oui ou non — le responsable à contacter en premier',
      },
      ['nom', 'prenoms', 'sexe', 'date_naissance', 'classe', 'nom_responsable', 'telephone_responsable'],
    ),
    exemple: [
      'Amouzou',
      'Kodjo Michel',
      'M',
      '2010-04-17',
      'Lomé',
      'Togolaise',
      '6ème A',
      'Amouzou',
      'Yawa',
      '90 00 00 00',
      '',
      'MERE',
      'oui',
    ],
  },

  enseignants: {
    fichier: 'modele-enseignants-scolargest',
    libelle: 'Enseignants et affectations',
    colonnes: decrire(
      ENSEIGNANT_IMPORT_COLUMNS,
      {
        nom: 'Nom de famille',
        prenoms: 'Prénoms',
        sexe: 'M ou F',
        email: 'Adresse email — elle sert à l’inviter sur la plateforme',
        telephone: 'Numéro joignable',
        date_naissance: 'Format AAAA-MM-JJ',
        date_embauche: 'Format AAAA-MM-JJ',
        matricule_ancien: 'Son matricule dans votre ancien système, si vous en aviez un',
        classe: 'Nom exact d’une classe déjà créée',
        matiere: 'Nom exact d’une matière du programme',
      },
      ['nom', 'prenoms', 'sexe', 'email'],
    ),
    exemple: [
      'Kossi',
      'Améyo',
      'F',
      'ameyo.kossi@exemple.tg',
      '90 00 00 00',
      '1988-11-02',
      '2020-09-01',
      '',
      '6ème A',
      'Mathématiques',
    ],
  },

  paiements: {
    fichier: 'modele-versements-scolargest',
    libelle: 'Versements',
    colonnes: decrire(
      PAIEMENT_IMPORT_COLUMNS,
      {
        matricule: 'Matricule de l’élève dans ScolarGest',
        montant: 'En francs CFA, sans espace ni symbole',
        date_paiement: 'Format AAAA-MM-JJ',
        mode_paiement: 'ESPECES, CHEQUE, VIREMENT, MOBILE_MONEY ou AUTRE',
        reference: 'Numéro de reçu ou de transaction, si vous en avez un',
      },
      ['matricule', 'montant', 'date_paiement', 'mode_paiement'],
    ),
    exemple: ['ELV-2026-0001', '25000', '2026-10-05', 'MOBILE_MONEY', 'TX-4471'],
  },
};

/** Une ligne d'exemple doit couvrir toutes les colonnes, sinon elle désaligne le modèle. */
export function modeleCoherent(modele: Modele): boolean {
  return modele.exemple.length === modele.colonnes.length;
}
