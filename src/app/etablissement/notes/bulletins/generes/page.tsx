import Link from 'next/link';
import { FileText, Users2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { listElevesInscritsClasse } from '@/services/eleve';
import { listBulletinsClasse } from '@/services/document';
import type { Periode } from '@/services/evaluation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSidebarItems } from '@/lib/navigation';
import { BulletinsFiltres } from '../BulletinsFiltres';
import { BulletinsGeneresListe, type LigneBulletin } from './BulletinsGeneresListe';

/**
 * Bulletins prêts d'une classe, pour une période.
 *
 * L'écran de génération ne montrait que les élèves à traiter, jamais ce qui
 * avait déjà été produit : le PDF s'ouvrait dans un onglet et disparaissait de
 * l'application. On ne pouvait donc pas répondre à la seule question qu'on se
 * pose ici — « qui n'a pas encore son bulletin ? » — et on régénérait à
 * l'aveugle, ce qui empile les documents et brouille lequel fait foi.
 *
 * La liste part des **élèves inscrits**, pas des documents : un élève sans
 * bulletin doit apparaître, c'est même l'information la plus utile de l'écran.
 */
export default async function BulletinsGeneresPage({
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

  const parametres = new URLSearchParams();
  if (anneeScolaireId) parametres.set('anneeScolaireId', anneeScolaireId);
  if (classeId) parametres.set('classeId', classeId);
  parametres.set('periode', periode);

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-display-sm text-text-primary">Bulletins prêts</h1>
            <p className="hidden text-body-sm text-text-secondary md:block">
              Bulletins prêts pour la classe et le trimestre sélectionnés, avec leur référence
              et leur date. Les élèves dont le bulletin manque y figurent aussi.
            </p>
          </div>
          <Button asChild size="sm" variant="secondary" className="w-full md:w-auto">
            <Link href={`/etablissement/notes/bulletins?${parametres.toString()}`}>
              <FileText className="h-4 w-4" aria-hidden />
              Générer des bulletins
            </Link>
          </Button>
        </div>

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <div className="border-b border-surface-border px-1 py-3 md:p-4">
            <BulletinsFiltres
              annees={annees.map((a) => ({ id: a.id, libelle: a.libelle }))}
              classes={classes.map((c) => ({ id: c.id, nom: c.nom }))}
              defaultAnneeScolaireId={anneeScolaireId ?? ''}
              defaultClasseId={classeId ?? ''}
              defaultPeriode={periode}
              basePath="/etablissement/notes/bulletins/generes"
            />
          </div>

          {!anneeScolaireId || !classeId ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Users2 className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">
                {classes.length === 0
                  ? 'Aucune classe disponible pour cette année scolaire.'
                  : 'Sélectionnez une classe pour afficher les bulletins prêts.'}
              </p>
            </CardContent>
          ) : (
            <Liste
              classeId={classeId}
              periode={periode}
              anneeScolaireId={anneeScolaireId}
              libelleClasse={classes.find((c) => c.id === classeId)?.nom ?? 'classe'}
            />
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

async function Liste({
  classeId,
  periode,
  anneeScolaireId,
  libelleClasse,
}: {
  classeId: string;
  periode: Periode;
  anneeScolaireId: string;
  libelleClasse: string;
}) {
  const [eleves, documents] = await Promise.all([
    listElevesInscritsClasse(classeId, anneeScolaireId),
    listBulletinsClasse(classeId, periode),
  ]);

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

  // Les documents arrivent triés du plus récent au plus ancien. Le bulletin en
  // vigueur est celui en statut GENERE ; les autres sont les versions qu'une
  // régénération a remplacées, conservées en stockage (jamais de suppression
  // dure) et comptées ici pour que la régénération reste visible.
  const parEleve = new Map<string, { courant: (typeof documents)[number] | null; remplacees: number }>();
  for (const doc of documents) {
    const entree = parEleve.get(doc.eleveId) ?? { courant: null, remplacees: 0 };
    if (doc.statut === 'GENERE' && entree.courant === null) {
      entree.courant = doc;
    } else {
      entree.remplacees += 1;
    }
    parEleve.set(doc.eleveId, entree);
  }

  const lignes: LigneBulletin[] = eleves.map((eleve) => {
    const entree = parEleve.get(eleve.id);
    return {
      eleveId: eleve.id,
      nom: eleve.nom,
      prenoms: eleve.prenoms,
      matricule: eleve.matricule,
      courant: entree?.courant
        ? {
            documentId: entree.courant.documentId,
            reference: entree.courant.reference,
            dateGeneration: entree.courant.dateGeneration,
          }
        : null,
      versionsRemplacees: entree?.remplacees ?? 0,
    };
  });

  return (
    <BulletinsGeneresListe
      lignes={lignes}
      classeId={classeId}
      periode={periode}
      anneeScolaireId={anneeScolaireId}
      libelleClasse={libelleClasse}
    />
  );
}
