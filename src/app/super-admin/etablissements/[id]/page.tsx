import Link from 'next/link';
import { Building2, Users, GraduationCap, School, Clock, CreditCard } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getEtablissement } from '@/services/etablissement';
import { listAbonnementsParEtablissement } from '@/services/abonnement';
import { listUtilisateursParEtablissement } from '@/services/utilisateur';
import {
  getFicheEtablissement,
  getPlacesFondatrices,
  type EtatEcole,
} from '@/services/plateforme';
import { PanneauFacturation } from './PanneauFacturation';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { formaterFCFA } from '@/lib/tarifs';
import { InviterDirecteurForm } from './InviterDirecteurForm';

const ETAB_STATUT_BADGE = {
  ACTIF: 'success',
  INACTIF: 'neutral',
  SUSPENDU: 'error',
} as const;

const ABONNEMENT_STATUT_BADGE = {
  ACTIF: 'success',
  EXPIRE: 'error',
  SUSPENDU: 'neutral',
} as const;

const TON_ETAT: Record<EtatEcole, 'success' | 'warning' | 'error' | 'neutral' | 'primary'> = {
  ACTIF: 'success',
  ESSAI: 'primary',
  EXPIRE: 'warning',
  SUSPENDU: 'error',
  AUCUN: 'neutral',
};

const LIBELLE_ETAT: Record<EtatEcole, string> = {
  ACTIF: 'Abonnee',
  ESSAI: 'En essai',
  EXPIRE: 'Expiree',
  SUSPENDU: 'Suspendue',
  AUCUN: 'Sans abonnement',
};

const UTILISATEUR_STATUT_BADGE = {
  ACTIF: 'success',
  INACTIF: 'neutral',
  BLOQUE: 'error',
} as const;

