import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';
import { getAccesAbonnementCourant } from './abonnement';
import type { TenantContext } from './tenant';
import { CATALOGUE, PAR_ID, type IdConseil } from '@/lib/conseils/catalogue';
import {
  choisirConseil,
  reportJusquA,
  HEURES_ENTRE_CONSEILS,
  type ConseilAProposer,
  type Diagnostic,
  type EtatConseil,
  type ValeurSonde,
} from '@/lib/conseils/choix';

/**
 * Conseils : ce que la plateforme sait faire et que l'utilisateur n'a pas
 * encore fait.
 *
 * Ce service ne décide de rien. Il **compte des lignes**, lit la décision déjà
 * prise par l'utilisateur, et confie l'arbitrage à `choisirConseil`, qui est
 * pure et testée à l'oracle. La séparation est volontaire : l'ordre, le rythme
 * et la relégation sont des règles de produit dont une erreur ne se voit pas
 * en production — un conseil de trop, un conseil qui ne revient jamais — et
 * elles doivent donc être vérifiables sans base de données.
 *
 * Les comptages lisent les tables directement plutôt que d'appeler les
 * fonctions `list*` : la plupart exigent un identifiant de classe ou de niveau
 * et imposeraient une requête par ligne là où un `count` suffit. La règle
 * « passer par les services » vise les écritures, qui portent les gardes et
 * l'`auditLog` ; ces lectures restent filtrées explicitement sur
 * `etablissementId`, en défense en profondeur au-dessus de la RLS.
 */

/*
 * Les quatre rôles école sont écrits **en toutes lettres** à chaque garde,
 * plutôt que factorisés dans une constante et diffusés par un spread.
 * `scripts/matrice-permissions.ts` lit les `requireRole(...)` statiquement :
 * un spread lui fait inscrire « DYNAMIQUE », et les sept gardes de ce fichier
 * disparaissent de `Docs/11-Matrice-permissions.md` comme de l'instantané
 * versionné — donc du test qui verrouille les permissions. Une garde qu'aucun
 * test ne surveille est une garde qu'on peut desserrer sans que personne ne le
 * voie. La répétition est le prix de cette surveillance.
 */

interface LigneConseil {
  conseilId: string;
  statut: EtatConseil['statut'];
  reporteJusquA: string | null;
  relegueLe: string | null;
  nombreRelegations: number;
  vuLe: string | null;
}

async function lireHistorique(ctx: TenantContext): Promise<LigneConseil[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('conseil_utilisateur')
    .select('"conseilId", statut, "reporteJusquA", "relegueLe", "nombreRelegations", "vuLe"')
    .eq('etablissementId', ctx.etablissementId)
    .eq('utilisateurId', ctx.userId);
  if (error) throw error;
  return (data ?? []) as LigneConseil[];
}

/** Nombre de lignes d'une table du tenant, sans les rapatrier. */
async function compter(
  table: string,
  etablissementId: string | null,
  filtres: Record<string, string | boolean> = {},
): Promise<number> {
  if (!etablissementId) return 0;
  const supabase = createClient();
  let requete = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId);
  for (const [colonne, valeur] of Object.entries(filtres)) {
    requete = requete.eq(colonne, valeur);
  }
  const { count, error } = await requete;
  if (error) throw error;
  return count ?? 0;
}

/** Sonde binaire : l'objectif est « au moins un ». */
function binaire(nombre: number): ValeurSonde {
  return { fait: nombre > 0 ? 1 : 0, total: 1 };
}

/**
 * Nombre de valeurs distinctes d'une colonne, en rapatriant la colonne.
 *
 * PostgREST ne sait pas compter des valeurs distinctes ; le volume reste celui
 * d'une école — quelques dizaines de classes, quelques centaines d'élèves — et
 * la colonne seule tient largement en mémoire.
 */
async function compterDistinct(
  table: string,
  colonne: string,
  etablissementId: string,
  filtres: Record<string, string> = {},
): Promise<number> {
  const supabase = createClient();
  let requete = supabase
    .from(table)
    .select(`"${colonne}"`)
    .eq('etablissementId', etablissementId);
  for (const [nom, valeur] of Object.entries(filtres)) requete = requete.eq(nom, valeur);
  const { data, error } = await requete;
  if (error) throw error;
  return new Set((data ?? []).map((l) => (l as Record<string, string>)[colonne])).size;
}

/**
 * Mesure de tout ce que le catalogue sait interroger.
 *
 * `total: 0` signifie **non applicable** et non « rien de fait » : une école
 * sans classe ne doit pas lire « 0 classes sur 0 ont leur emploi du temps ».
 * C'est la distinction qui empêche un conseil de complétion de devenir un
 * reproche absurde, et `choisirConseil` s'appuie dessus pour écarter le
 * conseil au lieu de l'afficher à zéro.
 */
