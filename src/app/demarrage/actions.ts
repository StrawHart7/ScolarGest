'use server';

import { z } from 'zod';
import { definirPin } from '@/services/utilisateur';
import {
  createAnneeScolaire,
  activerAnneeScolaire,
  listAnneesScolaires,
} from '@/services/annee-scolaire';
import { activerCycle } from '@/services/structure';
import { createClasse } from '@/services/classe';
import { createMatiere } from '@/services/matiere';
import { ajouterMatiereAuProgramme } from '@/services/programme';
import { definirCoefficients } from '@/services/coefficient';
import { createEnseignant } from '@/services/enseignant';
import { inviteUtilisateur } from '@/services/utilisateur';
import { createTypeFrais } from '@/services/type-frais';
import { createTarif } from '@/services/tarif';
import { ignorerEtape, masquerOnboarding, terminerOnboarding } from '@/services/onboarding';
import type { IdEtape } from '@/lib/onboarding/etapes';

/**
 * Une Server Action par étape du questionnaire de démarrage.
 *
 * Chacune appelle les services existants plutôt que d'écrire en base : ce sont
 * eux qui portent les gardes `requireRole`, la vérification du PIN et les
 * appels `auditLog`. Écrire directement contournerait les trois d'un coup.
 *
 * L'écriture est faite au fil de l'eau, étape par étape — pas d'accumulation
 * validée à la fin. Les étapes dépendent des identifiants réels des
 * précédentes (pas de classe sans niveau, pas de coefficient sans programme),
 * et `activerCycle` est de toute façon irréversible : différer les écritures
 * donnerait une fausse impression de réversibilité.
 */
export type ResultatEtape = { ok: true; message?: string } | { ok: false; message: string };

/**
 * Message d'une exception, y compris quand ce n'est pas une `Error`.
 *
 * Les services propagent les erreurs Supabase telles quelles (`if (error)
 * throw error`), or ce sont des **objets simples** : un test
 * `e instanceof Error` est faux, et remplacer le message par un repli
 * générique masquait la cause réelle (contrainte violée, refus RLS…) au
 * moment précis où on en a besoin.
 */
function messageErreur(e: unknown, repli: string): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null) {
    const objet = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parties = [objet.message, objet.details, objet.hint]
      .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
      .join(' — ');
    if (parties) {
      return typeof objet.code === 'string' ? `${parties} (${objet.code})` : parties;
    }
  }
  return repli;
}

function echec(e: unknown, repli: string): ResultatEtape {
  return { ok: false, message: messageErreur(e, repli) };
}

/**
 * Violation de contrainte d'unicité. Reconnue par le code Postgres `23505`
 * autant que par le texte : c'est le cas normal quand l'utilisateur relance
 * une étape déjà passée, et il doit être compté comme « existait déjà »
 * plutôt que de faire échouer tout le lot.
 */
function estDoublon(e: unknown): boolean {
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  if (code === '23505') return true;
  return /duplicate key|unique/i.test(messageErreur(e, ''));
}

/**
 * Premier message d'une erreur Zod. `noUncheckedIndexedAccess` étant actif,
 * `errors[0]` est typé comme potentiellement absent : le repli couvre ce cas
 * théorique sans disperser un `?.` dans chaque action.
 */
function messageZod(erreur: z.ZodError): string {
  return erreur.errors[0]?.message ?? 'Saisie invalide.';
}

const pinSchema = z.string().regex(/^\d{6}$/, 'Le code doit comporter exactement 6 chiffres.');

// --- Étape 0 : code de confirmation ----------------------------------------

export async function definirPinAction(pin: string): Promise<ResultatEtape> {
  const valide = pinSchema.safeParse(pin);
  if (!valide.success) {
    return { ok: false, message: messageZod(valide.error) };
  }
  try {
    await definirPin(valide.data);
    return { ok: true, message: 'Code de confirmation enregistré.' };
  } catch (e) {
    return echec(e, "Impossible d'enregistrer le code.");
  }
}

