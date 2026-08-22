import Link from 'next/link';
import { UserPlus, Users2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listUtilisateurs } from '@/services/utilisateur';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { BarreOutilsListe, BoutonFlottant } from '@/components/ui/actions-mobile';
import { FiltresMobile } from '@/components/ui/filtres-mobile';
import {
  FiltreListe,
  PaginationListe,
  RechercheListe,
  TriColonne,
} from '@/components/ui/liste-toolbar';
import { lireParametresListe, preparerListe } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';
import { DesactiverButton } from './DesactiverButton';

const STATUT_BADGE = {
  ACTIF: 'success',
  INACTIF: 'neutral',
  BLOQUE: 'error',
} as const;

const STATUT_TON = {
  ACTIF: 'succes',
  INACTIF: 'neutre',
  BLOQUE: 'erreur',
} as const;

const OPTIONS_ROLE = ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT'].map((role) => ({
  valeur: role,
  libelle: role.charAt(0) + role.slice(1).toLowerCase(),
}));

export default async function UtilisateursPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await getTenantContext();
  const utilisateurs = await listUtilisateurs();

  const lireUnique = (cle: string): string | undefined => {
    const brut = searchParams[cle];
    const valeur = Array.isArray(brut) ? brut[0] : brut;
    return valeur && valeur.length > 0 ? valeur : undefined;
  };
  const roleFiltre = lireUnique('role');
  const statutFiltre = lireUnique('statutUtilisateur');

  const filtres = utilisateurs.filter(
    (u) => (!roleFiltre || u.role === roleFiltre) && (!statutFiltre || u.statut === statutFiltre),
  );

  const parametres = lireParametresListe(searchParams, { tri: 'nom' });
  const page = preparerListe(filtres, parametres, {
    champsRecherche: (u) => [u.nom, u.prenom, u.email, u.role],
    valeursTri: {
      nom: (u) => `${u.nom} ${u.prenom}`,
      email: (u) => u.email,
      role: (u) => u.role,
      statut: (u) => u.statut,
    },
  });

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="space-y-4 md:space-y-6">
        <div className="hidden md:block">
          <PageHeader
            title="Utilisateurs"
            description={`${utilisateurs.length} utilisateur(s) dans votre établissement`}
            actions={
              <Button asChild size="sm">
                <Link href="/utilisateurs/inviter">
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Inviter un utilisateur
                </Link>
              </Button>
            }
          />
        </div>

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <BarreOutilsListe>
            <RechercheListe placeholder="Nom, e-mail ou rôle…" />
            <FiltresMobile nombreActifs={(roleFiltre ? 1 : 0) + (statutFiltre ? 1 : 0)}>
              <FiltreListe
                parametre="role"
                libelle="Rôle"
                options={OPTIONS_ROLE}
                libelleTout="Tous les rôles"
              />
              <FiltreListe
                parametre="statutUtilisateur"
                libelle="Statut"
                options={[
                  { valeur: 'ACTIF', libelle: 'Actif' },
                  { valeur: 'INACTIF', libelle: 'Inactif' },
                  { valeur: 'BLOQUE', libelle: 'Bloqué' },
                ]}
                libelleTout="Tous les statuts"
              />
            </FiltresMobile>
          </BarreOutilsListe>

          <EnteteListe
            titre="Utilisateurs"
            compte={`${page.total} utilisateur${page.total > 1 ? 's' : ''}`}
          />

          {page.total === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <Users2 className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-md text-text-primary">Aucun utilisateur trouvé.</p>
            </CardContent>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TriColonne cle="nom">Nom</TriColonne>
                      <TriColonne cle="email">E-mail</TriColonne>
                      <TriColonne cle="role">Rôle</TriColonne>
                      <TriColonne cle="statut">Statut</TriColonne>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.lignes.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/utilisateurs/${u.id}`}
                            className="text-text-primary transition-colors hover:text-primary-container hover:underline"
                          >
                            {u.prenom} {u.nom}
                          </Link>
                        </TableCell>
                        <TableCell className="text-text-secondary">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="primary">{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUT_BADGE[u.statut]}>{u.statut}</Badge>
                        </TableCell>
                        <TableCell>
                          {u.statut === 'ACTIF' && <DesactiverButton utilisateurId={u.id} />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <CarteListeMobile>
                {page.lignes.map((u) => (
                  <LigneCarteMobile
                    key={u.id}
                    href={`/utilisateurs/${u.id}`}
                    titre={`${u.prenom} ${u.nom}`}
                    reference={u.role}
                    sousTitre={u.email}
                    statut={{ libelle: u.statut, ton: STATUT_TON[u.statut] }}
                  />
                ))}
              </CarteListeMobile>

              <PaginationListe
                page={page.page}
                nombrePages={page.nombrePages}
                debut={page.debut}
                fin={page.fin}
                total={page.total}
                libelle="utilisateur(s)"
              />
            </>
          )}
        </Card>
      </div>

      <BoutonFlottant href="/utilisateurs/inviter" libelle="Inviter un utilisateur" icone={UserPlus} />
    </AppLayout>
  );
}
