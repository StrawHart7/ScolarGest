import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { getTenantContext, type Role } from './tenant';
import { listSuiviPaiements, totauxSuivi } from './facture';
import { listMesAffectations } from './affectation';
import {
  classement,
  moyenneClasse,
  moyenneInterros,
  moyenneMatiere,
  moyenneTrimestrielle,
  type MatiereBulletinInput,
} from '@/modules/academics/services/calcul-moyennes';
import type { Periode } from './evaluation';
import type { Rapport } from '@/lib/export/rapport';

/**
 * Rapports du doc 09 §13, tous rendus dans la forme commune `Rapport` : une
 * seule définition alimente l'aperçu à l'écran et les trois formats d'export.
 *
 * Le périmètre par rôle du doc 09 §9 est appliqué ici, dans le service, pas
 * seulement dans l'UI — un export est un accès aux données comme un autre.
 */
export type TypeRapport =
  | 'ELEVES'
  | 'ENSEIGNANTS'
  | 'EFFECTIFS'
  | 'PAIEMENTS'
  | 'RESULTATS';

export interface DefinitionRapport {
  type: TypeRapport;
  libelle: string;
  description: string;
  roles: Role[];
  /** Le rapport porte sur une classe précise. */
  exigeClasse?: boolean;
  /** Le rapport porte sur une période (trimestre). */
  exigePeriode?: boolean;
}

/** Matrice d'accès du doc 09 §9. Le SUPER_ADMIN passe partout via requireRole. */
export const RAPPORTS: DefinitionRapport[] = [
  {
    type: 'ELEVES',
    libelle: 'Liste des élèves',
    description: 'Élèves inscrits avec leur classe et leur responsable principal.',
    roles: ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'],
  },
  {
    type: 'ENSEIGNANTS',
    libelle: 'Liste des enseignants',
    description: 'Enseignants et nombre d’affectations sur l’année.',
    roles: ['DIRECTEUR', 'SECRETAIRE'],
  },
  {
    type: 'EFFECTIFS',
    libelle: 'Effectifs par classe',
    description: 'Effectif inscrit, capacité et taux de remplissage par classe.',
    roles: ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE'],
  },
  {
    type: 'PAIEMENTS',
    libelle: 'État des paiements',
    description: 'Total dû, encaissé et reste à recouvrer par élève.',
    roles: ['DIRECTEUR', 'COMPTABLE'],
  },
  {
    type: 'RESULTATS',
    libelle: 'Résultats par classe',
    description: 'Moyennes et classement d’une classe sur un trimestre.',
    roles: ['DIRECTEUR', 'SECRETAIRE', 'ENSEIGNANT'],
    exigeClasse: true,
    exigePeriode: true,
  },
];

export function definitionRapport(type: TypeRapport): DefinitionRapport {
  const definition = RAPPORTS.find((r) => r.type === type);
  if (!definition) throw new Error('Rapport inconnu.');
  return definition;
}

/** Rapports visibles pour un rôle donné. */
export function rapportsAutorises(role: Role): DefinitionRapport[] {
  if (role === 'SUPER_ADMIN') return RAPPORTS;
  return RAPPORTS.filter((r) => r.roles.includes(role));
}

export interface ParametresRapport {
  anneeScolaireId: string;
  classeId?: string;
  periode?: Periode;
}

/**
 * Construit un rapport. Le contrôle de rôle est fait ici à partir de la
 * matrice ci-dessus : ajouter un rapport, c'est déclarer ses rôles, pas
 * réécrire une garde.
 */
export async function construireRapport(
  type: TypeRapport,
  parametres: ParametresRapport,
): Promise<Rapport> {
  const definition = definitionRapport(type);
  const ctx = await requireRole(...definition.roles);

  const supabase = createClient();
  const { data: annee } = await supabase
    .from('annee_scolaire')
    .select('libelle')
    .eq('id', parametres.anneeScolaireId)
    .maybeSingle();
  const libelleAnnee = (annee as { libelle: string } | null)?.libelle ?? '';

  switch (type) {
    case 'ELEVES':
      return rapportEleves(parametres, libelleAnnee);
    case 'ENSEIGNANTS':
      return rapportEnseignants(parametres, libelleAnnee);
    case 'EFFECTIFS':
      return rapportEffectifs(parametres, libelleAnnee);
    case 'PAIEMENTS':
      return rapportPaiements(parametres, libelleAnnee);
    case 'RESULTATS':
      return rapportResultats(parametres, libelleAnnee, ctx.role);
    default:
      throw new Error('Rapport inconnu.');
  }
}

