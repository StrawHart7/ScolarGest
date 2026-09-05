import Link from 'next/link';
import { FileText } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getEleve } from '@/services/eleve';
import { listDocumentsEleve, getUrlTelechargementDocument } from '@/services/document';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { RegenererBulletinButton, TelechargerBulletinLink } from './RegenererBulletinButton';

const STATUT_BADGE: Record<string, 'success' | 'neutral' | 'warning'> = {
  GENERE: 'success',
  OBSOLETE: 'neutral',
  ARCHIVE: 'warning',
};

export default async function BulletinsElevePage({ params }: { params: { id: string } }) {
  const ctx = await getTenantContext();
  const eleve = await getEleve(params.id);
  const canWrite = ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE';
  const inscriptionActive = eleve.inscriptions.find((i) => i.statut === 'ACTIVE');

  const documents = await listDocumentsEleve(params.id);
  const documentsAvecUrl = await Promise.all(
    documents.map(async (d) => ({
      ...d,
      url: d.statut === 'GENERE' ? await getUrlTelechargementDocument(d.id) : null,
    })),
  );

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <LienRetour href={`/etablissement/eleves/${eleve.id}`}>Retour à la fiche élève</LienRetour>

        {/*
          Le nom de l'eleve tenait dans un `CardTitle`, donc la page n'avait
          aucun `<h1>`. Sur telephone il n'y a pas de barre laterale pour
          situer : l'en-tete affiche « ScolarGest » et rien d'autre ne nomme
          l'ecran.
        */}
        <div>
          <h1 className="text-display-sm text-text-primary">Bulletins</h1>
          <p className="mt-1 text-body-md text-text-secondary">
            {eleve.nom} {eleve.prenoms} — <span data-mono>{eleve.matricule}</span>
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bulletins édités</CardTitle>
          </CardHeader>
          <CardContent>
            {!canWrite ? null : !inscriptionActive ? (
              <p className="text-body-sm text-text-secondary">
                Aucune inscription active pour cet élève sur l&apos;année scolaire en cours : la
                régénération de bulletin n&apos;est pas disponible.
              </p>
            ) : null}
          </CardContent>

          {documentsAvecUrl.length === 0 ? (
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <FileText className="h-10 w-10 text-text-secondary/50" aria-hidden />
              <p className="text-body-sm text-text-secondary">
                Aucun bulletin généré pour cet élève. Rendez-vous sur{' '}
                <Link href="/etablissement/notes/bulletins" className="text-primary hover:underline">
                  Génération de bulletins
                </Link>{' '}
                pour en créer un.
              </p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date de génération</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentsAvecUrl.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell data-mono>{doc.reference}</TableCell>
                    <TableCell>{new Date(doc.dateGeneration).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>
                      <Badge variant={STATUT_BADGE[doc.statut] ?? 'neutral'} shape="pill">
                        {doc.statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2">
                        {doc.url && <TelechargerBulletinLink url={doc.url} />}
                        {canWrite && inscriptionActive && doc.statut === 'GENERE' && (
                          <RegenererBulletinButton
                            documentId={doc.id}
                            classeId={inscriptionActive.classeId}
                            anneeScolaireId={inscriptionActive.anneeScolaireId}
                            eleveId={eleve.id}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
