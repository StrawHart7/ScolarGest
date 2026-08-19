import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getEleve } from '@/services/eleve';
import { listDocumentsEleve, getUrlTelechargementDocument } from '@/services/document';
import { AppLayout } from '@/components/layout/AppLayout';
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
        <Link
          href={`/etablissement/eleves/${eleve.id}`}
          className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la fiche élève
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>
              Bulletins — {eleve.nom} {eleve.prenoms}
            </CardTitle>
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
