import Link from 'next/link';
import { UserPlus, Users2 } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listUtilisateurs } from '@/services/utilisateur';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarreEtablissement } from '@/components/layout/BarreEtablissement';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CarteListeMobile, EnteteListe, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { BoutonFlottant } from '@/components/ui/actions-mobile';
import { BarreListe } from '@/components/ui/barre-liste';
import { PaginationListe, TriColonne } from '@/components/ui/liste-toolbar';
import { lireParametresListe, preparerListe } from '@/lib/liste';
import { getSidebarItems } from '@/lib/navigation';
import { DesactiverButton, ReactiverButton } from './DesactiverButton';
import { ReinitialiserMotDePasse } from './ReinitialiserMotDePasse';
import { EtatVide } from '@/components/ui/etat-vide';
import { estCompteSansEmail, identifiantAffiche } from '@/lib/identifiants';

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
    // On cherche sur ce qui est **affiché** : un compte sans adresse montre
    // « kossi.adjovi » et non « kossi.adjovi@comptes.scolargest.com ». Chercher
    // sur l'adresse interne ferait échouer la recherche sur ce qu'on lit à
    // l'écran, ce qui est la seule chose que l'utilisateur puisse taper.
    champsRecherche: (u) => [u.nom, u.prenom, identifiantAffiche(u.email), u.role],
    valeursTri: {
      nom: (u) => `${u.nom} ${u.prenom}`,
      email: (u) => identifiantAffiche(u.email),
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
        <BarreEtablissement role={ctx.role} actif="/utilisateurs" />

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

        <BarreListe
          placeholderRecherche="Nom, e-mail ou rôle…"
          filtres={[
            { parametre: 'role', libelle: 'Rôle', options: OPTIONS_ROLE, libelleTout: 'Tous les rôles' },
            {
              parametre: 'statutUtilisateur',
              libelle: 'Statut',
              options: [
                { valeur: 'ACTIF', libelle: 'Actif' },
                { valeur: 'INACTIF', libelle: 'Inactif' },
                { valeur: 'BLOQUE', libelle: 'Bloqué' },
              ],
              libelleTout: 'Tous les statuts',
            },
          ]}
          tri={[
            { cle: 'nom', libelle: 'Nom' },
            { cle: 'email', libelle: 'E-mail' },
            { cle: 'role', libelle: 'Rôle' },
            { cle: 'statut', libelle: 'Statut' },
          ]}
        />

        <Card className="max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <EnteteListe
            titre="Utilisateurs"
            compte={`${page.total} utilisateur${page.total > 1 ? 's' : ''}`}
          />

          {page.total === 0 ? (
            <CardContent>
              <EtatVide
                icone={Users2}
                titre="Vous êtes seul sur la plateforme"
                explication="Ajoutez votre secrétaire ou votre comptable. Avec une adresse email, la personne reçoit un lien et choisit son mot de passe ; sans adresse, vous lui remettez un identifiant et un mot de passe de la main à la main."
                action={
                  <Button asChild>
                    <Link href="/utilisateurs/inviter">Ajouter quelqu’un</Link>
                  </Button>
                }
              />
            </CardContent>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TriColonne cle="nom">Nom</TriColonne>
                      <TriColonne cle="email">E-mail ou identifiant</TriColonne>
                      <TriColonne cle="role">Rôle</TriColonne>
                      <TriColonne cle="statut">Statut</TriColonne>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.lignes.map((u) => (
                      <TableRow key={u.id} className="group relative">
                        <TableCell className="font-medium">
                          <Link
                            href={`/utilisateurs/${u.id}`}
                            className="text-text-primary transition-colors after:absolute after:inset-0 after:z-10 after:content-[''] group-hover:text-primary-container group-hover:underline"
                          >
                            {u.prenom} {u.nom}
                          </Link>
                        </TableCell>
                        <TableCell className="text-text-secondary">
                          {identifiantAffiche(u.email)}
                          {estCompteSansEmail(u.email) ? (
                            // Sans cette mention, « kossi.adjovi » se lit comme
                            // une adresse tronquée et quelqu'un finira par
                            // essayer d'y écrire.
                            <span className="block text-label-md text-text-secondary/70">
                              Identifiant, sans adresse email
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="primary">{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUT_BADGE[u.statut]}>{u.statut}</Badge>
                        </TableCell>
                        {/* Les commandes passent au-dessus du recouvrement : sans ce
                            cran, désactiver un compte ouvrirait sa fiche à la place. */}
                        <TableCell className="relative z-20 flex flex-wrap items-center gap-1">
                          {/*
                            La réinitialisation n'est offerte que sur les comptes
                            sans adresse : eux seuls n'ont pas de « mot de passe
                            oublié » en libre-service. La proposer partout
                            inviterait à prendre la main sur un compte qui sait
                            se débrouiller seul.
                          */}
                          {u.statut === 'ACTIF' && estCompteSansEmail(u.email) ? (
                            <ReinitialiserMotDePasse
                              utilisateurId={u.id}
                              nomComplet={`${u.prenom} ${u.nom}`}
                            />
                          ) : null}
                          {u.statut === 'ACTIF' ? (
                            <DesactiverButton
                              utilisateurId={u.id}
                              nomComplet={`${u.prenom} ${u.nom}`}
                            />
                          ) : (
                            // Un compte desactive doit pouvoir revenir : la
                            // desactivation bannit desormais le compte Auth, et
                            // le bannissement ne se leve pas autrement que par
                            // ce bouton.
                            <ReactiverButton utilisateurId={u.id} />
                          )}
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
                    sousTitre={identifiantAffiche(u.email)}
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
