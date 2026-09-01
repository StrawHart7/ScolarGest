import Link from 'next/link';
import {
  Building2,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Inbox,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import {
  getMetriquesPlateforme,
  getEncaissementsPlateforme,
  type EtatEcole,
} from '@/services/plateforme';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CourbeAire } from '@/components/ui/courbe-aire';
import { BarresRepartition, CarteMetrique, PiluleVariation } from '@/components/ui/carte-metrique';
import { getSidebarItems } from '@/lib/navigation';
import { formaterFCFA } from '@/lib/tarifs';

export const metadata = { title: 'Vue d’ensemble' };

/**
 * Tableau de bord de la plateforme.
 *
 * Auparavant, cette page était la liste des établissements avec trois
 * compteurs au-dessus. Elle répond maintenant aux questions qu'on se pose
 * réellement en ouvrant une console SaaS : combien ça rapporte, qui est sur le
 * point de partir, et qui attend une réponse.
 *
 * La liste des écoles vit désormais sur `/super-admin/etablissements` : mêler
 * un tableau de bord et un inventaire produisait une page qui ne faisait bien
 * ni l'un ni l'autre.
 */

/**
 * Couleurs des etats, reprises de la palette de statut validee.
 *
 * Cinq etats, donc au-dela des trois teintes validees : les deux dernieres
 * sont des neutres, deliberement. Un etat qui n'appelle aucune action n'a pas
 * besoin d'une couleur qui attire l'oeil, et en inventer une abimerait la
 * separation des trois qui comptent.
 */
const COULEUR_ETAT: Record<EtatEcole, string> = {
  ACTIF: '#00875a',
  ESSAI: '#0052cc',
  EXPIRE: '#b45309',
  SUSPENDU: '#de350b',
  AUCUN: '#8993a4',
};

const LIBELLE_ETAT: Record<EtatEcole, string> = {
  ACTIF: 'Abonnées',
  ESSAI: 'En essai',
  EXPIRE: 'Expirées',
  SUSPENDU: 'Suspendues',
  AUCUN: 'Sans abonnement',
};