export async function diagnostiquer(): Promise<Diagnostic> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const supabase = createClient();
  const etablissementId = ctx.etablissementId;

  const { data: anneeActive, error: erreurAnnee } = await supabase
    .from('annee_scolaire')
    .select('id')
    .eq('etablissementId', etablissementId)
    .eq('statut', 'ACTIVE')
    .maybeSingle();
  if (erreurAnnee) throw erreurAnnee;
  const anneeId = (anneeActive as { id: string } | null)?.id ?? null;

  const [
    classes,
    programme,
    eleves,
    enseignants,
    affectations,
    creneaux,
    typesFrais,
    tarifs,
    bulletins,
  ] = await Promise.all([
    anneeId ? compter('classe', etablissementId, { anneeScolaireId: anneeId }) : 0,
    compter('programme_etablissement', etablissementId),
    compter('eleve', etablissementId),
    compter('enseignant', etablissementId),
    compter('affectation_enseignant', etablissementId),
    anneeId
      ? compter('emploi_du_temps_creneau', etablissementId, { anneeScolaireId: anneeId })
      : 0,
    compter('type_frais', etablissementId),
    anneeId ? compter('tarif_scolaire', etablissementId, { anneeScolaireId: anneeId }) : 0,
    compter('document', etablissementId, { type: 'BULLETIN' }),
  ]);

  // `evaluation` ne porte **pas** d'`etablissementId` — comme `note` et
  // `paiement`. Filtrer dessus ne renverrait pas zéro : la requête échouerait,
  // et c'est précisément ce genre de contrôle muet qui a déjà fait conclure à
  // tort qu'une école n'avait aucune donnée rattachée. On passe par l'année,
  // elle-même scopée.
  let evaluations = 0;
  if (anneeId) {
    const { count, error } = await supabase
      .from('evaluation')
      .select('id', { count: 'exact', head: true })
      .eq('anneeScolaireId', anneeId);
    if (error) throw error;
    evaluations = count ?? 0;
  }

  // `coefficient_matiere` ne porte pas d'`etablissementId` : elle se rattache
  // au programme, lui-même scopé. On passe donc par l'année active.
  let coefficients = 0;
  if (anneeId) {
    const { count, error } = await supabase
      .from('coefficient_matiere')
      .select('id', { count: 'exact', head: true })
      .eq('anneeScolaireId', anneeId);
    if (error) throw error;
    coefficients = count ?? 0;
  }

  const { data: profil, error: erreurProfil } = await supabase
    .from('utilisateur')
    .select('"pinApprobationHash"')
    .eq('id', ctx.userId)
    .maybeSingle();
  if (erreurProfil) throw erreurProfil;
  const pin = Boolean((profil as { pinApprobationHash: string | null } | null)?.pinApprobationHash);

  const { data: parametres, error: erreurParametres } = await supabase
    .from('parametres_document')
    .select('"logoChemin", "filigraneTexte", "filigraneActif"')
    .eq('etablissementId', etablissementId)
    .maybeSingle();
  if (erreurParametres) throw erreurParametres;
  const identite = parametres as {
    logoChemin: string | null;
    filigraneTexte: string | null;
    filigraneActif: boolean | null;
  } | null;

  const { count: equipe, error: erreurEquipe } = await supabase
    .from('utilisateur')
    .select('id', { count: 'exact', head: true })
    .eq('etablissementId', etablissementId)
    .in('role', ['SECRETAIRE', 'COMPTABLE']);
  if (erreurEquipe) throw erreurEquipe;

  const diagnostic: Diagnostic = {
    anneeActive: binaire(anneeId ? 1 : 0),
    classes: binaire(classes),
    programme: binaire(programme),
    coefficients: binaire(coefficients),
    eleves: binaire(eleves),
    enseignants: binaire(enseignants),
    affectations: binaire(affectations),
    evaluations: binaire(evaluations),
    creneaux: binaire(creneaux),
    typesFrais: binaire(typesFrais),
    tarifs: binaire(tarifs),
    bulletins: binaire(bulletins),
    pinDefini: binaire(pin ? 1 : 0),
    logoDefini: binaire(identite?.logoChemin ? 1 : 0),
    filigraneDefini: binaire(identite?.filigraneActif && identite.filigraneTexte ? 1 : 0),
    equipeAdministrative: binaire(equipe ?? 0),
  };

  // ---------------------------------------------------------- complétion --
  // Ces sondes ne sont mesurées que si leur univers existe : sans classe, il
  // n'y a pas d'emploi du temps manquant, il n'y a rien du tout.
  if (anneeId && classes > 0) {
    const [avecEmploiDuTemps, avecTitulaire] = await Promise.all([
      compterDistinct('emploi_du_temps_creneau', 'classeId', etablissementId, {
        anneeScolaireId: anneeId,
      }),
      (async () => {
        // `titularite_classe` ne porte pas d'`etablissementId` : elle se
        // rattache à l'année, elle-même scopée.
        const { data, error } = await supabase
          .from('titularite_classe')
          .select('"classeId"')
          .eq('anneeScolaireId', anneeId);
        if (error) throw error;
        return new Set((data ?? []).map((l) => (l as { classeId: string }).classeId)).size;
      })(),
    ]);
    diagnostic.classesAvecEmploiDuTemps = { fait: avecEmploiDuTemps, total: classes };
    diagnostic.classesAvecProfesseurPrincipal = { fait: avecTitulaire, total: classes };
  }

  if (eleves > 0) {
    // `eleve_responsable` ne porte pas d'`etablissementId` non plus. On borne
    // sur les élèves de l'établissement, seuls visibles sous RLS de toute
    // façon — la comparaison explicite reste une défense en profondeur.
    const { data: liens, error } = await supabase.from('eleve_responsable').select('"eleveId"');
    if (error) throw error;
    const avecResponsable = new Set(
      (liens ?? []).map((l) => (l as { eleveId: string }).eleveId),
    ).size;
    diagnostic.elevesAvecResponsable = { fait: Math.min(avecResponsable, eleves), total: eleves };
  }

  if (anneeId) {
    const { count: total, error: erreurTotal } = await supabase
      .from('facture_eleve')
      .select('id', { count: 'exact', head: true })
      .eq('etablissementId', etablissementId)
      .eq('anneeScolaireId', anneeId)
      .neq('statut', 'ANNULE');
    if (erreurTotal) throw erreurTotal;
    if ((total ?? 0) > 0) {
      const { count: soldees, error: erreurSoldees } = await supabase
        .from('facture_eleve')
        .select('id', { count: 'exact', head: true })
        .eq('etablissementId', etablissementId)
        .eq('anneeScolaireId', anneeId)
        .eq('statut', 'PAYE');
      if (erreurSoldees) throw erreurSoldees;
      diagnostic.facturesSoldees = { fait: soldees ?? 0, total: total ?? 0 };
    }
  }

  return diagnostic;
}

