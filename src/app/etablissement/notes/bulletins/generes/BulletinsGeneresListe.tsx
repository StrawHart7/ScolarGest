'use client';

import { useState } from 'react';
import { Download, GraduationCap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { CarteListeMobile, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { telechargerBulletinAction } from './actions';

export interface LigneBulletin {
  eleveId: string;
  nom: string;
  prenoms: string;
  matricule: string;
  /** Bulletin en vigueur (statut GENERE), s'il existe. */
  courant: { documentId: string; reference: string; dateGeneration: string } | null;
  /** Versions remplacées par une régénération. */
  versionsRemplacees: number;
}

function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function BulletinsGeneresListe({ lignes }: { lignes: LigneBulletin[] }) {
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  function telecharger(documentId: string) {
    setEnCours(documentId);
    setErreurs((prec) => ({ ...prec, [documentId]: '' }));
    telechargerBulletinAction(documentId)
      .then((resultat) => {
        setEnCours(null);
        // Une Server Action interrompue peut se résoudre sur `undefined` : on
        // ne lit jamais `.url` sans garde, sinon le clic plante côté client.
        if (!resultat) {
          setErreurs((prec) => ({ ...prec, [documentId]: 'Le lien a expiré. Réessayez.' }));
          return;
        }
        if (resultat.error) {
          setErreurs((prec) => ({ ...prec, [documentId]: resultat.error! }));
          return;
        }
        if (resultat.url) {
          const onglet = window.open(resultat.url, '_blank', 'noopener,noreferrer');
          // Un bloqueur de fenêtres surgissantes rendait la génération
          // silencieuse : rien ne s'ouvrait, et rien ne le disait.
          if (!onglet) {
            setErreurs((prec) => ({
              ...prec,
              [documentId]:
                'Le navigateur a bloqué la fenêtre. Autorisez les fenêtres surgissantes pour ce site.',
            }));
          }
        }
      })
      .catch(() => {
        setEnCours(null);
        setErreurs((prec) => ({ ...prec, [documentId]: 'Le téléchargement a échoué.' }));
      });
  }

  const edites = lignes.filter((l) => l.courant !== null).length;

  return (
    <div>
      <div className="border-b border-surface-border px-1 py-3 md:p-4">
        <p className="text-body-sm text-text-secondary">
          {edites} bulletin(s) édité(s) sur {lignes.length} élève(s) inscrit(s)
        </p>
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matricule</TableHead>
              <TableHead>Nom &amp; Prénoms</TableHead>
              <TableHead>État</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Édité le</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((ligne) => (
              <TableRow key={ligne.eleveId}>
                <TableCell data-mono>{ligne.matricule}</TableCell>
                <TableCell className="font-medium">
                  {ligne.nom} {ligne.prenoms}
                </TableCell>
                <TableCell>
                  {ligne.courant ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="success">Édité</Badge>
                      {ligne.versionsRemplacees > 0 && (
                        <Badge variant="neutral">
                          {ligne.versionsRemplacees} version(s) remplacée(s)
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <Badge variant="warning">Non édité</Badge>
                  )}
                </TableCell>
                <TableCell data-mono>{ligne.courant?.reference ?? '—'}</TableCell>
                <TableCell>
                  {ligne.courant ? formaterDate(ligne.courant.dateGeneration) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    {ligne.courant ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={enCours === ligne.courant.documentId}
                        onClick={() => telecharger(ligne.courant!.documentId)}
                      >
                        {enCours === ligne.courant.documentId ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Download className="h-4 w-4" aria-hidden />
                        )}
                        Télécharger
                      </Button>
                    ) : (
                      <span className="text-body-sm text-text-secondary">
                        À générer sur l’écran de génération
                      </span>
                    )}
                    {ligne.courant && erreurs[ligne.courant.documentId] && (
                      <p className="text-body-sm text-error">
                        {erreurs[ligne.courant.documentId]}
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CarteListeMobile>
        {lignes.map((ligne) => (
          <LigneCarteMobile
            key={ligne.eleveId}
            icone={GraduationCap}
            titre={`${ligne.nom} ${ligne.prenoms}`}
            reference={ligne.courant ? ligne.courant.reference : ligne.matricule}
            actions={
              <div className="flex flex-col items-start gap-1">
                {ligne.courant ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={enCours === ligne.courant.documentId}
                      onClick={() => telecharger(ligne.courant!.documentId)}
                    >
                      {enCours === ligne.courant.documentId ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Download className="h-4 w-4" aria-hidden />
                      )}
                      Télécharger
                    </Button>
                    {erreurs[ligne.courant.documentId] && (
                      <p className="text-body-sm text-error">
                        {erreurs[ligne.courant.documentId]}
                      </p>
                    )}
                  </>
                ) : (
                  <Badge variant="warning">Non édité</Badge>
                )}
              </div>
            }
          />
        ))}
      </CarteListeMobile>
    </div>
  );
}