// ------------------------------------------------------------------
// Rapports administratifs
// ------------------------------------------------------------------

async function rapportEleves(
  parametres: ParametresRapport,
  libelleAnnee: string,
): Promise<Rapport> {
  const ctx = await getTenantContext();
  const supabase = createClient();

  let query = supabase
    .from('inscription')
    .select(
      '"eleveId", "classeId", statut, eleve:eleve(matricule, nom, prenoms, sexe, "dateNaissance", statut), classe:classe(nom)',
    )
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', parametres.anneeScolaireId);
  if (parametres.classeId) query = query.eq('classeId', parametres.classeId);
  const { data, error } = await query;
  if (error) throw error;

  type Ligne = {
    eleveId: string;
    statut: string;
    eleve: {
      matricule: string;
      nom: string;
      prenoms: string;
      sexe: string;
      dateNaissance: string;
      statut: string;
    } | null;
    classe: { nom: string } | null;
  };
  const rows = (data ?? []) as unknown as Ligne[];

  // Responsable principal en une seule requête plutôt qu'une par élève.
  const eleveIds = rows.map((r) => r.eleveId);
  const responsableParEleve = new Map<string, string>();
  if (eleveIds.length > 0) {
    const { data: liens } = await supabase
      .from('eleve_responsable')
      .select('"eleveId", responsable:responsable(nom, prenoms, telephone)')
      .eq('principal', true)
      .in('eleveId', eleveIds);
    for (const lien of (liens ?? []) as unknown as {
      eleveId: string;
      responsable: { nom: string; prenoms: string; telephone: string | null } | null;
    }[]) {
      if (!lien.responsable) continue;
      responsableParEleve.set(
        lien.eleveId,
        `${lien.responsable.nom} ${lien.responsable.prenoms}${lien.responsable.telephone ? ` (${lien.responsable.telephone})` : ''}`,
      );
    }
  }

  const lignes = rows
    .map((r) => ({
      matricule: r.eleve?.matricule ?? '',
      nom: r.eleve?.nom ?? '',
      prenoms: r.eleve?.prenoms ?? '',
      sexe: r.eleve?.sexe ?? '',
      dateNaissance: r.eleve?.dateNaissance
        ? new Date(r.eleve.dateNaissance).toLocaleDateString('fr-FR')
        : '',
      classe: r.classe?.nom ?? '',
      statut: r.statut,
      responsable: responsableParEleve.get(r.eleveId) ?? '',
    }))
    .sort((a, b) => `${a.classe}${a.nom}${a.prenoms}`.localeCompare(`${b.classe}${b.nom}${b.prenoms}`));

  return {
    titre: 'Liste des élèves',
    sousTitre: libelleAnnee,
    colonnes: [
      { cle: 'matricule', libelle: 'Matricule' },
      { cle: 'nom', libelle: 'Nom' },
      { cle: 'prenoms', libelle: 'Prénoms' },
      { cle: 'sexe', libelle: 'Sexe' },
      { cle: 'dateNaissance', libelle: 'Date de naissance' },
      { cle: 'classe', libelle: 'Classe' },
      { cle: 'statut', libelle: 'Inscription' },
      { cle: 'responsable', libelle: 'Responsable principal' },
    ],
    lignes,
  };
}

async function rapportEnseignants(
  parametres: ParametresRapport,
  libelleAnnee: string,
): Promise<Rapport> {
  const ctx = await getTenantContext();
  const supabase = createClient();

  const { data: enseignants, error } = await supabase
    .from('enseignant')
    .select('id, matricule, nom, prenoms, sexe, telephone, email, statut')
    .eq('etablissementId', ctx.etablissementId)
    .order('nom');
  if (error) throw error;

  const { data: affectations } = await supabase
    .from('affectation_enseignant')
    .select('"enseignantId"')
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', parametres.anneeScolaireId);

  const nbAffectations = new Map<string, number>();
  for (const a of (affectations ?? []) as { enseignantId: string }[]) {
    nbAffectations.set(a.enseignantId, (nbAffectations.get(a.enseignantId) ?? 0) + 1);
  }

  const lignes = (
    (enseignants ?? []) as unknown as {
      id: string;
      matricule: string;
      nom: string;
      prenoms: string;
      sexe: string;
      telephone: string | null;
      email: string | null;
      statut: string;
    }[]
  ).map((e) => ({
    matricule: e.matricule,
    nom: e.nom,
    prenoms: e.prenoms,
    sexe: e.sexe,
    telephone: e.telephone ?? '',
    email: e.email ?? '',
    statut: e.statut,
    affectations: nbAffectations.get(e.id) ?? 0,
  }));

  return {
    titre: 'Liste des enseignants',
    sousTitre: libelleAnnee,
    colonnes: [
      { cle: 'matricule', libelle: 'Matricule' },
      { cle: 'nom', libelle: 'Nom' },
      { cle: 'prenoms', libelle: 'Prénoms' },
      { cle: 'sexe', libelle: 'Sexe' },
      { cle: 'telephone', libelle: 'Téléphone' },
      { cle: 'email', libelle: 'Email' },
      { cle: 'statut', libelle: 'Statut' },
      { cle: 'affectations', libelle: 'Affectations', numerique: true },
    ],
    lignes,
    totaux: {
      matricule: 'Total',
      nom: `${lignes.length} enseignant(s)`,
      affectations: lignes.reduce((s, l) => s + l.affectations, 0),
    },
  };
}