/**
 * Le conseil à proposer sur la page courante, ou `null`.
 *
 * **La garde de fréquence est lue avant le diagnostic**, et c'est ce qui rend
 * la fonctionnalité gratuite la plupart du temps : une vingtaine de comptages
 * à chaque rendu de page mettrait le tableau de bord à genoux, alors qu'un
 * conseil ne sort qu'une fois par jour au plus. La même règle est rejouée dans
 * `choisirConseil`, qui reste ainsi vérifiable seule.
 *
 * Ne lève jamais : un conseil manquant est sans conséquence, une application
 * inaccessible ne l'est pas. Même parti pris que `AbonnementBanner`.
 */
export async function getConseilDuMoment(
  urlCourante: string,
): Promise<ConseilAProposer | null> {
  try {
    const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
    if (!ctx.etablissementId) return null;

    const historique = await lireHistorique(ctx);
    const maintenant = new Date();

    const dernierAffichageLe = historique
      .map((l) => l.vuLe)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? null;

    if (dernierAffichageLe) {
      const ecoule = maintenant.getTime() - new Date(dernierAffichageLe).getTime();
      if (ecoule < HEURES_ENTRE_CONSEILS * 60 * 60 * 1000) return null;
    }

    const acces = await getAccesAbonnementCourant();
    const diagnostic = await diagnostiquer();

    const { data: compte } = await createClient()
      .from('utilisateur')
      .select('"createdAt"')
      .eq('id', ctx.userId)
      .maybeSingle();

    return choisirConseil({
      role: ctx.role,
      diagnostic,
      // Une ligne dont l'identifiant a disparu du catalogue est ignorée :
      // le catalogue est du code et peut retirer un conseil, la base garde
      // sa trace.
      historique: historique
        .filter((l) => PAR_ID.has(l.conseilId as IdConseil))
        .map((l) => ({
          conseilId: l.conseilId as IdConseil,
          statut: l.statut,
          reporteJusquA: l.reporteJusquA,
          relegueLe: l.relegueLe,
          nombreRelegations: l.nombreRelegations,
        })),
      dernierAffichageLe,
      urlCourante,
      ecritureAutorisee: acces.niveau !== 'LECTURE_SEULE' && acces.niveau !== 'BLOQUE',
      maintenant,
      compteCreeLe: (compte as { createdAt: string } | null)?.createdAt ?? null,
    });
  } catch {
    return null;
  }
}

