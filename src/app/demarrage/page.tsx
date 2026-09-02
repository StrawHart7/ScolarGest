import { getTenantContext } from '@/services/tenant';
import { getProgressionOnboarding, getBilanOnboarding } from '@/services/onboarding';
import { listCycles, listCyclesActifs, listNiveauxParCycle, listSeriesParCycle } from '@/services/structure';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listMatieres } from '@/services/matiere';
import { listProgramme } from '@/services/programme';
import { baremeOfficiel, listMatieresOfficielles } from '@/services/matiere-officielle';
import { listTypesFrais } from '@/services/type-frais';
import { listTarifs } from '@/services/tarif';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { etapesPourRole, type IdEtape } from '@/lib/onboarding/etapes';
import { FilDemarrage, type DonneesDemarrage } from './FilDemarrage';
import type { NiveauAvecCycle, SerieCycle } from './etapes/EtapeClasses';
import type { LigneProgrammeNiveau } from './etapes/EtapeCoefficients';

export const metadata = { title: 'Démarrage' };

/**
 * Ordre du cursus : cycle d'abord, puis rang du niveau dans son cycle.
 * `niveau.ordre` repart à 1 à chaque cycle — trier dessus seul entrelaçait
 * les cycles (6ème, 2nde, 5ème, 1ère…) au lieu de suivre la scolarité.
 */
function parCursus(a: NiveauAvecCycle, b: NiveauAvecCycle): number {
  return a.cycleOrdre - b.cycleOrdre || a.ordre - b.ordre;
}

