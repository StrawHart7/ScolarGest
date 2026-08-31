import Link from 'next/link';
import { Building2, Plus } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getMetriquesPlateforme, type EtatEcole } from '@/services/plateforme';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { BoutonFlottant } from '@/components/ui/actions-mobile';
import { getSidebarItems } from '@/lib/navigation';
import { formaterFCFA } from '@/lib/tarifs';

export const metadata = { title: 'Établissements' };

/**
 * Inventaire des écoles clientes.
 *
 * Séparée du tableau de bord, qui répondait mal aux deux besoins à la fois.
 * Chaque ligne porte ce qui permet de décider sans ouvrir la fiche : l'état de
 * facturation réel, les effectifs, le nombre de cycles facturés et l'échéance.
 *
 * L'état affiché suit exactement l'ordre de `evaluerAcces` — suspension, puis
 * abonnement payé, puis essai. Une console qui contredirait l'accès réel de
 * l'école serait pire qu'une console vide.
 */

const TON_ETAT: Record<EtatEcole, 'success' | 'warning' | 'error' | 'neutral' | 'primary'> = {
  ACTIF: 'success',
  ESSAI: 'primary',
  EXPIRE: 'warning',
  SUSPENDU: 'error',
  AUCUN: 'neutral',
};

const LIBELLE_ETAT: Record<EtatEcole, string> = {
  ACTIF: 'Abonnée',
  ESSAI: 'Essai',
  EXPIRE: 'Expirée',
  SUSPENDU: 'Suspendue',
  AUCUN: 'Sans abonnement',
};

const TON_MOBILE: Record<EtatEcole, 'succes' | 'alerte' | 'erreur' | 'neutre'> = {
  ACTIF: 'succes',
  ESSAI: 'neutre',
  EXPIRE: 'alerte',
  SUSPENDU: 'erreur',
  AUCUN: 'neutre',
};

function echeance(jours: number | null): string {
  if (jours === null) return '—';
  if (jours < 0) return `dépassée de ${Math.abs(jours)} j`;
  return `${jours} j`;
}

export default async function EtablissementsPage() {
  const ctx = await getTenantContext();
  const { ecoles } = await getMetriquesPlateforme();

  return (
    <AppLayout
      items={getSidebarItems('SUPER_ADMIN')}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Établissements"
          description="Toutes les écoles de la plateforme, avec leur état de facturation."
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

        <EnteteListe
          titre="Écoles"
          compte={`${ecoles.length} école${ecoles.length > 1 ? 's' : ''}`}
        />

        <Card className="overflow-hidden rounded-xl max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <CardContent className="p-0">
            {ecoles.length === 0 ? (
              <p className="p-5 text-body-sm text-text-secondary">
                Aucun établissement pour le moment.
              </p>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-row-dense border-b border-surface-border bg-surface text-label-md text-text-secondary">
                        <th className="py-2 pl-5 pr-3 font-semibold">Établissement</th>
                        <th className="px-3 py-2 font-semibold">État</th>
                        <th className="px-3 py-2 text-right font-semibold">Élèves</th>
                        <th className="px-3 py-2 text-right font-semibold">Cycles</th>
                        <th className="px-3 py-2 text-right font-semibold">Montant</th>
                        <th className="py-2 pl-3 pr-5 text-right font-semibold">Échéance</th>
                      </tr>
                    </thead>
                    <tbody className="text-body-sm text-text-primary">
                      {ecoles.map((e) => (
                        <tr
                          key={e.id}
                          className="h-row-dense border-b border-surface-border/50 transition-colors last:border-0 hover:bg-surface-container-low"
                        >
                          <td className="py-2 pl-5 pr-3">
                            <Link
                              href={`/super-admin/etablissements/${e.id}`}
                              className="font-medium text-text-primary hover:text-primary-container"
                            >
                              {e.nom}
                            </Link>
                            {e.ville && (
                              <span className="block text-body-sm text-text-secondary">
                                {e.ville}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Badge shape="pill" variant={TON_ETAT[e.etat]}>
                              {LIBELLE_ETAT[e.etat]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right text-text-secondary" data-mono>
                            {e.nombreEleves}
                          </td>
                          <td className="px-3 py-2 text-right text-text-secondary" data-mono>
                            {e.nombreCycles}
                          </td>
                          <td className="px-3 py-2 text-right text-text-secondary" data-mono>
                            {e.montantPeriode !== null ? formaterFCFA(e.montantPeriode) : '—'}
                          </td>
                          <td
                            className="py-2 pl-3 pr-5 text-right text-text-secondary"
                            data-mono
                          >
                            {echeance(e.joursRestants)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <CarteListeMobile>
                  {ecoles.map((e) => (
                    <LigneCarteMobile
                      key={e.id}
                      href={`/super-admin/etablissements/${e.id}`}
                      icone={Building2}
                      titre={e.nom}
                      sousTitre={`${e.nombreEleves} élèves · ${echeance(e.joursRestants)}`}
                      statut={{ libelle: LIBELLE_ETAT[e.etat], ton: TON_MOBILE[e.etat] }}
                    />
                  ))}
                </CarteListeMobile>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <BoutonFlottant
        href="/super-admin/etablissements/nouveau"
        libelle="Nouvel établissement"
        icone={Plus}
      />
    </AppLayout>
  );
}
