import Link from 'next/link';
import { ArrowLeft, UserCircle2, BookOpen } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getEnseignant } from '@/services/enseignant';
import { listAffectationsEnseignant } from '@/services/affectation';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSidebarItems } from '@/lib/navigation';
import { DesactiverEnseignantButton } from './EnseignantActions';

const STATUT_BADGE: Record<string, { label: string; variant: 'success' | 'neutral' | 'warning' }> = {
  ACTIF: { label: 'Actif', variant: 'success' },
  INACTIF: { label: 'Inactif', variant: 'neutral' },
  CONGE: { label: 'Congé', variant: 'warning' },
  DEPART: { label: 'Départ', variant: 'neutral' },
};

export default async function FicheEnseignantPage({ params }: { params: { id: string } }) {
  const [ctx, enseignant, annees] = await Promise.all([
    getTenantContext(),
    getEnseignant(params.id),
    listAnneesScolaires(),
  ]);
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const affectations = anneeActive
    ? await listAffectationsEnseignant(params.id, anneeActive.id)
    : [];
  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/etablissement/enseignants"
          className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour aux enseignants
        </Link>

        <Card>
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
                <UserCircle2 className="h-8 w-8" aria-hidden />
              </div>
              <div>
                <p className="text-headline-sm text-text-primary">
                  {enseignant.nom} {enseignant.prenoms}
                </p>
                <p className="text-body-sm text-text-secondary" data-mono>
                  Matricule : {enseignant.matricule}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUT_BADGE[enseignant.statut]?.variant ?? 'neutral'} shape="pill">
                {STATUT_BADGE[enseignant.statut]?.label ?? enseignant.statut}
              </Badge>
              {canWrite && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/etablissement/enseignants/${enseignant.id}/affectations`}>
                    Gérer les affectations
                  </Link>
                </Button>
              )}
              {canWrite && enseignant.statut === 'ACTIF' && (
                <DesactiverEnseignantButton enseignantId={enseignant.id} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-body-sm">
              <div>
                <dt className="text-text-secondary">Sexe</dt>
                <dd className="text-text-primary">{enseignant.sexe === 'M' ? 'Masculin' : 'Féminin'}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Date de naissance</dt>
                <dd className="text-text-primary" data-mono>
                  {enseignant.dateNaissance
                    ? new Date(enseignant.dateNaissance).toLocaleDateString('fr-FR')
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Téléphone</dt>
                <dd className="text-text-primary">{enseignant.telephone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Email</dt>
                <dd className="text-text-primary">{enseignant.email ?? '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-text-secondary">Adresse</dt>
                <dd className="text-text-primary">{enseignant.adresse ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Date d&apos;embauche</dt>
                <dd className="text-text-primary" data-mono>
                  {enseignant.dateEmbauche
                    ? new Date(enseignant.dateEmbauche).toLocaleDateString('fr-FR')
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Ancien matricule</dt>
                <dd className="text-text-primary" data-mono>
                  {enseignant.ancienMatricule ?? '—'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Affectations {anneeActive ? `— ${anneeActive.libelle}` : ''}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!anneeActive ? (
              <p className="text-body-sm text-text-secondary">Aucune année scolaire active.</p>
            ) : affectations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <BookOpen className="h-8 w-8 text-text-secondary/50" aria-hidden />
                <p className="text-body-sm text-text-secondary">
                  Aucune affectation pour l&apos;année en cours.
                </p>
              </div>
            ) : (
              affectations.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-surface-border p-3"
                >
                  <div>
                    <p className="text-body-md text-text-primary">{a.classe.nom}</p>
                    <p className="text-body-sm text-text-secondary">{a.matiere.nom}</p>
                  </div>
                </div>
              ))
            )}
            <p className="text-body-sm text-text-secondary">
              La titularité de classe est gérée depuis{' '}
              <Link
                href={`/etablissement/enseignants/${enseignant.id}/affectations`}
                className="text-primary-container hover:underline"
              >
                l&apos;écran des affectations
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