async function rapportEffectifs(
  parametres: ParametresRapport,
  libelleAnnee: string,
): Promise<Rapport> {
  const ctx = await getTenantContext();
  const supabase = createClient();

  const { data: classes, error } = await supabase
    .from('classe')
    .select('id, nom, capacite, niveau:niveau(nom)')
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', parametres.anneeScolaireId)
    .order('nom');
  if (error) throw error;

  const { data: inscriptions } = await supabase
    .from('inscription')
    .select('"classeId", statut, eleve:eleve(sexe)')
    .eq('etablissementId', ctx.etablissementId)
    .eq('anneeScolaireId', parametres.anneeScolaireId)
    .eq('statut', 'ACTIVE');

  const parClasse = new Map<string, { total: number; garcons: number; filles: number }>();
  for (const i of (inscriptions ?? []) as unknown as {
    classeId: string;
    eleve: { sexe: string } | null;
  }[]) {
    const agg = parClasse.get(i.classeId) ?? { total: 0, garcons: 0, filles: 0 };
    agg.total += 1;
    if (i.eleve?.sexe === 'M') agg.garcons += 1;
    else if (i.eleve?.sexe === 'F') agg.filles += 1;
    parClasse.set(i.classeId, agg);
  }

  const lignes = (
    (classes ?? []) as unknown as {
      id: string;
      nom: string;
      capacite: number | null;
      niveau: { nom: string } | null;
    }[]
  ).map((c) => {
    const agg = parClasse.get(c.id) ?? { total: 0, garcons: 0, filles: 0 };
    return {
      classe: c.nom,
      niveau: c.niveau?.nom ?? '',
      garcons: agg.garcons,
      filles: agg.filles,
      effectif: agg.total,
      capacite: c.capacite ?? 0,
      remplissage: c.capacite ? `${Math.round((agg.total / c.capacite) * 100)} %` : '',
    };
  });

  return {
    titre: 'Effectifs par classe',
    sousTitre: libelleAnnee,
    colonnes: [
      { cle: 'classe', libelle: 'Classe' },
      { cle: 'niveau', libelle: 'Niveau' },
      { cle: 'garcons', libelle: 'Garçons', numerique: true },
      { cle: 'filles', libelle: 'Filles', numerique: true },
      { cle: 'effectif', libelle: 'Effectif', numerique: true },
      { cle: 'capacite', libelle: 'Capacité', numerique: true },
      { cle: 'remplissage', libelle: 'Remplissage' },
    ],
    lignes,
    totaux: {
      classe: 'Totaux',
      garcons: lignes.reduce((s, l) => s + l.garcons, 0),
      filles: lignes.reduce((s, l) => s + l.filles, 0),
      effectif: lignes.reduce((s, l) => s + l.effectif, 0),
      capacite: lignes.reduce((s, l) => s + l.capacite, 0),
    },
  };
}

// ------------------------------------------------------------------
// Rapport financier
// ------------------------------------------------------------------

async function rapportPaiements(
  parametres: ParametresRapport,
  libelleAnnee: string,
): Promise<Rapport> {
  const suivi = await listSuiviPaiements(parametres.anneeScolaireId, {
    classeId: parametres.classeId,
  });
  const totaux = totauxSuivi(suivi);

  return {
    titre: 'État des paiements',
    sousTitre: libelleAnnee,
    colonnes: [
      { cle: 'matricule', libelle: 'Matricule' },
      { cle: 'eleve', libelle: 'Élève' },
      { cle: 'classe', libelle: 'Classe' },
      { cle: 'du', libelle: 'Total dû', numerique: true },
      { cle: 'paye', libelle: 'Total payé', numerique: true },
      { cle: 'solde', libelle: 'Reste à recouvrer', numerique: true },
      { cle: 'statut', libelle: 'Statut' },
    ],
    lignes: suivi.map((l) => ({
      matricule: l.matricule,
      eleve: `${l.nom} ${l.prenoms}`,
      classe: l.classeNom ?? '',
      du: l.montantTotal,
      paye: l.totalPaye,
      solde: l.solde,
      statut: l.statut,
    })),
    totaux: {
      matricule: 'Totaux',
      eleve: `${suivi.length} facture(s)`,
      du: totaux.montantTotal,
      paye: totaux.totalPaye,
      solde: totaux.solde,
    },
  };
}

