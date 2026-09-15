import Link from 'next/link';
import { Users2, School } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getClasse } from '@/services/classe';
import { listElevesInscritsClasse } from '@/services/eleve';
import { listProgramme } from '@/services/programme';
import { listEnseignants } from '@/services/enseignant';
import { listCreneauxClasse } from '@/services/emploi-du-temps';
import { getResultatsClasse } from '@/services/resultats-classe';
import { listSuiviPaiements, totauxSuivi } from '@/services/facture';
import type { Periode } from '@/services/evaluation';
import { SEUIL_REUSSITE } from '@/lib/statistiques';
import { JOURS, RANGS, type Creneau } from '@/lib/emploi-du-temps';

/** Les trimestres, nommés comme l'école les nomme. */
const LIBELLE_PERIODE: Record<Periode, string> = {
  TRIMESTRE_1: '1er trimestre',
  TRIMESTRE_2: '2e trimestre',
  TRIMESTRE_3: '3e trimestre',
};
import { GrilleEmploiDuTemps } from './GrilleEmploiDuTemps';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSidebarItems } from '@/lib/navigation';

export default async function ClasseDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const classe = await getClasse(params.id);
  // L'ecran affichait « arrive en Phase 2 » : un reliquat de la Phase 1 que
  // personne n'a repris quand les inscriptions ont ete livrees. Elles
  // fonctionnent depuis, seule cette carte l'ignorait.
  //
  // `getClasse` accepte le COMPTABLE, pas `listElevesInscritsClasse` : appeler
  // sans conditionner ferait echouer toute la page pour ce role. On restreint
  // ici plutot que d'elargir la garde du service.
  const peutVoirEleves =
    ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE' || ctx.role === 'ENSEIGNANT';
  const eleves = peutVoirEleves
    ? await listElevesInscritsClasse(classe.id, classe.anneeScolaireId)
    : [];

  // L'emploi du temps suit la meme regle que les eleves : lisible par ceux qui
  // font tourner la classe, modifiable par la direction et le secretariat.
  // Les matieres proposees sont celles du programme du niveau — placer une
  // matiere hors programme produirait un emploi du temps que le bulletin
  // ignorerait.
  let creneaux: Creneau[] = [];
  let matieres: { id: string; nom: string }[] = [];
  let enseignants: { id: string; nom: string; prenoms: string }[] = [];
  if (peutVoirEleves) {
    const [c, programme, ens] = await Promise.all([
      listCreneauxClasse(classe.id, classe.anneeScolaireId),
      listProgramme(classe.niveauId),
      listEnseignants({ statut: 'ACTIF' }),
    ]);
    creneaux = c;
    matieres = programme.map((p) => ({ id: p.matiereId, nom: p.matiere.nom }));
    enseignants = ens.map((e) => ({ id: e.id, nom: e.nom, prenoms: e.prenoms }));
  }
  const peutModifierEmploiDuTemps = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';

  /**
   * « Comment s'en sort la 3ème ? » est l'une des quatre questions que pose un
   * directeur, et l'écran qui porte le nom de la classe n'y répondait pas : il
   * montrait la liste des élèves et l'emploi du temps. Ni moyenne, ni impayé.
   *
   * **Les trois trimestres sont lus, et c'est le plus récent qui porte des
   * notes qui est affiché.** Figer le premier trimestre afficherait un chiffre
   * faux de janvier à juillet ; deviner la période à partir de la date
   * supposerait un calendrier scolaire que le produit ne connaît pas. La donnée
   * elle-même tranche, et l'écran dit de quel trimestre il parle.
   *
   * Les moyennes viennent de `getResultatsClasse`, le même calcul que l'écran
   * « Moyennes & classement ». Recalculer ici, même à l'identique, ferait courir
   * le risque d'afficher 11,2 là où l'autre écran affiche 11,4 — et détruirait
   * la confiance dans les deux.
   */
  const PERIODES: Periode[] = ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3'];
  let bilan: { periode: Periode; moyenne: number; evalues: number; reussite: number } | null = null;
  if (peutVoirEleves && eleves.length > 0) {
    const resultats = await Promise.all(
      PERIODES.map((p) =>
        getResultatsClasse(classe.id, p, classe.anneeScolaireId).catch(() => null),
      ),
    );
    for (let i = PERIODES.length - 1; i >= 0; i -= 1) {
      const r = resultats[i];
      const notes = (r?.eleves ?? [])
        .map((e) => e.moyenneTrimestrielle)
        .filter((m): m is number => m !== null);
      if (notes.length === 0) continue;
      bilan = {
        periode: PERIODES[i] as Periode,
        moyenne: notes.reduce((s, m) => s + m, 0) / notes.length,
        evalues: notes.length,
        reussite: Math.round(
          (notes.filter((m) => m >= SEUIL_REUSSITE).length / notes.length) * 100,
        ),
      };
      break;
    }
  }

  // Le recouvrement de la classe, avec le même service que le suivi des
  // paiements. Le COMPTABLE y a droit, l'ENSEIGNANT non.
  const peutVoirFinance =
    ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE' || ctx.role === 'COMPTABLE';
  const finance = peutVoirFinance
    ? totauxSuivi(
        await listSuiviPaiements(classe.anneeScolaireId, { classeId: classe.id }).catch(() => []),
      )
    : null;

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <LienRetour href={`/etablissement/classes?anneeScolaireId=${classe.anneeScolaireId}`}>Retour aux classes</LienRetour>

        <Card>
          <CardContent className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
                  <School className="h-7 w-7" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h1 className="text-display-sm text-text-primary">{classe.nom}</h1>
                  <p className="text-body-sm text-text-secondary">
                    {classe.niveau.nom}
                    {classe.serie ? ` — Série ${classe.serie.nom}` : ''}
                  </p>
                </div>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/etablissement/classes/${classe.id}/affectations`}>Affectations</Link>
              </Button>
            </div>

            {/* La réponse d'abord, le dossier ensuite. Effectif, niveau
                scolaire et recouvrement tiennent sur une rangée ; c'est ce
                qu'on vient chercher en ouvrant une classe. */}
            {(bilan || finance || eleves.length > 0) && (
              <dl className="grid grid-cols-2 gap-4 border-t border-surface-border pt-4 text-body-sm lg:grid-cols-4">
                <div>
                  <dt className="text-text-secondary">Élèves inscrits</dt>
                  <dd className="text-display-sm text-text-primary" data-mono>
                    {eleves.length}
                    {classe.capacite ? (
                      <span className="text-body-sm text-text-secondary"> / {classe.capacite}</span>
                    ) : null}
                  </dd>
                </div>
                {bilan ? (
                  <>
                    <div>
                      <dt className="text-text-secondary">
                        Moyenne — {LIBELLE_PERIODE[bilan.periode]}
                      </dt>
                      <dd className="text-display-sm text-text-primary" data-mono>
                        {bilan.moyenne.toFixed(2).replace('.', ',')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-secondary">Au-dessus de 10</dt>
                      <dd className="text-display-sm text-text-primary" data-mono>
                        {bilan.reussite} %
                        <span className="text-body-sm text-text-secondary">
                          {' '}
                          sur {bilan.evalues} évalué{bilan.evalues > 1 ? 's' : ''}
                        </span>
                      </dd>
                    </div>
                  </>
                ) : (
                  <div className="col-span-1 lg:col-span-2">
                    <dt className="text-text-secondary">Résultats</dt>
                    <dd className="text-body-md text-text-secondary">
                      Aucune note saisie pour l’instant.
                    </dd>
                  </div>
                )}
                {finance ? (
                  <div>
                    <dt className="text-text-secondary">Reste à recouvrer</dt>
                    <dd
                      className={
                        finance.solde > 0
                          ? 'text-display-sm text-warning'
                          : 'text-display-sm text-text-primary'
                      }
                      data-mono
                    >
                      {Number(finance.solde).toLocaleString('fr-FR')}
                      <span className="text-body-sm text-text-secondary"> FCFA</span>
                    </dd>
                  </div>
                ) : null}
              </dl>
            )}

            <dl className="grid grid-cols-1 gap-4 border-t border-surface-border pt-4 text-body-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-secondary">Capacité</dt>
                <dd className="text-text-primary" data-mono>
                  {classe.capacite ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Créée le</dt>
                <dd className="text-text-primary" data-mono>
                  {new Date(classe.createdAt).toLocaleDateString('fr-FR')}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Élèves inscrits
              <span className="ml-2 text-body-sm font-normal text-text-secondary" data-mono>
                {eleves.length}
              </span>
            </CardTitle>
          </CardHeader>
          {eleves.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Users2 className="h-8 w-8 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">
                {peutVoirEleves
                  ? "Aucun élève inscrit dans cette classe pour l'année en cours."
                  : 'La liste des élèves inscrits est réservée à la direction et au secrétariat.'}
              </p>
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <ul className="divide-y divide-surface-border">
                {eleves.map((eleve) => (
                  <li key={eleve.id}>
                    <Link
                      href={`/etablissement/eleves/${eleve.id}`}
                      className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-primary-fixed/40"
                    >
                      <span className="min-w-0 truncate text-body-md text-text-primary">
                        {eleve.nom} {eleve.prenoms}
                      </span>
                      <span className="shrink-0 text-body-sm text-text-secondary" data-mono>
                        {eleve.matricule}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>

        {peutVoirEleves && (
          <Card>
            <CardHeader>
              <CardTitle>Emploi du temps</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <GrilleEmploiDuTemps
                classeId={classe.id}
                anneeScolaireId={classe.anneeScolaireId}
                creneaux={creneaux}
                matieres={matieres}
                enseignants={enseignants}
                jours={JOURS}
                rangs={RANGS}
                modifiable={peutModifierEmploiDuTemps}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
