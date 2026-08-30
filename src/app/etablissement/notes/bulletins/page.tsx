import { Users2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listElevesInscritsClasse } from '@/services/eleve';
import type { Periode } from '@/services/evaluation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { getParametresDocument } from '@/services/parametres-document';
import { InviteIdentiteDocuments } from '@/components/documents/InviteIdentiteDocuments';
import { BulletinsFiltres } from './BulletinsFiltres';
import { BulletinsListe } from './BulletinsListe';

// La génération d'une classe entière enchaîne un rendu Chromium par élève :
// la fenêtre serverless par défaut (10s) est largement dépassée. On demande le
// maximum courant. Plan Hobby : plafonné à 60s ; Pro/Enterprise : jusqu'à 300s.
export const maxDuration = 60;

export default async function BulletinsPage({
  searchParams,
}: {
  searchParams: { classeId?: string; periode?: Periode; anneeScolaireId?: string };
}) {
  const ctx = await getTenantContext();

  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = searchParams.anneeScolaireId || anneeActive?.id || annees[0]?.id;
  const periode: Periode = searchParams.periode ?? 'TRIMESTRE_1';

  const classes = anneeScolaireId ? await listClasses(anneeScolaireId) : [];
  const classeId = searchParams.classeId || classes[0]?.id;

  // Proposé une seule fois, et seulement à la direction : elle seule peut
  // enregistrer le logo et le filigrane.
  const parametresDocument = await getParametresDocument();
  const proposerIdentite = ctx.role === 'DIRECTEUR' && !parametresDocument.dejaConfigure;

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Génération de bulletins</h1>
          {/* Description réservée au desktop : sur mobile elle poussait la liste
              hors du premier écran. */}
          <p className="hidden text-body-sm text-text-secondary md:block">
            Sélectionnez une classe et une période pour générer les bulletins trimestriels des élèves
            inscrits. Assurez-vous que les notes du trimestre concerné ont été saisies et approuvées
            avant de générer.
          </p>
        </div>

        {proposerIdentite && <InviteIdentiteDocuments />}

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <div className="border-b border-surface-border px-1 py-3 md:p-4">
            <BulletinsFiltres
              annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
              classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
              defaultAnneeScolaireId={anneeScolaireId ?? ''}
              defaultClasseId={classeId ?? ''}
              defaultPeriode={periode}
            />
          </div>

          {!anneeScolaireId || !classeId ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Users2 className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">
                {classes.length === 0
                  ? 'Aucune classe disponible pour cette année scolaire.'
                  : 'Sélectionnez une classe pour afficher les élèves.'}
              </p>
            </CardContent>
          ) : (
            <ElevesListe classeId={classeId} periode={periode} anneeScolaireId={anneeScolaireId} />
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

async function ElevesListe({
  classeId,
  periode,
  anneeScolaireId,
}: {
  classeId: string;
  periode: Periode;
  anneeScolaireId: string;
}) {
  const eleves = await listElevesInscritsClasse(classeId, anneeScolaireId);

  if (eleves.length === 0) {
    return (
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <Users2 className="h-10 w-10 text-text-secondary/50" aria-hidden />
        <p className="text-body-sm text-text-secondary">
          Aucun élève inscrit (statut ACTIF) dans cette classe pour cette année scolaire.
        </p>
      </CardContent>
    );
  }

  return (
    <BulletinsListe
      eleves={eleves.map((e) => ({ id: e.id, nom: e.nom, prenoms: e.prenoms, matricule: e.matricule }))}
      classeId={classeId}
      periode={periode}
      anneeScolaireId={anneeScolaireId}
    />
  );
}
