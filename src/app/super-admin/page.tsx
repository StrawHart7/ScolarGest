import Link from 'next/link';
import { Building2, TrendingUp, Inbox, Plus } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getMetriquesPlateforme, getEncaissementsPlateforme } from '@/services/plateforme';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { CarteMetrique } from '@/components/ui/carte-metrique';
import { BandeauConsole } from '@/components/console/bandeau-console';
import { Echeancier } from '@/components/console/echeancier';
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
 *
 * **Reprise du 2026-09-12.** La page alignait cinq blocs de poids égal — quatre
 * compteurs, une carte héros, deux cartes, une bannière — dans le même habillage
 * que le tableau de bord d'une école. Trois corrections :
 *
 * - `BandeauConsole` prend la tête et le fond sombre. La console n'est pas une
 *   page du produit, c'est l'instrument de qui l'exploite ; elle doit se
 *   reconnaître avant d'être lue.
 * - `Echeancier` remplace « Répartition des écoles » **et** « À relancer sous
 *   7 jours ». Les proportions du parc ne se consultent pas deux fois par jour,
 *   et une fenêtre de sept jours cachait ce qui était déjà passé.
 * - La bannière de demandes en attente disparaît : elle répétait le compteur
 *   qui la surplombait, lequel mène au même endroit et sait désormais montrer
 *   qu'il est cliquable.
 */

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

        <BandeauConsole
          points={encaissements.points}
          total={encaissements.total}
          moisCourant={encaissements.moisCourant}
          variation={encaissements.variation}
        />

        {/* Trois chiffres, pas quatre : « encaissé ce mois » est monté dans le
            bandeau, où il est le sujet. Le répéter ici aurait fait dire deux
            fois la même chose à deux échelles différentes. */}
        <div
          className="grid animate-console-monte grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 max-lg:[&>*:last-child]:col-span-2"
          style={{ animationDelay: '80ms' }}
        >
          <CarteMetrique
            compact
            label="Revenu récurrent"
            valeur={formaterFCFA(m.revenuMensuel)}
            icone={TrendingUp}
            ton="primaire"
            comparaison="Par mois, abonnements actifs, annuels ramenés au douzième"
          />
          <CarteMetrique
            compact
            label="Écoles"
            valeur={String(m.ecoles.length)}
            icone={Building2}
            ton="neutre"
            comparaison={`dont ${m.parEtat.ACTIF} abonnée${m.parEtat.ACTIF > 1 ? 's' : ''} et ${m.parEtat.ESSAI} en essai`}
            href="/super-admin/etablissements"
          />
          {/* Impaire sur une grille à deux colonnes : la dernière carte prend
              toute la largeur sous `lg` plutôt que de laisser un trou. */}
          <CarteMetrique
            compact
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

        <Echeancier
          ecoles={m.ecoles.map((e) => ({
            id: e.id,
            nom: e.nom,
            joursRestants: e.joursRestants,
            nombreEleves: e.nombreEleves,
          }))}
        />
      </div>
    </AppLayout>
  );
}
