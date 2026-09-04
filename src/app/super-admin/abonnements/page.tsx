import Link from 'next/link';
import { CreditCard, Plus } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAbonnements, expirerAbonnementsEchus } from '@/services/abonnement';
import { statutEffectif, joursAvantEcheance } from '@/services/abonnement-acces';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BoutonFlottant } from '@/components/ui/actions-mobile';
import { BarreListe } from '@/components/ui/barre-liste';
import { getSidebarItems } from '@/lib/navigation';
import { AbonnementRowActions } from './AbonnementRowActions';
import { paiementEnLigneActif } from '@/services/activation-plateforme';

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
  // change le statut).
  await expirerAbonnementsEchus();
  const abonnements = await listAbonnements();
  // Tant que le paiement en ligne n'est pas ouvert, toute souscription passe
  // par l'autorisation de la plateforme et n'encaisse rien. L'avertissement est
  // affiché ici pour que ce mode ne s'oublie pas en production : un revenu qui
  // reste plat alors que des ecoles souscrivent doit avoir une explication
  // visible, pas a etre devine.
  const paiementOuvert = paiementEnLigneActif();

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

        {!paiementOuvert && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <p className="text-body-sm font-medium text-warning-on-container">
              Paiement en ligne desactive
            </p>
            <p className="mt-1 text-body-sm text-text-secondary">
              Les ecoles qui souscrivent sont activees par autorisation de la plateforme, sans
              reglement : leur periode est ouverte a un montant nul et le montant qui aurait ete
              du figure dans le journal d&apos;audit. Poser PAIEMENT_EN_LIGNE=ACTIF retablit le
              parcours FedaPay.
            </p>
          </div>
        )}

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
                <div className="hidden md:block">
                  <Table dense>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Établissement</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Échéance</TableHead>
                        <TableHead>Reste</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abonnementsFiltres.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.etablissement.nom}</TableCell>
                          <TableCell className="text-text-secondary">
                            {a.plan.nom} ({Number(a.plan.prix).toLocaleString('fr-FR')} FCFA)
                          </TableCell>
                          <TableCell>
                            <Badge shape="pill" variant={STATUT_BADGE[statutEffectif(a)]}>
                              {statutEffectif(a)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-text-secondary" data-mono>
                            {new Date(a.dateFin).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell className="text-text-secondary">
                            {joursAvantEcheance(a.dateFin) > 0
                              ? `${joursAvantEcheance(a.dateFin)} j`
                              : `échu depuis ${Math.abs(joursAvantEcheance(a.dateFin))} j`}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-end gap-2">
                              <Button asChild variant="secondary" size="sm">
                                <Link href={`/super-admin/abonnements/${a.id}/paiement`}>
                                  Valider un paiement
                                </Link>
                              </Button>
                              <AbonnementRowActions etablissementId={a.etablissementId} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                          <AbonnementRowActions etablissementId={a.etablissementId} />
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
