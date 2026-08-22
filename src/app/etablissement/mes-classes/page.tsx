import { GraduationCap } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listMesAffectations } from '@/services/affectation';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CarteListeMobile,
  EnteteListe,
  LigneCarteMobile,
} from '@/components/ui/carte-liste-mobile';
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
      <div className="space-y-4 md:space-y-6">
        {/* Sur mobile, le titre descend dans la ligne de densité au-dessus de
            la liste : le PageHeader est réservé au desktop. */}
        <div className="hidden md:block">
          <PageHeader
            title="Mes classes"
            description="Aperçu de vos classes et matières affectées pour l'année scolaire active."
          />
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

  const classes = Array.from(parClasse.entries());

  return (
    <>
      <EnteteListe
        titre="Mes classes"
        compte={`${classes.length} classe${classes.length > 1 ? 's' : ''}`}
      />

      {/* Desktop : la grille de cartes, chaque matière en pastille. */}
      <div className="hidden grid-cols-1 gap-gutter sm:grid-cols-2 md:grid lg:grid-cols-3">
        {classes.map(([classeId, info]) => (
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

      {/* Mobile : le motif de liste de référence, matières en sous-titre. */}
      <CarteListeMobile>
        {classes.map(([classeId, info]) => (
          <LigneCarteMobile
            key={classeId}
            icone={GraduationCap}
            titre={info.nom}
            sousTitre={info.matieres.join(' · ')}
            valeurSecondaire={`${info.matieres.length} mat.`}
          />
        ))}
      </CarteListeMobile>
    </>
  );
}
