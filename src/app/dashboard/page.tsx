import { redirect } from 'next/navigation';
import {
  BookOpen,
  ClipboardList,
  Coins,
  FileText,
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
import { CarteMetrique } from '@/components/ui/carte-metrique';
import { getSidebarItems } from '@/lib/navigation';
import { getProgressionOnboarding, marquerRedirectionOnboarding } from '@/services/onboarding';
import { etapesPourRole } from '@/lib/onboarding/etapes';
import { encaissementsAnnee, effectifsParClasse } from '@/services/series-ecole';
import { FluxActivite, Raccourcis, RACCOURCIS, TauxRecouvrement } from './Widgets';
import { CarteEncaissements, CarteEffectifs } from './CartesGraphes';
import { BanniereDemarrage } from './BanniereDemarrage';

const fcfa = (montant: number) => `${Number(montant).toLocaleString('fr-FR')} F`;
const nombre = (valeur: number) => valeur.toLocaleString('fr-FR');

const ROLE_LISIBLE: Partial<Record<string, string>> = {
  DIRECTEUR: 'Direction',
  SECRETAIRE: 'Secrétariat',
  COMPTABLE: 'Comptabilité',
  ENSEIGNANT: 'Enseignement',
};

/**
 * Salutation selon l'heure.
 *
 * Calculee au rendu, donc sur l'heure du **serveur**. Suffisant : ScolarGest
 * s'adresse au Togo, et Vercel comme Supabase y sont regles sur UTC, a une
 * heure pres du fuseau local. Une salutation qui se trompe d'une heure au
 * lever du jour est un defaut sans consequence ; la corriger cote client
 * imposerait une frontiere client pour un bonjour.
 */
function salutation(): string {
  const heure = new Date().getUTCHours();
  if (heure < 12) return 'Bonjour';
  if (heure < 18) return 'Bon après-midi';
  return 'Bonsoir';
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

  // Configuration initiale : rediriger une seule fois vers le questionnaire,
  // puis se contenter d'un rappel. `marquerRedirectionOnboarding()` ne renvoie
  // `true` qu'à la toute première fois — c'est ce qui rend le parcours
  // interruptible : quitter `/demarrage` ne peut pas ramener en boucle ici.
  let rappelDemarrage: { nombreFaites: number; nombreTotal: number } | null = null;
  if (etapesPourRole(ctx.role).length > 0) {
    const progression = await getProgressionOnboarding();
    if (!progression.complete) {
      if (await marquerRedirectionOnboarding()) {
        redirect('/demarrage');
      }
      if (!progression.masquee) {
        rappelDemarrage = {
          nombreFaites: progression.nombreFaites,
          nombreTotal: progression.nombreTotal,
        };
      }
    }
  }

  const layout = (contenu: React.ReactNode, sousTitre: string) => (
    <AppLayout
      items={getSidebarItems(ctx!.role)}
      schoolName="ScolarGest"
      role={ctx!.role}
      userName={ctx!.email}
    >
      <div className="space-y-6">
        {/* Le titre nu « Tableau de bord » posait une etiquette de route plutot
            qu'un en-tete : aucune hierarchie, aucun ancrage. Il porte desormais
            le nom du role et l'annee, et la salutation dit a qui la page
            s'adresse — c'est ce qui distingue un tableau de bord d'un rapport. */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-surface-border pb-5">
          <div className="min-w-0">
            <p className="text-label-md uppercase tracking-wider text-primary-container">
              {ROLE_LISIBLE[ctx.role] ?? 'Tableau de bord'}
            </p>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-text-primary sm:text-[32px]">
              {salutation()}
            </h1>
            <p className="mt-1 text-body-md text-text-secondary">{sousTitre}</p>
          </div>
        </header>
        {rappelDemarrage && (
          <BanniereDemarrage
            nombreFaites={rappelDemarrage.nombreFaites}
            nombreTotal={rappelDemarrage.nombreTotal}
          />
        )}
        {contenu}
      </div>
    </AppLayout>
  );

  // Le SUPER_ADMIN n'a pas de tableau de bord d'école : son espace est la
  // console plateforme. On l'y envoie directement plutôt que de lui servir un
  // écran vide dont le seul contenu est un lien vers l'endroit où il voulait
  // aller. `/dashboard` reste la destination commune après connexion, y
  // compris pour lui — c'est ici que la bifurcation doit vivre.
  if (ctx.role === 'SUPER_ADMIN') {
    redirect('/super-admin');
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
    const [stats, flux, encaissements, effectifs] = await Promise.all([
      getDashboardDirecteur(annee.id),
      getFluxActivite(),
      encaissementsAnnee(annee.id),
      effectifsParClasse(annee.id),
    ]);
    const tauxRemplissage =
      stats.classes.capaciteTotale > 0
        ? Math.round((stats.classes.effectifTotal / stats.classes.capaciteTotale) * 100)
        : null;

    return layout(
      <>
        {/* Une rangee de metriques expliquees plutot que huit compteurs nus.
            Chaque carte porte sa comparaison en clair : « 276 » ne dit rien,
            « 276 / 481 places » dit si l'ecole est pleine. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CarteMetrique
            label="Élèves inscrits"
            valeur={nombre(stats.eleves.actifs)}
            icone={Users2}
            ton="primaire"
            comparaison={
              stats.eleves.nouveauxCeMois > 0
                ? `${nombre(stats.eleves.nouveauxCeMois)} nouveau${stats.eleves.nouveauxCeMois > 1 ? 'x' : ''} ce mois-ci`
                : 'Aucune nouvelle inscription ce mois-ci'
            }
            href="/etablissement/eleves"
          />
          <CarteMetrique
            label="Remplissage"
            valeur={tauxRemplissage !== null ? `${tauxRemplissage} %` : '—'}
            icone={School}
            ton="neutre"
            comparaison={`${nombre(stats.classes.effectifTotal)} élèves sur ${nombre(stats.classes.capaciteTotale)} places, ${nombre(stats.classes.nombre)} classes`}
            href="/etablissement/classes"
          />
          <CarteMetrique
            label="Encaissé cette année"
            valeur={fcfa(stats.finance.encaisse)}
            icone={Wallet}
            ton="succes"
            variation={encaissements.variation}
            comparaison={`sur ${fcfa(stats.finance.attendu)} facturés`}
            href="/etablissement/finances/paiements"
          />
          <CarteMetrique
            label="Notes à approuver"
            valeur={nombre(stats.academique.notesEnAttente)}
            icone={BookOpen}
            ton={stats.academique.notesEnAttente > 0 ? 'alerte' : 'neutre'}
            comparaison={
              stats.academique.notesEnAttente > 0
                ? 'En attente de votre validation'
                : `${nombre(stats.academique.bulletinsGeneres)} bulletins générés`
            }
            href="/etablissement/notes/approbation"
          />
        </div>

        <CarteEncaissements serie={encaissements} />

        {/* L'activite recente occupait toute la largeur pour une colonne de
            libelles courts. Elle passe a cote du recouvrement : c'est du
            contexte, pas le sujet de la page. */}
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <TauxRecouvrement finance={stats.finance} />
          <FluxActivite evenements={flux} />
        </div>

        {/* Repliee par defaut : le detail par classe est precieux quand on le
            cherche et encombrant quand on ne le cherche pas. Le resume porte
            l'essentiel, pour decider de deplier sans deplier. */}
        <CarteEffectifs classes={effectifs} />

        {/* Pleine largeur. Coinces dans une colonne de trois cinquiemes, les
            raccourcis tombaient a un mot par ligne. */}
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
    const [finance, encaissements] = await Promise.all([
      getDashboardComptable(annee.id),
      encaissementsAnnee(annee.id),
    ]);
    return layout(
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CarteMetrique
            label="Revenus attendus"
            valeur={fcfa(finance.attendu)}
            icone={Coins}
            ton="neutre"
            comparaison={`${nombre(finance.facturesTotal)} factures émises`}
            href="/etablissement/finances/factures"
          />
          <CarteMetrique
            label="Encaissé"
            valeur={fcfa(finance.encaisse)}
            icone={Wallet}
            ton="succes"
            variation={encaissements.variation}
            comparaison="Paiements enregistrés sur l’année"
            href="/etablissement/finances/paiements"
          />
          <CarteMetrique
            label="Reste à recouvrer"
            valeur={fcfa(finance.impaye)}
            icone={Coins}
            ton={finance.impaye > 0 ? 'alerte' : 'succes'}
            comparaison={`${nombre(finance.facturesTotal - finance.facturesSoldees)} factures non soldées`}
            href="/etablissement/finances/factures"
          />
          <CarteMetrique
            label="Factures soldées"
            valeur={`${nombre(finance.facturesSoldees)} / ${nombre(finance.facturesTotal)}`}
            icone={FileText}
            ton="primaire"
            comparaison={
              finance.facturesTotal > 0
                ? `${Math.round((finance.facturesSoldees / finance.facturesTotal) * 100)} % du portefeuille`
                : 'Aucune facture émise'
            }
          />
        </div>

        <CarteEncaissements serie={encaissements} />

        <TauxRecouvrement finance={finance} />

        {/* Pleine largeur. Coinces dans une demi-colonne, les raccourcis
            tombaient a un mot par ligne : leur propre grille a trois colonnes
            reduisait encore chaque carte au sixieme de la page. */}
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
    // La Secretaire suit les effectifs, pas l'argent : `getDashboardSecretaire`
    // ne renvoie deja aucun chiffre financier, et la courbe d'encaissements
    // n'aurait rien a faire ici.
    const [stats, effectifs] = await Promise.all([
      getDashboardSecretaire(annee.id),
      effectifsParClasse(annee.id),
    ]);
    return layout(
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CarteMetrique
            label="Élèves inscrits"
            valeur={nombre(stats.eleves.actifs)}
            icone={Users2}
            ton="primaire"
            comparaison={
              stats.eleves.nouveauxCeMois > 0
                ? `${nombre(stats.eleves.nouveauxCeMois)} nouveau${stats.eleves.nouveauxCeMois > 1 ? 'x' : ''} ce mois-ci`
                : 'Aucune nouvelle inscription ce mois-ci'
            }
            href="/etablissement/eleves"
          />
          <CarteMetrique
            label="Classes"
            valeur={nombre(stats.classes.nombre)}
            icone={School}
            ton="neutre"
            comparaison={`${nombre(stats.classes.effectifTotal)} élèves sur ${nombre(stats.classes.capaciteTotale)} places`}
            href="/etablissement/classes"
          />
          <CarteMetrique
            label="Notes à approuver"
            valeur={nombre(stats.notesEnAttente)}
            icone={BookOpen}
            ton={stats.notesEnAttente > 0 ? 'alerte' : 'neutre'}
            comparaison={
              stats.notesEnAttente > 0 ? 'En attente de validation' : 'Rien en attente'
            }
            href="/etablissement/notes/approbation"
          />
          <CarteMetrique
            label="Bulletins générés"
            valeur={nombre(stats.bulletinsGeneres)}
            icone={FileText}
            ton="succes"
            comparaison="Sur l’année scolaire en cours"
            href="/etablissement/notes/bulletins"
          />
        </div>

        <CarteEffectifs classes={effectifs} />

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
        <CarteMetrique
          label="Mes classes"
          valeur={nombre(stats.classes)}
          icone={School}
          ton="primaire"
          comparaison={`${nombre(stats.matieres)} matière${stats.matieres > 1 ? 's' : ''} enseignée${stats.matieres > 1 ? 's' : ''}`}
          href="/etablissement/mes-classes"
        />
        <CarteMetrique
          label="Mes matières"
          valeur={nombre(stats.matieres)}
          icone={BookOpen}
          ton="neutre"
          comparaison="Sur l’année scolaire en cours"
        />
        <CarteMetrique
          label="Mes évaluations"
          valeur={nombre(stats.evaluations)}
          icone={ClipboardList}
          ton="neutre"
          comparaison="Créées sur l’année"
        />
        <CarteMetrique
          label="Notes en brouillon"
          valeur={nombre(stats.notesBrouillon)}
          icone={FileText}
          ton={stats.notesBrouillon > 0 ? 'alerte' : 'succes'}
          comparaison={
            stats.notesBrouillon > 0
              ? 'À soumettre pour approbation'
              : 'Tout est soumis'
          }
          href="/etablissement/notes/saisie"
        />
      </div>

      <Raccourcis
        raccourcis={[RACCOURCIS.mesClasses!, RACCOURCIS.saisieNotes!, RACCOURCIS.rapports!]}
      />
    </>,
    `${annee.libelle} — mon espace`,
  );
}