export default async function DemarragePage() {
  const ctx = await getTenantContext();
  const definitions = etapesPourRole(ctx.role);

  if (definitions.length === 0) {
    return (
      <AppLayout
        items={getSidebarItems(ctx.role)}
        schoolName="ScolarGest"
        role={ctx.role}
        userName={ctx.email}
      >
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-body-sm text-text-secondary">
              Aucune configuration n&apos;est requise pour votre rôle.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const progression = await getProgressionOnboarding();
  const bilan = await getBilanOnboarding();
  const donnees = await chargerDonnees(
    progression.etapes.some((e) => e.id === 'cycles'),
    ctx.etablissementId,
  );

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Configurer mon établissement</h1>
          <p className="text-body-md text-text-secondary">
            {progression.complete ? (
              // Des étapes facultatives passées restent « non faites » : afficher
              // « 7 sur 9 » à côté de « Configuration terminée » se contredisait.
              <>Toutes les étapes requises sont franchies.</>
            ) : (
              <>
                {progression.nombreFaites} étape{progression.nombreFaites > 1 ? 's' : ''} sur{' '}
                {progression.nombreTotal}. Vous pouvez quitter et reprendre à tout moment.
              </>
            )}
          </p>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container"
            role="progressbar"
            aria-valuenow={progression.nombreFaites}
            aria-valuemin={0}
            aria-valuemax={progression.nombreTotal}
          >
            <div
              className="h-full rounded-full bg-primary-container transition-[width] duration-300"
              style={{
                width: `${(progression.nombreFaites / progression.nombreTotal) * 100}%`,
              }}
            />
          </div>
        </div>

        <FilDemarrage
          definitions={definitions}
          progression={progression}
          donnees={donnees}
          bilan={bilan}
        />
      </div>
    </AppLayout>
  );
}

/**
 * Catalogues nécessaires au fil.
 *
 * Les niveaux et séries ne sont chargés que pour les cycles effectivement
 * activés : ils n'ont pas de sens avant, et l'étape « classes » ne doit
 * proposer que ce que l'établissement enseigne.
 *
 * Le parcours finance (Secrétaire, Comptable) n'a besoin que des classes déjà
 * créées et des types de frais — il ne touche jamais à la structure.
 */
async function chargerDonnees(
  parcoursStructure: boolean,
  etablissementId: string | null,
): Promise<DonneesDemarrage> {
  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE') ?? null;
  const classesBrutes = anneeActive ? await listClasses(anneeActive.id) : [];

  // Les niveaux sont chargés pour les deux parcours, et pas seulement pour la
  // structure : le parcours finance en a besoin pour présenter les tarifs dans
  // l'ordre du cursus. Sans eux, les niveaux tombaient dans l'ordre des classes
  // (5ème avant 6ème), ce qui n'a aucun sens pour qui saisit des montants.
  const cyclesActifs = await listCyclesActifs();
  const niveaux: NiveauAvecCycle[] = [];
  const series: SerieCycle[] = [];
  for (const actif of cyclesActifs) {
    const [niveauxDuCycle, seriesDuCycle] = await Promise.all([
      listNiveauxParCycle(actif.cycleId),
      listSeriesParCycle(actif.cycleId),
    ]);
    for (const niveau of niveauxDuCycle) {
      niveaux.push({ ...niveau, cycleNom: actif.cycle.nom, cycleOrdre: actif.cycle.ordre });
    }
    for (const serie of seriesDuCycle) {
      series.push({ id: serie.id, nom: serie.nom, cycleId: serie.cycleId });
    }
  }
  const rangNiveau = new Map(niveaux.map((n) => [n.id, n.cycleOrdre * 100 + n.ordre]));

  const classes = classesBrutes
    .map((c) => ({
      id: c.id,
      nom: c.nom,
      niveauId: c.niveauId,
      niveauNom: c.niveau.nom,
      rang: rangNiveau.get(c.niveauId) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.rang - b.rang || a.nom.localeCompare(b.nom, 'fr'));

  const base: DonneesDemarrage = {
    cycles: [],
    cyclesActifs: [],
    cyclesActifsNoms: [],
    niveaux: [],
    niveauxUtilises: [],
    series: [],
    seriesParId: {},
    matieres: [],
    lignesProgramme: [],
    matieresOfficielles: [],
    programmeDefini: false,
    classes,
    typesFrais: [],
    anneeScolaireId: anneeActive?.id ?? null,
    etablissementId,
    resumes: {},
  };

  if (!parcoursStructure) {
    // Parcours finance.
    const typesFrais = await listTypesFrais();
    const tarifs = anneeActive ? await listTarifs(anneeActive.id) : [];
    const resumes: Partial<Record<IdEtape, string>> = {};
    if (typesFrais.length > 0) {
      resumes['types-frais'] = typesFrais.map((t) => t.nom).join(', ');
    }
    if (tarifs.length > 0) {
      resumes.tarifs = `${tarifs.length} tarif${tarifs.length > 1 ? 's' : ''} enregistré${tarifs.length > 1 ? 's' : ''}`;
    }
    return {
      ...base,
      typesFrais: typesFrais.map((t) => ({ id: t.id, nom: t.nom })),
      resumes,
    };
  }

  const cycles = await listCycles();
  const matieres = await listMatieres();

  // Le périmètre réel de l'école : seuls les niveaux portant au moins une
  // classe sont « enseignés ». Rien d'autre ne matérialise cette information
  // en base — c'est aussi ainsi qu'elle se retrouve à la reprise du parcours.
  const niveauxUtilises = niveaux.filter((n) => classes.some((c) => c.niveauId === n.id));

  // Catalogue officiel des cycles activés. Remplace la liste en dur : les
  // matières proposées sont désormais celles du programme national, avec leur
  // code — c'est ce code qui rattachera ensuite le barème.
  const catalogue = new Map<string, { nom: string; code: string; parDefaut: boolean }>();
  for (const actif of cyclesActifs) {
    for (const m of await listMatieresOfficielles(actif.cycleId)) {
      const existante = catalogue.get(m.codeEcole);
      // Une matière coefficientée dans l'un des cycles de l'école le reste
      // globalement : le tronc commun prime sur l'option.
      if (!existante || (!existante.parDefaut && m.aCoefficientOfficiel)) {
        catalogue.set(m.codeEcole, {
          nom: m.nom,
          code: m.codeEcole,
          parDefaut: m.aCoefficientOfficiel,
        });
      }
    }
  }
  const matieresOfficielles = [...catalogue.values()];

  const lignesProgramme: LigneProgrammeNiveau[] = [];
  // Distinct du nombre de lignes restantes : le programme peut etre defini et
  // entierement couvert par le bareme national.
  let programmeDefini = false;
  // Compte les associations reelles : `lignesProgramme` ne retient que celles
  // qui restent a coefficienter, et servirait un resume faux.
  let nombreAssociations = 0;
  for (const niveau of niveauxUtilises) {
    const programme = await listProgramme(niveau.id);
    if (programme.length > 0) programmeDefini = true;
    nombreAssociations += programme.length;
    // Seules les séries que l'établissement utilise réellement, déduites de
    // ses classes — proposer les six séries du catalogue alors que l'école
    // n'en ouvre que deux noyait la grille sous des colonnes inutiles.
    const serieIds = [
      ...new Set(
        classesBrutes
          .filter((c) => c.niveauId === niveau.id && c.serieId)
          .map((c) => c.serieId as string),
      ),
    ];

    // Le barème du ministère, par série. Ce que l'État fixe n'a pas à être
    // demandé au Directeur : ne restent dans l'étape que les matières et les
    // séries qu'il lui appartient réellement d'arbitrer.
    const cibles: (string | null)[] = serieIds.length > 0 ? serieIds : [null];
    const baremes = new Map<string, Map<string, number>>();
    for (const cible of cibles) {
      baremes.set(cible ?? '', await baremeOfficiel(niveau.id, cible));
    }

    for (const item of programme) {
      const code = item.matiere.code;
      const serieIdsASaisir = cibles.filter(
        (cible) => !(code && baremes.get(cible ?? '')?.has(code)),
      );
      // Toutes les séries couvertes : la ligne disparaît du questionnaire.
      if (serieIdsASaisir.length === 0) continue;

      lignesProgramme.push({
        programmeEtablissementId: item.id,
        niveauId: niveau.id,
        niveauNom: niveau.nom,
        matiereNom: item.matiere.nom,
        serieIds: serieIdsASaisir.filter((s): s is string => s !== null),
      });
    }
  }

  const resumes: Partial<Record<IdEtape, string>> = {
    pin: 'Code de confirmation défini',
  };
  if (anneeActive) resumes['annee-scolaire'] = `Année ${anneeActive.libelle}`;
  if (cyclesActifs.length > 0) {
    resumes.cycles = cyclesActifs.map((c) => c.cycle.nom).join(', ');
  }
  if (classes.length > 0) {
    resumes.classes = `${classes.length} classe${classes.length > 1 ? 's' : ''}`;
  }
  if (matieres.length > 0) {
    resumes.matieres = `${matieres.length} matière${matieres.length > 1 ? 's' : ''}`;
  }
  if (nombreAssociations > 0) {
    resumes.programme = `${nombreAssociations} association${nombreAssociations > 1 ? 's' : ''}`;
    resumes.coefficients =
      lignesProgramme.length === 0
        ? 'Barème national appliqué'
        : `${lignesProgramme.length} à saisir`;
  }

  return {
    ...base,
    cycles,
    cyclesActifs: cyclesActifs.map((c) => c.cycleId),
    cyclesActifsNoms: cyclesActifs.map((c) => c.cycle.nom),
    niveaux: [...niveaux].sort(parCursus),
    niveauxUtilises: [...niveauxUtilises].sort(parCursus),
    series,
    seriesParId: Object.fromEntries(series.map((s) => [s.id, s.nom])),
    matieres: matieres.map((m) => ({ id: m.id, nom: m.nom })),
    lignesProgramme,
    matieresOfficielles,
    programmeDefini,
    resumes,
  };
}
