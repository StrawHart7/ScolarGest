import Link from 'next/link';
import {
  Activity,
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
  type StatsFinance,
} from '@/services/dashboard';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { getSidebarItems } from '@/lib/navigation';

const fcfa = (montant: number) => `${Number(montant).toLocaleString('fr-FR')} F`;
const nombre = (valeur: number) => valeur.toLocaleString('fr-FR');

function TauxRecouvrement({ finance }: { finance: StatsFinance }) {
  const taux = finance.attendu > 0 ? Math.round((finance.encaisse / finance.attendu) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recouvrement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface-container"
          role="progressbar"
          aria-valuenow={taux}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Taux de recouvrement"
        >
          <div className="h-full rounded-full bg-tertiary" style={{ width: `${taux}%` }} />
        </div>
        <p className="text-body-sm text-text-secondary">
          {taux} % des montants facturés sont encaissés — {nombre(finance.facturesSoldees)} facture(s)
          soldée(s) sur {nombre(finance.facturesTotal)}.
        </p>
      </CardContent>
    </Card>
  );
}

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

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <TauxRecouvrement finance={stats.finance} />

          <Card>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
            </CardHeader>
            <CardContent>
              {flux.length === 0 ? (
                <p className="text-body-sm text-text-secondary">
                  Aucune activité enregistrée pour le moment.
                </p>
              ) : (
                <ul className="space-y-3">
                  {flux.map((evenement) => (
                    <li key={evenement.id} className="flex items-start gap-3">
                      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" aria-hidden />
                      <div>
                        <p className="text-body-sm text-text-primary">{evenement.libelle}</p>
                        <p className="text-body-sm text-text-secondary">
                          {new Date(evenement.date).toLocaleString('fr-FR')} — {evenement.module}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-body-sm text-text-secondary">
                Ce flux est informatif : aucune validation ne s&apos;y fait.
              </p>
            </CardContent>
          </Card>
        </div>
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

        <div className="grid gap-6 lg:grid-cols-2">
          <TauxRecouvrement finance={finance} />
          <Card>
            <CardHeader>
              <CardTitle>Raccourcis</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Link
                href="/etablissement/finances/factures"
                className="text-body-sm text-primary hover:underline"
              >
                Suivi des paiements
              </Link>
              <Link
                href="/etablissement/finances/paiements"
                className="text-body-sm text-primary hover:underline"
              >
                Historique des versements
              </Link>
              <Link href="/rapports" className="text-body-sm text-primary hover:underline">
                Rapports et exports
              </Link>
            </CardContent>
          </Card>
        </div>
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

        <Card>
          <CardHeader>
            <CardTitle>Raccourcis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link
              href="/etablissement/eleves/nouvelle"
              className="text-body-sm text-primary hover:underline"
            >
              Inscrire un élève
            </Link>
            <Link
              href="/etablissement/notes/approbation"
              className="text-body-sm text-primary hover:underline"
            >
              Approbation des notes
            </Link>
            <Link
              href="/etablissement/notes/bulletins"
              className="text-body-sm text-primary hover:underline"
            >
              Génération de bulletins
            </Link>
          </CardContent>
        </Card>
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

      <Card>
        <CardHeader>
          <CardTitle>Raccourcis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link
            href="/etablissement/mes-classes"
            className="text-body-sm text-primary hover:underline"
          >
            Mes classes
          </Link>
          <Link
            href="/etablissement/notes/saisie"
            className="text-body-sm text-primary hover:underline"
          >
            Saisie des notes
          </Link>
        </CardContent>
      </Card>
    </>,
    `${annee.libelle} — mon espace`,
  );
}
