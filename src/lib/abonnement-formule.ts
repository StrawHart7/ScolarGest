/**
 * Vocabulaire de la formule d'abonnement d'une école.
 *
 * Module sans dépendance, importable depuis un composant client : le service
 * `abonnement.ts` ouvre un client Supabase, donc `next/headers`, et l'importer
 * depuis un formulaire ferait échouer la compilation Next — panne déjà vécue
 * le 2026-09-02 avec `FormulaireSupport`. Le vocabulaire vit ici, le service
 * ne garde que les fonctions gardées.
 *
 * **Pourquoi nommer la formule plutôt que l'écrire comme un calcul.** La page
 * de souscription affichait « 10 000 F × 2 cycles ». Un directeur ne se
 * reconnaît pas dans une multiplication : il sait qu'il dirige un collège et
 * un lycée. La formule porte donc le nom de ce qu'il exploite, et le nombre de
 * cycles n'est jamais un choix — il découle de `cycle_etablissement`, et
 * `activerCycle` est gardée par le PIN du Directeur, donc il n'est pas
 * manipulable d'un clic pour alléger la facture.
 */

/** Prix mensuel d'un cycle, en francs CFA. Miroir de `plan_abonnement`. */
export const PRIX_MENSUEL_PAR_CYCLE = 10_000;

/** Prix annuel d'un cycle, en francs CFA. Miroir de `plan_abonnement`. */
export const PRIX_ANNUEL_PAR_CYCLE = 100_000;

export type Periodicite = 'MOIS' | 'AN';

/**
 * Libellé lisible d'un cycle. Les cycles retirés du catalogue (`0014`) y
 * figurent encore : une école déjà en primaire garde ses classes, et son
 * abonnement doit pouvoir se nommer.
 */
const LIBELLE_CYCLE: Record<string, string> = {
  MATERNELLE: 'Maternelle',
  PRIMAIRE: 'Primaire',
  COLLEGE: 'Collège',
  LYCEE: 'Lycée',
};

export function libelleCycle(nom: string): string {
  return LIBELLE_CYCLE[nom] ?? nom.charAt(0) + nom.slice(1).toLowerCase();
}

/**
 * Nom de la formule : « Collège », « Collège + Lycée »…
 *
 * L'ordre suit le cursus, pas l'ordre d'activation : « Collège + Lycée » se
 * lit, « Lycée + Collège » fait hésiter.
 */
const ORDRE_CURSUS = ['MATERNELLE', 'PRIMAIRE', 'COLLEGE', 'LYCEE'];

export function nomFormule(cycles: string[]): string {
  if (cycles.length === 0) return 'Formule de base';
  const tries = [...cycles].sort(
    (a, b) => ORDRE_CURSUS.indexOf(a) - ORDRE_CURSUS.indexOf(b),
  );
  return tries.map(libelleCycle).join(' + ');
}

/** Prix d'un nombre de cycles pour une périodicité donnée. */
export function prixPourCycles(nombreCycles: number, periodicite: Periodicite): number {
  const unitaire = periodicite === 'AN' ? PRIX_ANNUEL_PAR_CYCLE : PRIX_MENSUEL_PAR_CYCLE;
  return unitaire * nombreCycles;
}

/**
 * Économie de l'engagement annuel, exprimée en mois offerts.
 *
 * Calculée plutôt qu'écrite en dur : un prix modifié sans mettre à jour un
 * « 2 mois offerts » figé afficherait un avantage faux sur une page
 * commerciale, ce qui est un problème de confiance avant d'être un bug.
 */
export const MOIS_OFFERTS_ANNUEL =
  12 - PRIX_ANNUEL_PAR_CYCLE / PRIX_MENSUEL_PAR_CYCLE;

/**
 * Montant en francs CFA, formaté à la française.
 *
 * `fr-FR` et non `fr-TG` : tous les navigateurs ne connaissent pas la locale
 * togolaise, et le repli silencieux donnerait un format anglo-saxon.
 */
export function formaterFCFA(montant: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(montant)} FCFA`;
}

export interface FormuleProposee {
  periodicite: Periodicite;
  /** « Collège + Lycée — Annuel ». */
  libelle: string;
  nomFormule: string;
  montant: number;
  nombreCycles: number;
  /** « 200 000 FCFA / an ». */
  montantLibelle: string;
  /** Argument commercial, ou `null` pour le mensuel. */
  avantage: string | null;
}

/**
 * Les deux formules réellement proposables à une école, d'après les cycles
 * qu'elle exploite.
 *
 * Une seule quantité est proposée — la sienne. Lui présenter aussi la formule
 * « un cycle » quand elle en exploite deux l'inviterait à sous-souscrire, puis
 * à découvrir l'écart au moment du paiement.
 */
export function formulesPour(cycles: string[]): FormuleProposee[] {
  // Une école en pleine configuration n'a encore activé aucun cycle : elle
  // paie une unité. Facturer zéro ouvrirait un abonnement gratuit à qui saute
  // l'étape des cycles.
  const nombreCycles = Math.max(cycles.length, 1);
  const nom = nomFormule(cycles);

  return (['MOIS', 'AN'] as const).map((periodicite) => {
    const montant = prixPourCycles(nombreCycles, periodicite);
    return {
      periodicite,
      nomFormule: nom,
      libelle: `${nom} — ${periodicite === 'AN' ? 'Annuel' : 'Mensuel'}`,
      montant,
      nombreCycles,
      montantLibelle: `${formaterFCFA(montant)} / ${periodicite === 'AN' ? 'an' : 'mois'}`,
      avantage:
        periodicite === 'AN'
          ? `${MOIS_OFFERTS_ANNUEL} mois offerts par rapport au mensuel`
          : null,
    };
  });
}
