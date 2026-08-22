import Link from 'next/link';
import { ArrowLeft, UserCircle2, FileText, Receipt } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getEleve } from '@/services/eleve';
import { getFacturesEleve } from '@/services/facture';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSidebarItems } from '@/lib/navigation';
import { ArchiverEleveButton, AnnulerInscriptionButton } from './EleveActions';
import { AjouterResponsableForm, ModifierResponsableForm } from './ResponsableForms';

export default async function FicheElevePage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const eleve = await getEleve(params.id);
  const factures = await getFacturesEleve(params.id);
  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';
  const inscriptionActive = eleve.inscriptions.find((i) => i.statut === 'ACTIVE');

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/etablissement/eleves"
          className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour aux élèves
        </Link>

        <Card>
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
                <UserCircle2 className="h-8 w-8" aria-hidden />
              </div>
              <div>
                <p className="text-headline-sm text-text-primary">
                  {eleve.nom} {eleve.prenoms}
                </p>
                <p className="text-body-sm text-text-secondary" data-mono>
                  Matricule : {eleve.matricule}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={eleve.statut === 'ACTIF' ? 'success' : 'neutral'} shape="pill">
                {eleve.statut}
              </Badge>
              {canWrite && !inscriptionActive && (
                <Button asChild size="sm">
                  <Link href={`/etablissement/eleves/${eleve.id}/inscription`}>Inscrire</Link>
                </Button>
              )}
              <Button asChild size="sm" variant="secondary">
                <Link href={`/etablissement/eleves/${eleve.id}/bulletins`}>
                  <FileText className="h-4 w-4" aria-hidden />
                  Bulletins
                </Link>
              </Button>
              {canWrite && <ArchiverEleveButton eleveId={eleve.id} />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 text-body-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-secondary">Sexe</dt>
                <dd className="text-text-primary">{eleve.sexe === 'M' ? 'Masculin' : 'Féminin'}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Date de naissance</dt>
                <dd className="text-text-primary" data-mono>
                  {new Date(eleve.dateNaissance).toLocaleDateString('fr-FR')}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Lieu de naissance</dt>
                <dd className="text-text-primary">{eleve.lieuNaissance ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Nationalité</dt>
                <dd className="text-text-primary">{eleve.nationalite ?? '—'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>Responsables légaux</CardTitle>
            {canWrite && <AjouterResponsableForm eleveId={eleve.id} />}
          </CardHeader>
          <CardContent className="space-y-3">
            {eleve.responsables.length === 0 ? (
              <p className="text-body-sm text-text-secondary">Aucun responsable enregistré.</p>
            ) : (
              eleve.responsables.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-body-md text-text-primary">
                      {r.responsable.nom} {r.responsable.prenoms}
                      {r.principal && (
                        <Badge variant="primary" className="ml-2">
                          Principal
                        </Badge>
                      )}
                    </p>
                    <p className="text-body-sm text-text-secondary">
                      {r.lienParente} — {r.responsable.telephone ?? 'Tél. non renseigné'}
                      {r.responsable.email ? ` — ${r.responsable.email}` : ''}
                    </p>
                  </div>
                  {canWrite && (
                    <ModifierResponsableForm
                      eleveId={eleve.id}
                      responsable={{
                        responsableId: r.responsable.id,
                        nom: r.responsable.nom,
                        prenoms: r.responsable.prenoms,
                        telephone: r.responsable.telephone,
                        email: r.responsable.email,
                        adresse: r.responsable.adresse,
                        profession: r.responsable.profession,
                        type: r.responsable.type,
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historique des inscriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {eleve.inscriptions.length === 0 ? (
              <p className="text-body-sm text-text-secondary">Aucune inscription enregistrée.</p>
            ) : (
              eleve.inscriptions.map((i) => (
                <div
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-border p-3"
                >
                  <div>
                    <p className="text-body-md text-text-primary">
                      {i.classe.nom} — {i.anneeScolaire.libelle}
                    </p>
                    <p className="text-body-sm text-text-secondary">
                      Statut : {i.statut}
                      {i.decisionFinAnnee ? ` — ${i.decisionFinAnnee}` : ''}
                    </p>
                  </div>
                  {canWrite && i.statut === 'ACTIVE' && (
                    <AnnulerInscriptionButton eleveId={eleve.id} inscriptionId={i.id} />
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facturation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {factures.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <FileText className="h-8 w-8 text-text-secondary/50" aria-hidden />
                <p className="text-body-sm text-text-secondary">Aucune facture pour cet élève.</p>
              </div>
            ) : (
              factures.map((f) => (
                <div key={f.id} className="rounded-lg border border-surface-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-body-md text-text-primary">
                      Facture — {new Date(f.dateCreation).toLocaleDateString('fr-FR')}
                    </p>
                    <Badge variant={f.statut === 'PAYE' ? 'success' : 'warning'} shape="pill">
                      {f.statut}
                    </Badge>
                  </div>
                  <p className="mt-1 text-body-sm text-text-secondary" data-mono>
                    Total : {f.montantTotal.toLocaleString('fr-FR')} FCFA
                  </p>
                  {f.lignes.length > 0 && (
                    <ul className="mt-2 space-y-1 text-body-sm text-text-secondary">
                      {f.lignes.map((l) => (
                        <li key={l.id} className="flex justify-between">
                          <span>{l.designation}</span>
                          <span data-mono>{l.montant.toLocaleString('fr-FR')} FCFA</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/etablissement/finances/factures/${f.id}`}>
                        <Receipt className="h-4 w-4" aria-hidden />
                        Ouvrir la facture
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