export default async function EtablissementDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const [etablissement, abonnements, utilisateurs, fiche, places] = await Promise.all([
    getEtablissement(params.id),
    listAbonnementsParEtablissement(params.id),
    listUtilisateursParEtablissement(params.id),
    getFicheEtablissement(params.id),
    getPlacesFondatrices(),
  ]);

  const joursInactif =
    fiche.derniereActivite === null
      ? null
      : Math.floor((Date.now() - new Date(fiche.derniereActivite).getTime()) / 86400000);

  return (
    <AppLayout
      items={getSidebarItems('SUPER_ADMIN')}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <LienRetour href="/super-admin/etablissements">Retour aux établissements</LienRetour>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
              <Building2 className="h-7 w-7" aria-hidden />
            </div>
            <div>
              <p className="text-headline-sm text-text-primary">{etablissement.nom}</p>
              <p className="text-body-sm text-text-secondary">
                {etablissement.ville ?? '—'} · {etablissement.email ?? '—'}
              </p>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1.5">
              {/* L'etat de facturation d'abord : c'est lui qui commande l'acces
                  reel de l'ecole. Le statut administratif d'`etablissement` est
                  une autre information, plus rarement utile. */}
              <Badge shape="pill" variant={TON_ETAT[fiche.etat]}>
                {LIBELLE_ETAT[fiche.etat]}
              </Badge>
              <Badge shape="pill" variant={ETAB_STATUT_BADGE[etablissement.statut]}>
                {etablissement.statut}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Usage reel. Repond a la seule question qui compte avant de relancer
            ou de suspendre : cette ecole s'en sert-elle ? Un abonnement expire
            chez une ecole a 400 eleves et le meme chez une coquille vide
            n'appellent pas le meme geste commercial. */}
        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="border-b border-surface-border bg-surface-container-low/50 p-5">
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Mesure icone={Users} libelle="Eleves inscrits" valeur={fiche.nombreEleves} />
              <Mesure icone={School} libelle="Classes" valeur={fiche.nombreClasses} />
              <Mesure icone={GraduationCap} libelle="Enseignants" valeur={fiche.nombreEnseignants} />
              <Mesure
                icone={Clock}
                libelle="Derniere activite"
                valeur={joursInactif === null ? 'jamais' : joursInactif === 0 ? 'ce jour' : joursInactif + ' j'}
              />
            </div>
            <dl className="mt-5 flex flex-col gap-2 border-t border-surface-border pt-4 text-body-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Cycles exploites</dt>
                <dd className="text-right text-text-primary">
                  {fiche.cycles.length > 0 ? fiche.cycles.join(', ') : 'aucun'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Annee scolaire active</dt>
                <dd className="text-right text-text-primary">{fiche.anneeActive ?? 'aucune'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Essai gratuit</dt>
                <dd className="text-right text-text-primary">
                  {fiche.essaiDebuteLe === null
                    ? 'jamais demarre'
                    : new Date(fiche.essaiDebuteLe).toLocaleDateString('fr-FR')}
                  {fiche.essaiFinLe !== null &&
                    ' au ' + new Date(fiche.essaiFinLe).toLocaleDateString('fr-FR')}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Gestes commerciaux. Places apres l'usage, deliberement : on decide
            de prolonger ou de suspendre au vu de ce que l'ecole fait du
            produit, pas avant de l'avoir regarde. */}
        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="border-b border-surface-border bg-surface-container-low/50 p-5">
            <CardTitle>Abonnement et acces</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <PanneauFacturation
              etablissementId={params.id}
              essaiDemarre={fiche.essaiDebuteLe !== null}
              suspension={fiche.suspension}
              regime={etablissement.regimeTarifaire}
              tarifFondateur={
                etablissement.tarifFondateurMensuel === null
                  ? null
                  : Number(etablissement.tarifFondateurMensuel)
              }
              places={places}
            />
          </CardContent>
        </Card>

        {/* Paiements en ligne. `honoree` vient de `abonnementId`, pas du statut :
            c'est la preuve qu'une periode a bien ete ouverte, ce qui resiste a
            un webhook perdu qui aurait laisse le statut en attente. */}
        {fiche.transactions.length > 0 && (
          <Card className="overflow-hidden rounded-xl">
            <CardHeader className="border-b border-surface-border bg-surface-container-low/50 p-5">
              <CardTitle>Paiements en ligne</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-surface-border/60">
                {fiche.transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <CreditCard className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-body-sm text-text-primary" data-mono>
                          {formaterFCFA(t.montant)}
                        </span>
                        <span className="block text-body-sm text-text-secondary">
                          {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                          {t.operateur !== null && ' - ' + t.operateur}
                        </span>
                      </span>
                    </span>
                    <Badge
                      shape="pill"
                      variant={t.honoree ? 'success' : t.statut === 'EN_ATTENTE' ? 'warning' : 'error'}
                    >
                      {t.honoree ? 'Honore' : t.statut === 'EN_ATTENTE' ? 'En attente' : 'Echoue'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="flex-row items-center justify-between border-b border-surface-border bg-surface-container-low/50 p-5">
            <CardTitle>Abonnements</CardTitle>
            <Button asChild variant="secondary" size="sm">
              <Link href="/super-admin/abonnements/nouveau">Nouvel abonnement</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {abonnements.length === 0 ? (
              <p className="p-5 text-body-sm text-text-secondary">Aucun abonnement enregistré.</p>
            ) : (
              <Table dense>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abonnements.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-body-sm font-medium">{a.plan.nom}</TableCell>
                      <TableCell>
                        <Badge shape="pill" variant={ABONNEMENT_STATUT_BADGE[a.statut]}>
                          {a.statut}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-body-sm text-text-secondary" data-mono>
                        {new Date(a.dateFin).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/super-admin/abonnements/${a.id}/paiement`}>
                            Valider un paiement
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 border-b border-surface-border bg-surface-container-low/50 p-5">
            <CardTitle className="pt-1.5">Utilisateurs</CardTitle>
            <div className="w-full sm:w-auto">
              <InviterDirecteurForm etablissementId={etablissement.id} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {utilisateurs.length === 0 ? (
              <p className="p-5 text-body-sm text-text-secondary">Aucun utilisateur créé.</p>
            ) : (
              <Table dense>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {utilisateurs.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-body-sm font-medium">
                        {u.prenom} {u.nom}
                      </TableCell>
                      <TableCell className="text-body-sm text-text-secondary">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="primary">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge shape="pill" variant={UTILISATEUR_STATUT_BADGE[u.statut]}>
                          {u.statut}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function Mesure({
  icone: Icone,
  libelle,
  valeur,
}: {
  icone: React.ComponentType<{ className?: string }>;
  libelle: string;
  valeur: string | number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-label-md uppercase tracking-wide text-text-secondary">
        <Icone className="h-3.5 w-3.5" />
        {libelle}
      </span>
      <span className="text-headline-sm font-semibold text-text-primary" data-mono>
        {valeur}
      </span>
    </div>
  );
}