// --- Étape 1 : année scolaire ----------------------------------------------

const anneeSchema = z.object({
  libelle: z.string().min(4, "Indiquez un libellé d'année (par exemple 2026-2027)."),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de début invalide.'),
  dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de fin invalide.'),
  pin: pinSchema,
});

export async function creerEtActiverAnneeAction(
  entree: z.input<typeof anneeSchema>,
): Promise<ResultatEtape> {
  const valide = anneeSchema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: messageZod(valide.error) };
  }
  const { libelle, dateDebut, dateFin, pin } = valide.data;
  if (dateFin <= dateDebut) {
    return { ok: false, message: 'La date de fin doit suivre la date de début.' };
  }
  try {
    // L'étape se fait en deux écritures (création puis activation) : une
    // interruption entre les deux — rechargement, redémarrage du serveur de
    // développement — laissait une année en PREPARATION que toute nouvelle
    // tentative heurtait ensuite sur l'unicité (etablissementId, libelle),
    // bloquant définitivement le parcours sans issue depuis l'interface.
    // On reprend donc l'année existante au lieu d'en recréer une.
    const existante = (await listAnneesScolaires()).find((a) => a.libelle === libelle);
    const annee = existante ?? (await createAnneeScolaire({ libelle, dateDebut, dateFin }));

    if (annee.statut === 'ACTIVE') {
      return { ok: true, message: `Année ${libelle} déjà active.` };
    }
    await activerAnneeScolaire(annee.id, pin);
    return {
      ok: true,
      message: existante
        ? `Année ${libelle} reprise et activée.`
        : `Année ${libelle} créée et activée.`,
    };
  } catch (e) {
    return echec(e, "Impossible de créer l'année scolaire.");
  }
}

// --- Étape 2 : cycles ------------------------------------------------------

const cyclesSchema = z.object({
  cycleIds: z.array(z.string().uuid()).min(1, 'Sélectionnez au moins un cycle.'),
  pin: pinSchema,
});

/**
 * Le PIN est saisi une fois pour le lot : `activerCycle` le revérifie à chaque
 * appel côté serveur (c'est le même secret), mais le demander une fois par
 * cycle rendrait l'étape pénible sans rien apporter en sécurité.
 */
export async function activerCyclesAction(
  entree: z.input<typeof cyclesSchema>,
): Promise<ResultatEtape> {
  const valide = cyclesSchema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: messageZod(valide.error) };
  }
  const { cycleIds, pin } = valide.data;
  try {
    for (const cycleId of cycleIds) {
      await activerCycle(cycleId, pin);
    }
    const pluriel = cycleIds.length > 1 ? 's' : '';
    return { ok: true, message: `${cycleIds.length} cycle${pluriel} activé${pluriel}.` };
  } catch (e) {
    return echec(e, "Impossible d'activer les cycles.");
  }
}

// --- Étape 3 : classes -----------------------------------------------------

const classesSchema = z.object({
  anneeScolaireId: z.string().uuid(),
  classes: z
    .array(
      z.object({
        niveauId: z.string().uuid(),
        serieId: z.string().uuid().nullable().optional(),
        nom: z.string().min(1),
        capacite: z.number().int().positive().nullable().optional(),
      }),
    )
    .min(1, 'Indiquez au moins une classe.'),
});

/**
 * `createClasse` ne crée qu'une classe à la fois — le lot est donc une boucle.
 * Une classe déjà existante (contrainte unique sur
 * `etablissementId, anneeScolaireId, nom`) est comptée comme ignorée plutôt
 * que de faire échouer tout le lot : c'est le cas normal quand l'utilisateur
 * rafraîchit en plein milieu de l'étape.
 */