/** Vérifie que l'identifiant vient bien du catalogue avant toute écriture. */
function exigerConseilConnu(conseilId: string): IdConseil {
  if (!PAR_ID.has(conseilId as IdConseil)) {
    throw new Error('Conseil inconnu.');
  }
  return conseilId as IdConseil;
}

async function ecrire(
  ctx: TenantContext,
  conseilId: IdConseil,
  champs: Record<string, unknown>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('conseil_utilisateur').upsert(
    {
      etablissementId: ctx.etablissementId,
      utilisateurId: ctx.userId,
      conseilId,
      ...champs,
    },
    { onConflict: 'etablissementId,utilisateurId,conseilId' },
  );
  if (error) throw error;
}

/**
 * Consigne qu'un conseil a été montré. C'est cette date qui arme le délai de
 * 24 heures — il court à partir de l'affichage, pas de la décision : quelqu'un
 * qui ignore le panneau sans y toucher ne doit pas en recevoir un autre à la
 * page suivante.
 */
export async function marquerConseilVu(conseilId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const id = exigerConseilConnu(conseilId);
  const supabase = createClient();
  const { data } = await supabase
    .from('conseil_utilisateur')
    .select('"nombreVues"')
    .eq('etablissementId', ctx.etablissementId)
    .eq('utilisateurId', ctx.userId)
    .eq('conseilId', id)
    .maybeSingle();
  const vues = (data as { nombreVues: number } | null)?.nombreVues ?? 0;
  await ecrire(ctx, id, { vuLe: new Date().toISOString(), nombreVues: vues + 1 });
}

/** « Plus tard » : le conseil garde sa place et revient dans sept jours. */
export async function reporterConseil(conseilId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const id = exigerConseilConnu(conseilId);
  await ecrire(ctx, id, {
    statut: 'REPORTE',
    reporteJusquA: reportJusquA(new Date()),
  });
}

/**
 * « Pas pour moi » : le conseil part en fin de file.
 *
 * Il ne disparaît pas. Quelqu'un qui écarte l'emploi du temps en septembre
 * peut en avoir besoin en janvier, et un état terminal le lui refuserait pour
 * toujours. Le compteur allonge simplement l'attente à chaque fois.
 */
export async function releguerConseil(conseilId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const id = exigerConseilConnu(conseilId);
  const supabase = createClient();
  const { data } = await supabase
    .from('conseil_utilisateur')
    .select('"nombreRelegations"')
    .eq('etablissementId', ctx.etablissementId)
    .eq('utilisateurId', ctx.userId)
    .eq('conseilId', id)
    .maybeSingle();
  const deja = (data as { nombreRelegations: number } | null)?.nombreRelegations ?? 0;
  await ecrire(ctx, id, {
    statut: 'RELEGUE',
    relegueLe: new Date().toISOString(),
    nombreRelegations: deja + 1,
    reporteJusquA: null,
  });
}

/**
 * L'utilisateur a suivi le lien.
 *
 * Pour un conseil doté d'une sonde, ce statut ne change rien au fond : c'est
 * la donnée créée qui le retirera. Il est en revanche le seul moyen de retirer
 * un conseil de découverte, qui n'a par nature aucune donnée à constater.
 */
export async function suivreConseil(conseilId: string): Promise<void> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const id = exigerConseilConnu(conseilId);
  await ecrire(ctx, id, { statut: 'SUIVI' });
}

export interface LigneAide {
  id: IdConseil;
  titre: string;
  texte: string;
  href: string | null;
  famille: string;
  fait: boolean;
}

/**
 * Tout ce que la plateforme sait faire, avec ce qui est déjà en place.
 *
 * Le panneau propose une chose à la fois, ce qui est bien pour ne pas lasser
 * mais mauvais pour qui veut simplement savoir ce qui existe. Cet inventaire
 * est la réponse à cette seconde question, et il n'a aucun rythme : il ne
 * s'affiche que si on le demande.
 */
export async function listerAide(): Promise<LigneAide[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const diagnostic = await diagnostiquer();
  const historique = await lireHistorique(ctx);
  const suivis = new Set(historique.filter((l) => l.statut === 'SUIVI').map((l) => l.conseilId));

  return CATALOGUE.filter((conseil) => conseil.roles.includes(ctx.role)).map((conseil) => {
    const valeur = conseil.sonde ? diagnostic[conseil.sonde] : undefined;
    return {
      id: conseil.id,
      titre: conseil.titre,
      texte: conseil.texte,
      href: conseil.action?.href ?? null,
      famille: conseil.famille,
      fait: conseil.sonde
        ? Boolean(valeur && valeur.total > 0 && valeur.fait >= valeur.total)
        : suivis.has(conseil.id),
    };
  });
}
