import Link from 'next/link';
import { CalendarRange, School } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getEleve } from '@/services/eleve';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { listClasses } from '@/services/classe';
import { getInscriptionEleve } from '@/services/inscription';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EtatVide } from '@/components/ui/etat-vide';
import { getSidebarItems } from '@/lib/navigation';
import { InscriptionForm } from './InscriptionForm';

export default async function InscriptionPage({ params }: { params: { id: string } }) {
  const [ctx, eleve, annees] = await Promise.all([
    getTenantContext(),
    getEleve(params.id),
    listAnneesScolaires(),
  ]);
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const [classes, inscription] = anneeActive
    ? await Promise.all([
        listClasses(anneeActive.id),
        getInscriptionEleve(params.id, anneeActive.id),
      ])
    : [[], null];

  // Une ligne d'inscription existe-t-elle déjà pour l'année active, **quel que
  // soit son statut** ? La contrainte `unique(eleveId, anneeScolaireId)` en
  // interdit une seconde : cet écran ne peut alors pas inscrire, il ne peut que
  // changer la classe de celle-là. C'est le mur que le testeur a rencontré le
  // 2026-09-15 en annulant une inscription puis en cliquant « Inscrire ».
  const changement = inscription
    ? {
        id: inscription.id,
        classeId: inscription.classeId,
        annulee: inscription.statut !== 'ACTIVE',
      }
    : null;
  const classeActuelle = inscription
    ? classes.find((c) => c.id === inscription.classeId)?.nom
    : undefined;

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <LienRetour href={`/etablissement/eleves/${params.id}`}>
          Retour à la fiche de l&apos;élève
        </LienRetour>

        <div>
          <h1 className="text-display-sm text-text-primary">
            {changement ? 'Changer de classe' : 'Inscription en classe'}
          </h1>
          <p className="text-body-sm text-text-secondary">
            {eleve.nom} {eleve.prenoms} — <span data-mono>{eleve.matricule}</span>
          </p>
          {/* Dire d'où l'on part. Sans cela, le directeur doit se souvenir de
              la classe qu'il croyait avoir saisie — et c'est précisément parce
              qu'il s'en est méfié qu'il est ici. */}
          {changement && (
            <p className="mt-1 text-body-sm text-text-secondary">
              {changement.annulee
                ? `Inscription annulée${classeActuelle ? ` en ${classeActuelle}` : ''}. Choisissez la classe pour la réactiver.`
                : `Actuellement en ${classeActuelle ?? 'classe inconnue'}.`}
            </p>
          )}
        </div>

        {/* Ni l'un ni l'autre n'est une erreur : le Directeur n'a rien cassé,
            il n'a pas encore configuré. Le rouge inquiète sans rien proposer —
            même raison que pour la bannière hors-ligne. Et les deux écrans
            portent désormais le geste au lieu de le nommer. */}
        {!anneeActive ? (
          <Card>
            <CardContent>
              <EtatVide
                icone={CalendarRange}
                titre="Aucune année scolaire n’est ouverte"
                explication="Une inscription se rattache à une année : il en faut une active avant de continuer."
                action={
                  <Button asChild variant="primary">
                    <Link href="/etablissement/annees-scolaires">Ouvrir une année scolaire</Link>
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : classes.length === 0 ? (
          <Card>
            <CardContent>
              <EtatVide
                icone={School}
                titre="Aucune classe sur cette année"
                explication="Créez la classe dans laquelle vous voulez inscrire cet élève, puis revenez ici."
                action={
                  <Button asChild variant="primary">
                    <Link href="/etablissement/classes">Créer une classe</Link>
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Année active : {anneeActive.libelle}</CardTitle>
            </CardHeader>
            <CardContent>
              <InscriptionForm
                eleveId={eleve.id}
                anneeScolaireId={anneeActive.id}
                classes={classes}
                inscriptionExistante={changement}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
