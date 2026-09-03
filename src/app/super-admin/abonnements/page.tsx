import Link from 'next/link';
import { CreditCard, Plus } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAbonnements, listPlans, expirerAbonnementsEchus } from '@/services/abonnement';
import { statutEffectif, joursAvantEcheance } from '@/services/abonnement-acces';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { BoutonFlottant } from '@/components/ui/actions-mobile';
import { BarreListe } from '@/components/ui/barre-liste';
import { getSidebarItems } from '@/lib/navigation';
import { AbonnementRowActions } from './AbonnementRowActions';

const STATUT_BADGE = {
  ACTIF: 'success',
  EXPIRE: 'error',
  SUSPENDU: 'neutral',
  AUCUN: 'neutral',
} as const;

export default async function AbonnementsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await getTenantContext();
  // Constate les échéances dépassées avant d'afficher : sans planificateur
  // dans le MVP, l'ouverture de la console est le point de passage naturel.
  // `expirerAbonnementsEchus` doit précéder la lecture des abonnements (elle en
  // change le statut) ; les plans, eux, ne dépendent de rien.
  const [, plans] = await Promise.all([expirerAbonnementsEchus(), listPlans()]);
  const abonnements = await listAbonnements();

  // `listAbonnements` ramene tout : le filtrage vit ici, le service reste
  // utilisable tel quel par les autres appelants.
  const lireUnique = (cle: string): string | undefined => {
    const brut = searchParams[cle];
    const valeur = Array.isArray(brut) ? brut[0] : brut;
    return valeur && valeur.length > 0 ? valeur : undefined;
  };
  const terme = (lireUnique('q') ?? '').trim().toLowerCase();
  const statutFiltre = lireUnique('statutAbonnement');
  const abonnementsFiltres = abonnements.filter((a) => {
    if (statutFiltre && statutEffectif(a) !== statutFiltre) return false;
    if (!terme) return true;
    return `${a.etablissement.nom} ${a.plan.nom}`.toLowerCase().includes(terme);
  });

  return (
    <AppLayout
      items={getSidebarItems('SUPER_ADMIN')}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
        {/* Sur mobile, le titre descend dans EnteteListe (doublon sinon) et la
            création passe en bouton flottant. */}
        <div className="hidden md:block">
          <PageHeader
            title="Abonnements"
            description="Suivi des abonnements par école et validation manuelle des paiements."
            actions={
              <Button asChild>
                <Link href="/super-admin/abonnements/nouveau" className="gap-2">
                  <Plus className="h-4 w-4" aria-hidden />
                  Nouvel abonnement
                </Link>
              </Button>
            }
          />
        </div>

        <BarreListe
          placeholderRecherche="École ou plan…"
          filtres={[
            {
              parametre: 'statutAbonnement',
              libelle: 'Statut',
              options: [
                { valeur: 'ACTIF', libelle: 'Actif' },
                { valeur: 'EXPIRE', libelle: 'Expiré' },
                { valeur: 'SUSPENDU', libelle: 'Suspendu' },
              ],
              libelleTout: 'Tous les statuts',
            },
          ]}
        />

        <EnteteListe
          titre="Abonnements"
          compte={
            terme || statutFiltre
              ? `${abonnementsFiltres.length} sur ${abonnements.length} abonnement${
                  abonnements.length > 1 ? 's' : ''
                }`
              : `${abonnements.length} abonnement${abonnements.length > 1 ? 's' : ''}`
          }
        />

        <Card className="overflow-hidden rounded-xl max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <CardHeader className="hidden flex-row items-center justify-between border-b border-surface-border bg-surface-container-low/50 p-5 md:flex">
            <CardTitle>Liste des abonnements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {abonnementsFiltres.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <CreditCard className="h-8 w-8 text-text-secondary/50" aria-hidden />
                <p className="text-body-sm text-text-secondary">
                  {terme || statutFiltre
                    ? 'Aucun abonnement ne correspond à cette recherche.'
                    : 'Aucun abonnement enregistré.'}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-row-dense border-b border-surface-border bg-surface text-label-md text-text-secondary">
                        <th className="py-2 pl-5 pr-3 font-semibold">Établissement</th>
                        <th className="px-3 py-2 font-semibold">Plan</th>
                        <th className="px-3 py-2 font-semibold">Statut</th>
                        <th className="px-3 py-2 font-semibold">Échéance</th>
                        <th className="px-3 py-2 font-semibold">Reste</th>
                        <th className="py-2 pl-3 pr-5 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-body-sm text-text-primary">
                      {abonnementsFiltres.map((a) => (
                        <tr
                          key={a.id}
                          className="h-row-dense border-b border-surface-border/50 transition-colors last:border-0 hover:bg-surface-container-low"
                        >
                          <td className="py-2 pl-5 pr-3 font-medium">{a.etablissement.nom}</td>
                          <td className="px-3 py-2 text-text-secondary">
                            {a.plan.nom} ({Number(a.plan.prix).toLocaleString('fr-FR')} FCFA)
                          </td>
                          <td className="px-3 py-2">
                            <Badge shape="pill" variant={STATUT_BADGE[statutEffectif(a)]}>
                              {statutEffectif(a)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-text-secondary" data-mono>
                            {new Date(a.dateFin).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-3 py-2 text-text-secondary">
                            {joursAvantEcheance(a.dateFin) > 0
                              ? `${joursAvantEcheance(a.dateFin)} j`
                              : `échu depuis ${Math.abs(joursAvantEcheance(a.dateFin))} j`}
                          </td>
                          <td className="py-2 pl-3 pr-5">
                            <div className="flex flex-col items-end gap-2">
                              <Button asChild variant="secondary" size="sm">
                                <Link href={`/super-admin/abonnements/${a.id}/paiement`}>
                                  Valider un paiement
                                </Link>
                              </Button>
                              <AbonnementRowActions
                                abonnementId={a.id}
                                statut={a.statut}
                                planActuelId={a.planId}
                                plans={plans.map((p) => ({ id: p.id, nom: p.nom }))}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <CarteListeMobile>
                  {abonnementsFiltres.map((a) => (
                    <LigneCarteMobile
                      key={a.id}
                      icone={CreditCard}
                      titre={a.etablissement.nom}
                      sousTitre={`${a.plan.nom} · échéance ${new Date(a.dateFin).toLocaleDateString('fr-FR')}`}
                      statut={{
                        libelle: statutEffectif(a),
                        ton:
                          statutEffectif(a) === 'ACTIF'
                            ? 'succes'
                            : statutEffectif(a) === 'EXPIRE'
                              ? 'erreur'
                              : 'neutre',
                      }}
                      valeurSecondaire={
                        joursAvantEcheance(a.dateFin) > 0
                          ? `${joursAvantEcheance(a.dateFin)} j`
                          : `échu ${Math.abs(joursAvantEcheance(a.dateFin))} j`
                      }
                      actions={
                        <div className="flex flex-wrap items-center gap-2">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/super-admin/abonnements/${a.id}/paiement`}>
                              Valider un paiement
                            </Link>
                          </Button>
                          <AbonnementRowActions
                            abonnementId={a.id}
                            statut={a.statut}
                            planActuelId={a.planId}
                            plans={plans.map((p) => ({ id: p.id, nom: p.nom }))}
                          />
                        </div>
                      }
                    />
                  ))}
                </CarteListeMobile>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <BoutonFlottant
        href="/super-admin/abonnements/nouveau"
        libelle="Nouvel abonnement"
        icone={Plus}
      />
    </AppLayout>
  );
}
