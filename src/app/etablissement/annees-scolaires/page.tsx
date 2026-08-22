import Link from 'next/link';
import { CalendarRange } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { bilanCloture, listAnneesScolaires, type BilanCloture } from '@/services/annee-scolaire';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { getSidebarItems } from '@/lib/navigation';
import { AnneeScolaireForm } from './AnneeScolaireForm';
import { ActiverAnneeButton, CloturerAnneeButton } from './ActiverAnneeButton';

const STATUT_BADGE = {
  PREPARATION: 'neutral',
  ACTIVE: 'success',
  TERMINEE: 'neutral',
} as const;

const STATUT_LABEL = {
  PREPARATION: 'Préparation',
  ACTIVE: 'Active',
  TERMINEE: 'Terminée',
} as const;

export default async function AnneesScolairesPage() {
  const ctx = await getTenantContext();
  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const estDirecteur = ctx.role === 'DIRECTEUR';

  // Le bilan n'est calculé que pour l'année active, et seulement pour le
  // Directeur : c'est lui seul qui peut clôturer.
  let bilan: BilanCloture | null = null;
  if (estDirecteur && anneeActive) {
    bilan = await bilanCloture(anneeActive.id);
  }

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-6">
        <div className="hidden md:block">
          <PageHeader
            title="Années scolaires"
            description="Une seule année peut être active à la fois. Clôturer une année est une décision explicite : activer une nouvelle année ne clôture plus la précédente à votre insu."
            actions={estDirecteur && <AnneeScolaireForm />}
          />
        </div>

        {/* Le bouton de création ouvre un modal, pas une page : il reste dans
            le flux plutôt que de devenir un bouton flottant. */}
        {estDirecteur && (
          <div className="md:hidden">
            <AnneeScolaireForm />
          </div>
        )}

        <EnteteListe
          titre="Années scolaires"
          compte={`${annees.length} année${annees.length > 1 ? 's' : ''}`}
        />

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          {annees.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <CalendarRange className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucune année scolaire créée.</p>
            </CardContent>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Début</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {annees.map((annee) => (
                      <TableRow key={annee.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/etablissement/annees-scolaires/${annee.id}`}
                            className="text-text-primary transition-colors hover:text-primary-container hover:underline"
                          >
                            {annee.libelle}
                          </Link>
                        </TableCell>
                        <TableCell className="text-text-secondary" data-mono>
                          {new Date(annee.dateDebut).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-text-secondary" data-mono>
                          {new Date(annee.dateFin).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUT_BADGE[annee.statut]} shape="pill">
                            {STATUT_LABEL[annee.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {estDirecteur && annee.statut === 'PREPARATION' && (
                            <ActiverAnneeButton
                              anneeScolaireId={annee.id}
                              libelle={annee.libelle}
                              anneeActiveLibelle={anneeActive?.libelle}
                            />
                          )}
                          {estDirecteur && annee.statut === 'ACTIVE' && bilan && (
                            <CloturerAnneeButton
                              anneeScolaireId={annee.id}
                              libelle={annee.libelle}
                              bilan={bilan}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/*
                Une ligne qui navigue ET porte un bouton d'action (activer,
                clôturer) ne peut pas devenir un simple lien sur mobile sans
                imbriquer deux cibles de tap. Le chevron mène à la fiche, où
                ces actions existent déjà (`ActiverAnneeButton`) — cohérent
                avec le choix déjà fait sur la liste des élèves d'ouvrir les
                actions sensibles sur la fiche plutôt que dans la liste.
              */}
              <CarteListeMobile>
                {annees.map((annee) => (
                  <LigneCarteMobile
                    key={annee.id}
                    href={`/etablissement/annees-scolaires/${annee.id}`}
                    icone={CalendarRange}
                    titre={annee.libelle}
                    sousTitre={`${new Date(annee.dateDebut).toLocaleDateString('fr-FR')} – ${new Date(annee.dateFin).toLocaleDateString('fr-FR')}`}
                    statut={{
                      libelle: STATUT_LABEL[annee.statut],
                      ton: annee.statut === 'ACTIVE' ? 'succes' : 'neutre',
                    }}
                  />
                ))}
              </CarteListeMobile>
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