export async function creerClassesAction(
  entree: z.input<typeof classesSchema>,
): Promise<ResultatEtape> {
  const valide = classesSchema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: messageZod(valide.error) };
  }
  const { anneeScolaireId, classes } = valide.data;
  let creees = 0;
  let existantes = 0;
  try {
    for (const classe of classes) {
      try {
        await createClasse({
          anneeScolaireId,
          niveauId: classe.niveauId,
          serieId: classe.serieId ?? null,
          nom: classe.nom,
          capacite: classe.capacite ?? null,
        });
        creees += 1;
      } catch (e) {
        if (estDoublon(e)) {
          existantes += 1;
          continue;
        }
        throw e;
      }
    }
  } catch (e) {
    return echec(e, 'Impossible de créer les classes.');
  }
  const details = existantes > 0 ? ` (${existantes} existaient déjà)` : '';
  return { ok: true, message: `${creees} classe${creees > 1 ? 's' : ''} créée${creees > 1 ? 's' : ''}${details}.` };
}

// --- Étape 4 : matières ----------------------------------------------------

const matieresSchema = z.object({
  matieres: z
    .array(z.object({ nom: z.string().min(1), code: z.string().optional() }))
    .min(1, 'Sélectionnez au moins une matière.'),
});

export async function creerMatieresAction(
  entree: z.input<typeof matieresSchema>,
): Promise<ResultatEtape> {
  const valide = matieresSchema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: messageZod(valide.error) };
  }
  let creees = 0;
  let existantes = 0;
  try {
    for (const matiere of valide.data.matieres) {
      try {
        await createMatiere({ nom: matiere.nom, code: matiere.code });
        creees += 1;
      } catch (e) {
        // Unique (etablissementId, nom) : une matière déjà saisie ailleurs
        // n'est pas une erreur du point de vue du questionnaire.
        if (estDoublon(e)) {
          existantes += 1;
          continue;
        }
        throw e;
      }
    }
  } catch (e) {
    return echec(e, 'Impossible de créer les matières.');
  }
  const details = existantes > 0 ? ` (${existantes} existaient déjà)` : '';
  return { ok: true, message: `${creees} matière${creees > 1 ? 's' : ''} créée${creees > 1 ? 's' : ''}${details}.` };
}

// --- Étape 5 : programme ---------------------------------------------------

const programmeSchema = z.object({
  affectations: z
    .array(z.object({ niveauId: z.string().uuid(), matiereIds: z.array(z.string().uuid()) }))
    .min(1),
});

export async function definirProgrammeAction(
  entree: z.input<typeof programmeSchema>,
): Promise<ResultatEtape> {
  const valide = programmeSchema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: messageZod(valide.error) };
  }
  let ajoutees = 0;
  try {
    for (const affectation of valide.data.affectations) {
      // `ordreAffichage` suit l'ordre de la liste : c'est celui dans lequel
      // les matières apparaîtront sur les bulletins.
      let ordre = 0;
      for (const matiereId of affectation.matiereIds) {
        try {
          await ajouterMatiereAuProgramme(affectation.niveauId, matiereId, true, ordre);
          ajoutees += 1;
        } catch (e) {
          if (estDoublon(e)) {
            continue;
          }
          throw e;
        } finally {
          ordre += 1;
        }
      }
    }
  } catch (e) {
    return echec(e, 'Impossible d’enregistrer le programme.');
  }
  return { ok: true, message: `${ajoutees} association${ajoutees > 1 ? 's' : ''} enregistrée${ajoutees > 1 ? 's' : ''}.` };
}

// --- Étape 6 : coefficients ------------------------------------------------