// ------------------------------------------------------------------
// Rapport académique
// ------------------------------------------------------------------

async function rapportResultats(
  parametres: ParametresRapport,
  libelleAnnee: string,
  role: Role,
): Promise<Rapport> {
  if (!parametres.classeId || !parametres.periode) {
    throw new Error('Ce rapport exige une classe et un trimestre.');
  }

  // Périmètre enseignant : `getClassementClasse` (Phase 4) se contente d'un
  // `requireRole` et laisserait un enseignant lire le classement d'une classe
  // qui n'est pas la sienne. On applique la restriction ici plutôt que de
  // l'exporter par mégarde — un export est un accès aux données comme un
  // autre. (Le durcissement de `getClassementClasse` est noté pour la
  // Phase 10.)
  if (role === 'ENSEIGNANT') {
    const mesAffectations = await listMesAffectations(parametres.anneeScolaireId);
    const mesClasses = new Set(mesAffectations.map((a) => a.classeId));
    if (!mesClasses.has(parametres.classeId)) {
      throw new Error('Accès refusé : cette classe ne fait pas partie de vos affectations.');
    }
  }

  const supabase = createClient();

  const { data: classe, error: classeError } = await supabase
    .from('classe')
    .select('id, nom, "niveauId", "serieId"')
    .eq('id', parametres.classeId)
    .single();
  if (classeError) throw classeError;

  const { data: inscriptions, error: insError } = await supabase
    .from('inscription')
    .select('"eleveId", eleve:eleve(id, matricule, nom, prenoms)')
    .eq('classeId', parametres.classeId)
    .eq('anneeScolaireId', parametres.anneeScolaireId)
    .eq('statut', 'ACTIVE');
  if (insError) throw insError;

  const eleves = (
    (inscriptions ?? []) as unknown as {
      eleveId: string;
      eleve: { id: string; matricule: string; nom: string; prenoms: string } | null;
    }[]
  )
    .filter((i) => i.eleve)
    .map((i) => i.eleve!);

  const { data: programme, error: progError } = await supabase
    .from('programme_etablissement')
    .select('id, "matiereId", obligatoire')
    .eq('niveauId', classe.niveauId);
  if (progError) throw progError;
  const items = (programme ?? []) as unknown as {
    id: string;
    matiereId: string;
    obligatoire: boolean;
  }[];

  const { data: coefficients } = await (classe.serieId
    ? supabase
        .from('coefficient_matiere')
        .select('"programmeEtablissementId", coefficient')
        .eq('anneeScolaireId', parametres.anneeScolaireId)
        .in(
          'programmeEtablissementId',
          items.map((i) => i.id),
        )
        .eq('serieId', classe.serieId)
    : supabase
        .from('coefficient_matiere')
        .select('"programmeEtablissementId", coefficient')
        .eq('anneeScolaireId', parametres.anneeScolaireId)
        .in(
          'programmeEtablissementId',
          items.map((i) => i.id),
        )
        .is('serieId', null));

  const coefParProgramme = new Map(
    ((coefficients ?? []) as { programmeEtablissementId: string; coefficient: number }[]).map(
      (c) => [c.programmeEtablissementId, Number(c.coefficient)],
    ),
  );

  const { data: evaluations, error: evalError } = await supabase
    .from('evaluation')
    .select('id, "matiereId", type')
    .eq('classeId', parametres.classeId)
    .eq('periode', parametres.periode);
  if (evalError) throw evalError;
  const evals = (evaluations ?? []) as unknown as {
    id: string;
    matiereId: string;
    type: 'INTERROGATION' | 'DEVOIR' | 'COMPOSITION';
  }[];

  // notesParEvaluation : evaluationId -> (eleveId -> valeur officielle)
  const notesParEvaluation = new Map<string, Map<string, number | null>>();
  if (evals.length > 0 && eleves.length > 0) {
    const { data: notes, error: notesError } = await supabase
      .from('note')
      .select('"evaluationId", "eleveId", valeur, statut')
      .in(
        'evaluationId',
        evals.map((e) => e.id),
      )
      .in(
        'eleveId',
        eleves.map((e) => e.id),
      );
    if (notesError) throw notesError;
    for (const n of (notes ?? []) as unknown as {
      evaluationId: string;
      eleveId: string;
      valeur: number | null;
      statut: string;
    }[]) {
      if (!notesParEvaluation.has(n.evaluationId)) {
        notesParEvaluation.set(n.evaluationId, new Map());
      }
      // Seule une note VALIDE (ou dérivée : EN_ATTENTE/REJETE) est
      // officielle — BROUILLON et SOUMISE (en attente de validation par la
      // Secrétaire) ne comptent pas (même règle que le bulletin).
      const compte = n.statut === 'VALIDE' || n.statut === 'EN_ATTENTE' || n.statut === 'REJETE';
      notesParEvaluation.get(n.evaluationId)!.set(n.eleveId, compte ? n.valeur : null);
    }
  }

  // Évaluations regroupées par matière une seule fois, plutôt qu'un filtre
  // par élève et par matière (le rapport tournait en N+1 sur une base
  // distante et dépassait 60 s pour une classe de 18 élèves).
  const evalsParMatiere = new Map<string, typeof evals>();
  for (const e of evals) {
    if (!evalsParMatiere.has(e.matiereId)) evalsParMatiere.set(e.matiereId, []);
    evalsParMatiere.get(e.matiereId)!.push(e);
  }

  function moyenneEleve(eleveId: string): number | null {
    const parMatiere: MatiereBulletinInput[] = items.map((item) => {
      const evalsMatiere = evalsParMatiere.get(item.matiereId) ?? [];
      const interros = evalsMatiere
        .filter((e) => e.type === 'INTERROGATION')
        .map((e) => notesParEvaluation.get(e.id)?.get(eleveId))
        .filter((v): v is number => typeof v === 'number');
      const devoirEval = evalsMatiere.find((e) => e.type === 'DEVOIR');
      const compoEval = evalsMatiere.find((e) => e.type === 'COMPOSITION');

      const devoir = devoirEval
        ? notesParEvaluation.get(devoirEval.id)?.get(eleveId) ?? null
        : null;
      const composition = compoEval
        ? notesParEvaluation.get(compoEval.id)?.get(eleveId) ?? null
        : null;

      return {
        moyenne: moyenneMatiere(moyenneClasse(moyenneInterros(interros), devoir), composition),
        coefficient: coefParProgramme.get(item.id) ?? 0,
        obligatoire: item.obligatoire,
      };
    });
    return moyenneTrimestrielle(parMatiere);
  }

  const moyennes = new Map(eleves.map((e) => [e.id, moyenneEleve(e.id)]));
  const rangs = new Map(
    classement(eleves.map((e) => ({ id: e.id, moyenne: moyennes.get(e.id) ?? null }))).map((r) => [
      r.id,
      r.rang,
    ]),
  );

  const PERIODE_LABEL: Record<string, string> = {
    TRIMESTRE_1: '1er trimestre',
    TRIMESTRE_2: '2e trimestre',
    TRIMESTRE_3: '3e trimestre',
  };

  const lignes = eleves
    .map((eleve) => ({
      rang: rangs.get(eleve.id) ?? '',
      matricule: eleve.matricule,
      eleve: `${eleve.nom} ${eleve.prenoms}`,
      moyenne: moyennes.get(eleve.id) ?? null,
    }))
    .sort((a, b) => (Number(a.rang) || 9999) - (Number(b.rang) || 9999));

  const valeurs = lignes.map((l) => l.moyenne).filter((m): m is number => m !== null);
  const moyenneGenerale =
    valeurs.length > 0
      ? Number((valeurs.reduce((s, m) => s + m, 0) / valeurs.length).toFixed(2))
      : null;

  return {
    titre: 'Résultats par classe',
    sousTitre: `${classe.nom} — ${PERIODE_LABEL[parametres.periode] ?? parametres.periode} — ${libelleAnnee}`,
    colonnes: [
      { cle: 'rang', libelle: 'Rang', numerique: true },
      { cle: 'matricule', libelle: 'Matricule' },
      { cle: 'eleve', libelle: 'Élève' },
      { cle: 'moyenne', libelle: 'Moyenne /20', numerique: true },
    ],
    lignes,
    totaux: {
      rang: null,
      matricule: 'Moyenne de la classe',
      eleve: `${lignes.length} élève(s)`,
      moyenne: moyenneGenerale,
    },
  };
}
