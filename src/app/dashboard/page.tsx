import Link from 'next/link';
import {
  BookOpen,
  ClipboardList,
  Coins,
  FileText,
  GraduationCap,
  School,
  Users2,
  Wallet,
} from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import {
  getAnneeCourante,
  getDashboardComptable,
  getDashboardDirecteur,
  getDashboardEnseignant,
  getDashboardSecretaire,
  getFluxActivite,
} from '@/services/dashboard';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { getSidebarItems } from '@/lib/navigation';
import { FluxActivite, Raccourcis, RACCOURCIS, TauxRecouvrement } from './Widgets';

const fcfa = (montant: number) => `${Number(montant).toLocaleString('fr-FR')} F`;
const nombre = (valeur: number) => valeur.toLocaleString('fr-FR');

export default async function DashboardPage() {
  let ctx;
  try {
    ctx = await getTenantContext();
  } catch (e) {
    return (
      <main className="p-8">
        <Card className="max-w-lg p-6">
          <h1 className="text-display-sm mb-2 text-text-primary">Session invalide</h1>
          <p className="text-body-sm text-error">
            {e instanceof Error ? e.message : 'Erreur inconnue'}
          </p>
        </Card>
      </main>
    );
  }

  const layout = (contenu: React.ReactNode, sousTitre: string) => (
    <AppLayout
      items={getSidebarItems(ctx!.role)}
      schoolName="ScolarGest"
      role={ctx!.role}
      userName={ctx!.email}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-display-sm text-text-primary">Tableau de bord</h1>
          <p className="text-body-md text-text-secondary">{sousTitre}</p>
        </div>
        {contenu}
      </div>
    </AppLayout>
  );

  if (ctx.role === 'SUPER_ADMIN') {
    return layout(
      <Card>
        <CardContent className="space-y-2 p-6">
          <p className="text-body-md text-text-primary">Console plateforme</p>
          <p className="text-body-sm text-text-secondary">
            Le suivi des écoles et des abonnements se fait depuis la{' '}
            <Link href="/super-admin" className="text-primary hover:underline">
              console SUPER_ADMIN
            </Link>
            .
          </p>
        </CardContent>
      </Card>,
      'Accès plateforme',
    );
  }

  const annee = await getAnneeCourante();
  if (!annee) {
    return layout(
      <Card>
        <CardContent className="p-6">
          <p className="text-body-sm text-text-secondary">
            Aucune année scolaire n&apos;est encore créée pour votre établissement.
          </p>
        </CardContent>
      </Card>,
      'Aucune année scolaire',
    );
  }

  if (ctx.role === 'DIRECTEUR') {
    const [stats, flux] = await Promise.all([
      getDashboardDirecteur(annee.id),
      getFluxActivite(),
    ]);

    return layout(
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Élèves inscrits"
            value={nombre(stats.eleves.actifs)}
            icon={<Users2 className="h-5 w-5" aria-hidden />}
            trend={
              stats.eleves.nouveauxCeMois > 0
                ? { label: `${stats.eleves.nouveauxCeMois} ce mois-ci`, direction: 'up' }
                : undefined
            }
          />
          <StatCard
            label="Classes"
            value={nombre(stats.classes.nombre)}
            icon={<School className="h-5 w-5" aria-hidden />}
            trend={{
              label: `${nombre(stats.classes.effectifTotal)} / ${nombre(stats.classes.capaciteTotale)} places`,
              direction: 'flat',
            }}
          />
          <StatCard
            label="Enseignants actifs"
            value={nombre(stats.enseignantsActifs)}
            icon={<GraduationCap className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Reste à recouvrer"
            value={fcfa(stats.finance.impaye)}
            mono
            icon={<Wallet className="h-5 w-5" aria-hidden />}
            trend={{ label: `${fcfa(stats.finance.encaisse)} encaissés`, direction: 'up' }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Montant facturé"
            value={fcfa(stats.finance.attendu)}
            mono
            icon={<Coins className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Évaluations"
            value={nombre(stats.academique.evaluations)}
            icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Notes à approuver"
            value={nombre(stats.academique.notesEnAttente)}
            icon={<BookOpen className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Bulletins générés"
            value={nombre(stats.academique.bulletinsGeneres)}
            icon={<FileText className="h-5 w-5" aria-hidden />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <TauxRecouvrement finance={stats.finance} />
          <FluxActivite evenements={flux} />
        </div>

        <Raccourcis
          raccourcis={[
            RACCOURCIS.suiviPaiements!,
            RACCOURCIS.bulletins!,
            RACCOURCIS.rapports!,
          ]}
        />
      </>,
      `${annee.libelle} — vue globale de l’établissement`,
    );
  }

  if (ctx.role === 'COMPTABLE') {
    const finance = await getDashboardComptable(annee.id);
    return layout(
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Revenus attendus"
            value={fcfa(finance.attendu)}
            mono
            icon={<Coins className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Encaissé"
            value={fcfa(finance.encaisse)}
            mono
            icon={<Wallet className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Reste à recouvrer"
            value={fcfa(finance.impaye)}
            mono
            icon={<Wallet className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Factures soldées"
            value={`${nombre(finance.facturesSoldees)} / ${nombre(finance.facturesTotal)}`}
            icon={<FileText className="h-5 w-5" aria-hidden />}
          />
        </div>

        <TauxRecouvrement finance={finance} />

        <Raccourcis
          raccourcis={[
            RACCOURCIS.suiviPaiements!,
            RACCOURCIS.versements!,
            RACCOURCIS.rapports!,
          ]}
        />
      </>,
      `${annee.libelle} — état financier`,
    );
  }

  if (ctx.role === 'SECRETAIRE') {
    const stats = await getDashboardSecretaire(annee.id);
    return layout(
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Élèves inscrits"
            value={nombre(stats.eleves.actifs)}
            icon={<Users2 className="h-5 w-5" aria-hidden />}
            trend={
              stats.eleves.nouveauxCeMois > 0
                ? { label: `${stats.eleves.nouveauxCeMois} ce mois-ci`, direction: 'up' }
                : undefined
            }
          />
          <StatCard
            label="Classes"
            value={nombre(stats.classes.nombre)}
            icon={<School className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Notes à approuver"
            value={nombre(stats.notesEnAttente)}
            icon={<BookOpen className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Bulletins générés"
            value={nombre(stats.bulletinsGeneres)}
            icon={<FileText className="h-5 w-5" aria-hidden />}
          />
        </div>

        <Raccourcis
          raccourcis={[
            RACCOURCIS.inscrireEleve!,
            RACCOURCIS.approbation!,
            RACCOURCIS.bulletins!,
            RACCOURCIS.eleves!,
          ]}
        />
      </>,
      `${annee.libelle} — inscriptions et documents`,
    );
  }

  const stats = await getDashboardEnseignant(annee.id);
  return layout(
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Mes classes"
          value={nombre(stats.classes)}
          icon={<School className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Mes matières"
          value={nombre(stats.matieres)}
          icon={<BookOpen className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Mes évaluations"
          value={nombre(stats.evaluations)}
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Notes en brouillon"
          value={nombre(stats.notesBrouillon)}
          icon={<FileText className="h-5 w-5" aria-hidden />}
        />
      </div>

      <Raccourcis
        raccourcis={[RACCOURCIS.mesClasses!, RACCOURCIS.saisieNotes!, RACCOURCIS.rapports!]}
      />
    </>,
    `${annee.libelle} — mon espace`,
  );
}