const coefficientsSchema = z.object({
  anneeScolaireId: z.string().uuid(),
  lots: z
    .array(
      z.object({
        serieId: z.string().uuid().nullable(),
        saisies: z
          .array(
            z.object({
              programmeEtablissementId: z.string().uuid(),
              // 0 est admis et signifie « matière non évaluée pour cette
              // série » : le calcul des bulletins lit `coefficients.get(...)
              // ?? 0`, un coefficient nul retire donc la matière de la
              // moyenne pondérée. C'est le mécanisme prévu par le schéma pour
              // différencier les séries, `programme_etablissement` étant
              // unique sur (etablissement, niveau, matiere) sans série.
              coefficient: z.number().nonnegative('Un coefficient ne peut pas être négatif.'),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export async function definirCoefficientsAction(
  entree: z.input<typeof coefficientsSchema>,
): Promise<ResultatEtape> {
  const valide = coefficientsSchema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: messageZod(valide.error) };
  }
  const { anneeScolaireId, lots } = valide.data;
  let total = 0;
  try {
    for (const lot of lots) {
      total += await definirCoefficients(anneeScolaireId, lot.serieId, lot.saisies);
    }
  } catch (e) {
    return echec(e, 'Impossible d’enregistrer les coefficients.');
  }
  return { ok: true, message: `${total} coefficient${total > 1 ? 's' : ''} enregistré${total > 1 ? 's' : ''}.` };
}

// --- Étape 7 : enseignants -------------------------------------------------

const enseignantsSchema = z.object({
  anneeScolaireId: z.string().uuid(),
  enseignants: z
    .array(
      z.object({
        nom: z.string().min(1, 'Le nom est obligatoire.'),
        prenoms: z.string().min(1, 'Les prénoms sont obligatoires.'),
        sexe: z.enum(['M', 'F']),
        email: z.string().email('Adresse email invalide.'),
      }),
    )
    .min(1, 'Ajoutez au moins un enseignant.'),
});

/**
 * `createEnseignant` invite systématiquement un compte : l'email est donc
 * obligatoire, et l'année scolaire aussi puisqu'elle sert de séquence au
 * matricule. Chaque échec est rapporté nominativement plutôt que d'annuler
 * tout le lot — une adresse déjà utilisée ne doit pas faire perdre les
 * enseignants déjà saisis.
 */
export async function inviterEnseignantsAction(
  entree: z.input<typeof enseignantsSchema>,
): Promise<ResultatEtape> {
  const valide = enseignantsSchema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: messageZod(valide.error) };
  }
  const { anneeScolaireId, enseignants } = valide.data;
  const echecs: string[] = [];
  let crees = 0;
  for (const enseignant of enseignants) {
    try {
      await createEnseignant({ ...enseignant, anneeScolaireIdPourMatricule: anneeScolaireId });
      crees += 1;
    } catch (e) {
      echecs.push(`${enseignant.nom} ${enseignant.prenoms} (${messageErreur(e, 'erreur')})`);
    }
  }
  if (crees === 0) {
    return { ok: false, message: `Aucun enseignant créé — ${echecs.join(' ; ')}` };
  }
  const details = echecs.length > 0 ? ` ${echecs.length} en échec : ${echecs.join(' ; ')}` : '';
  return { ok: true, message: `${crees} enseignant${crees > 1 ? 's' : ''} invité${crees > 1 ? 's' : ''}.${details}` };
}

// --- Étape 8 : équipe administrative ---------------------------------------

const utilisateursSchema = z.object({
  etablissementId: z.string().uuid(),
  utilisateurs: z
    .array(
      z.object({
        nom: z.string().min(1, 'Le nom est obligatoire.'),
        prenom: z.string().min(1, 'Le prénom est obligatoire.'),
        email: z.string().email('Adresse email invalide.'),
        // Un Directeur ne peut pas en inviter un autre : `inviteUtilisateur`
        // réserve ce cas au SUPER_ADMIN.
        role: z.enum(['SECRETAIRE', 'COMPTABLE']),
      }),
    )
    .min(1, 'Ajoutez au moins une personne.'),
});

export async function inviterUtilisateursAction(
  entree: z.input<typeof utilisateursSchema>,
): Promise<ResultatEtape> {
  const valide = utilisateursSchema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: messageZod(valide.error) };
  }
  const { etablissementId, utilisateurs } = valide.data;
  const echecs: string[] = [];
  let invites = 0;
  for (const utilisateur of utilisateurs) {
    try {
      await inviteUtilisateur({ ...utilisateur, etablissementId });
      invites += 1;
    } catch (e) {
      echecs.push(`${utilisateur.email} (${messageErreur(e, 'erreur')})`);
    }
  }
  if (invites === 0) {
    return { ok: false, message: `Aucune invitation envoyée — ${echecs.join(' ; ')}` };
  }
  const details = echecs.length > 0 ? ` ${echecs.length} en échec : ${echecs.join(' ; ')}` : '';
  return { ok: true, message: `${invites} invitation${invites > 1 ? 's' : ''} envoyée${invites > 1 ? 's' : ''}.${details}` };
}

// --- Parcours finance : types de frais --------------------------------------

const typesFraisSchema = z.object({
  types: z
    .array(z.object({ nom: z.string().min(1), description: z.string().optional() }))
    .min(1, 'Sélectionnez au moins un type de frais.'),
});

export async function creerTypesFraisAction(
  entree: z.input<typeof typesFraisSchema>,
): Promise<ResultatEtape> {
  const valide = typesFraisSchema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: messageZod(valide.error) };
  }
  let crees = 0;
  try {
    for (const type of valide.data.types) {
      await createTypeFrais({ nom: type.nom, description: type.description });
      crees += 1;
    }
  } catch (e) {
    return echec(e, 'Impossible de créer les types de frais.');
  }
  return { ok: true, message: `${crees} type${crees > 1 ? 's' : ''} de frais créé${crees > 1 ? 's' : ''}.` };
}