export default async function SuperAdminPage() {
  const ctx = await getTenantContext();
  const [m, encaissements] = await Promise.all([
    getMetriquesPlateforme(),
    getEncaissementsPlateforme(),
  ]);

  return (
    <AppLayout
      items={getSidebarItems('SUPER_ADMIN')}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Vue d'ensemble"
          description="État commercial de la plateforme et écoles demandant une attention."
          actions={
            <div className="hidden md:block">
              <Button asChild>
                <Link href="/super-admin/etablissements/nouveau" className="gap-2">
                  <Plus className="h-4 w-4" aria-hidden />
                  Nouvel établissement
                </Link>
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CarteMetrique
            label="Revenu mensuel récurrent"
            valeur={formaterFCFA(m.revenuMensuel)}
            icone={TrendingUp}
            ton="primaire"
            comparaison="Abonnements actifs, annuels ramenés au douzième"
          />
          <CarteMetrique
            label="Encaissé ce mois"
            valeur={formaterFCFA(m.encaisseCeMois)}
            icone={Wallet}
            ton="succes"
            variation={encaissements.variation}
            comparaison={`contre ${formaterFCFA(encaissements.moisPrecedent)} le mois dernier`}
          />
          <CarteMetrique
            label="Écoles"
            valeur={String(m.ecoles.length)}
            icone={Building2}
            ton="neutre"
            comparaison={`dont ${m.parEtat.ACTIF} abonnée${m.parEtat.ACTIF > 1 ? 's' : ''} et ${m.parEtat.ESSAI} en essai`}
            href="/super-admin/etablissements"
          />
          <CarteMetrique
            label="Demandes en attente"
            valeur={String(m.demandesNouvelles)}
            icone={Inbox}
            ton={m.demandesNouvelles > 0 ? 'alerte' : 'neutre'}
            comparaison={
              m.demandesNouvelles > 0
                ? 'Chaque jour d’attente coûte un prospect'
                : 'Aucun prospect en attente'
            }
            href="/super-admin/demandes"
          />
        </div>

        {/* Carte héro : le chiffre et sa tendance à gauche, la courbe à droite.
            Le total répond à « combien », la courbe à « dans quel sens » — deux
            questions qu'on se pose ensemble, d'où une seule carte. */}
        <Card className="rounded-2xl">
          <CardContent className="grid gap-6 p-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:items-center">
            <div>
              <p className="text-body-sm font-medium text-text-secondary">
                Encaissements sur 12 mois
              </p>
              <p
                className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-text-primary"
                data-mono
              >
                {formaterFCFA(encaissements.total)}
              </p>
              {/* Le grand chiffre est le cumul sur douze mois ; la variation
                  porte sur le mois en cours. Les accoler sans le dire laissait
                  croire que les 250 000 avaient baisse de 100 %. */}
              <div className="mt-4 flex flex-wrap items-baseline gap-2 border-t border-surface-border pt-4">
                <span className="text-body-sm text-text-secondary">Ce mois :</span>
                <span className="text-body-md font-semibold text-text-primary" data-mono>
                  {formaterFCFA(encaissements.moisCourant)}
                </span>
                {encaissements.variation !== null && (
                  <PiluleVariation variation={encaissements.variation} />
                )}
              </div>
              <p className="mt-4 text-body-sm text-text-secondary">
                Argent réellement encaissé, et non le revenu théorique du catalogue. Les deux
                diffèrent dès qu’une école paie en retard ou d’avance.
              </p>
            </div>

            {encaissements.total === 0 ? (
              <p className="py-10 text-center text-body-sm text-text-secondary">
                Aucun paiement d’abonnement encaissé sur les douze derniers mois.
              </p>
            ) : (
              <CourbeAire id="encaissements-plateforme" points={encaissements.points} format="fcfa" />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Card className="rounded-2xl">
            <CardHeader className="border-b border-surface-border p-5">
              <CardTitle>Répartition des écoles</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <BarresRepartition
                segments={(Object.keys(LIBELLE_ETAT) as EtatEcole[]).map((etat) => ({
                  libelle: LIBELLE_ETAT[etat],
                  valeur: m.parEtat[etat],
                  couleur: COULEUR_ETAT[etat],
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between border-b border-surface-border bg-surface-container-low/50 p-5">
              <CardTitle>À relancer sous 7 jours</CardTitle>
              {m.echeancesProches.length > 0 && (
                <Badge shape="pill" variant="warning">
                  {m.echeancesProches.length}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {m.echeancesProches.length === 0 ? (
                <p className="p-5 text-body-sm text-text-secondary">
                  Aucune échéance proche. Rien à relancer cette semaine.
                </p>
              ) : (
                <ul className="divide-y divide-surface-border/60">
                  {m.echeancesProches.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/super-admin/etablissements/${e.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface-container-low"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-body-sm font-medium text-text-primary">
                            {e.nom}
                          </span>
                          <span className="block text-body-sm text-text-secondary">
                            {e.etat === 'ESSAI' ? 'Fin d’essai' : 'Échéance'}
                            {e.nombreEleves > 0 && ` · ${e.nombreEleves} élèves`}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <Badge
                            shape="pill"
                            variant={
                              (e.joursRestants ?? 0) <= 2 ? 'error' : 'warning'
                            }
                          >
                            {e.joursRestants} j
                          </Badge>
                          <ArrowRight
                            className="h-4 w-4 text-text-secondary"
                            aria-hidden
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {m.demandesNouvelles > 0 && (
          <Link
            href="/super-admin/demandes"
            className="flex items-center gap-4 rounded-xl border border-primary-container/40 bg-primary-fixed/40 p-5 transition-colors hover:bg-primary-fixed/60"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-primary-container" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-body-md font-medium text-text-primary">
                {m.demandesNouvelles} demande{m.demandesNouvelles > 1 ? 's' : ''} de démo sans
                réponse
              </span>
              <span className="block text-body-sm text-text-secondary">
                Chaque jour d’attente coûte un prospect.
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary-container" aria-hidden />
          </Link>
        )}
      </div>
    </AppLayout>
  );
}
