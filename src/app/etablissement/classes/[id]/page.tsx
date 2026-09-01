import Link from 'next/link';
import { ArrowLeft, Users2, School } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getClasse } from '@/services/classe';
import { listElevesInscritsClasse } from '@/services/eleve';
import { listProgramme } from '@/services/programme';
import { listEnseignants } from '@/services/enseignant';
import {
  listCreneauxClasse,
  JOURS,
  RANGS,
  type Creneau,
} from '@/services/emploi-du-temps';
import { GrilleEmploiDuTemps } from './GrilleEmploiDuTemps';
import { AppLayout } from '@/components/layout/AppLayout';
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

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href={`/etablissement/classes?anneeScolaireId=${classe.anneeScolaireId}`}
          className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour aux classes
        </Link>

        <Card>
          <CardContent className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
                  <School className="h-7 w-7" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-headline-sm text-text-primary">{classe.nom}</p>
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