// --- Parcours finance : tarifs ----------------------------------------------

const tarifsSchema = z.object({
  anneeScolaireId: z.string().uuid(),
  tarifs: z
    .array(
      z.object({
        classeId: z.string().uuid(),
        typeFraisId: z.string().uuid(),
        montant: z.number().nonnegative('Un montant ne peut pas être négatif.'),
      }),
    )
    .min(1, 'Renseignez au moins un montant.'),
});

/**
 * Le tarif est par classe, mais la saisie se fait par niveau : l'appelant
 * développe un montant de niveau sur toutes les classes concernées. Un tarif
 * déjà défini (unique sur `anneeScolaireId, classeId, typeFraisId`) est ignoré
 * plutôt que de faire échouer le lot, l'écran des tarifs restant l'endroit
 * pour les corrections.
 */
export async function creerTarifsAction(
  entree: z.input<typeof tarifsSchema>,
): Promise<ResultatEtape> {
  const valide = tarifsSchema.safeParse(entree);
  if (!valide.success) {
    return { ok: false, message: messageZod(valide.error) };
  }
  const { anneeScolaireId, tarifs } = valide.data;
  let crees = 0;
  let existants = 0;
  try {
    for (const tarif of tarifs) {
      try {
        await createTarif({ anneeScolaireId, ...tarif });
        crees += 1;
      } catch (e) {
        if (estDoublon(e)) {
          existants += 1;
          continue;
        }
        throw e;
      }
    }
  } catch (e) {
    return echec(e, 'Impossible d’enregistrer les tarifs.');
  }
  const details = existants > 0 ? ` (${existants} existaient déjà)` : '';
  return { ok: true, message: `${crees} tarif${crees > 1 ? 's' : ''} enregistré${crees > 1 ? 's' : ''}${details}.` };
}

// --- Pilotage du parcours --------------------------------------------------

export async function ignorerEtapeAction(etape: IdEtape): Promise<ResultatEtape> {
  try {
    await ignorerEtape(etape);
    return { ok: true };
  } catch (e) {
    return echec(e, "Impossible d'enregistrer ce choix.");
  }
}

export async function masquerOnboardingAction(): Promise<ResultatEtape> {
  try {
    await masquerOnboarding();
    return { ok: true };
  } catch (e) {
    return echec(e, 'Impossible de masquer le rappel.');
  }
}

export async function terminerOnboardingAction(): Promise<ResultatEtape> {
  try {
    await terminerOnboarding();
    return { ok: true };
  } catch (e) {
    return echec(e, 'Impossible de terminer la configuration.');
  }
}
