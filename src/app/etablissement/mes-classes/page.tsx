import { GraduationCap } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listMesAffectations } from '@/services/affectation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSidebarItems } from '@/lib/navigation';

export default async function MesClassesPage() {
  const ctx = await getTenantContext();

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Mes classes</h1>
          <p className="text-body-sm text-text-secondary">
            Aperçu de vos classes et matières affectées pour l&apos;année scolaire active.
          </p>
        </div>

        {ctx.role !== 'ENSEIGNANT' ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <GraduationCap className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">
                Cette page est réservée aux comptes enseignants.
              </p>
            </CardContent>
          </Card>
        ) : (
          <MesClassesContent />
        )}
      </div>
    </AppLayout>
  );
}

async function MesClassesContent() {
  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');

  if (!anneeActive) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <GraduationCap className="h-10 w-10 text-text-secondary/50" aria-hidden />
          <p className="text-body-sm text-text-secondary">Aucune année scolaire active.</p>
        </CardContent>
      </Card>
    );
  }

  const affectations = await listMesAffectations(anneeActive.id);

  if (affectations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <GraduationCap className="h-10 w-10 text-text-secondary/50" aria-hidden />
          <p className="text-body-sm text-text-primary">Aucune affectation pour le moment.</p>
          <p className="text-body-sm text-text-secondary">
            Contactez votre établissement si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
          </p>
        </CardContent>
      </Card>
    );
  }

  const parClasse = new Map<string, { nom: string; matieres: string[] }>();
  for (const a of affectations) {
    const existing = parClasse.get(a.classeId);
    if (existing) {
      existing.matieres.push(a.matiere.nom);
    } else {
      parClasse.set(a.classeId, { nom: a.classe.nom, matieres: [a.matiere.nom] });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3">
      {Array.from(parClasse.entries()).map(([classeId, info]) => (
        <Card key={classeId}>
          <CardContent className="flex flex-col gap-3 p-5">
            <p className="text-headline-sm text-text-primary">{info.nom}</p>
            <div className="flex flex-wrap gap-2">
              {info.matieres.map((m) => (
                <Badge key={m} variant="primary" shape="pill">
                  {m}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
