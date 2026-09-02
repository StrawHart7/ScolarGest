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
import { TelechargerTout } from './TelechargerTout';

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

export function BulletinsGeneresListe({
  lignes,
  classeId,
  periode,
  anneeScolaireId,
  libelleClasse,
}: {
  lignes: LigneBulletin[];
  classeId: string;
  periode: string;
  anneeScolaireId: string;
  libelleClasse: string;
}) {
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  function telecharger(documentId: string) {
    setEnCours(documentId);
    setErreurs((prec) => ({ ...prec, [documentId]: '' }));
    // L'onglet est ouvert MAINTENANT, dans le geste de l'utilisateur : c'est la
    // seule fenêtre où le navigateur l'autorise sans condition. L'URL signée y
    // sera posée quand l'action reviendra.
    //
    // Ne jamais passer `noopener` ici : avec cette option, `window.open`
    // renvoie `null` **même quand l'onglet s'ouvre**, et tout test « null donc
    // bloqué » se déclenche alors à chaque téléchargement réussi. C'est
    // exactement ce qui affichait « le navigateur a bloqué la fenêtre » à des
    // utilisateurs qui avaient autorisé les fenêtres surgissantes.
    const onglet = window.open('', '_blank');
    if (onglet) onglet.opener = null;
    telechargerBulletinAction(documentId)
      .then((resultat) => {
        setEnCours(null);
        // Une Server Action interrompue peut se résoudre sur `undefined` : on
        // ne lit jamais `.url` sans garde, sinon le clic plante côté client.
        if (!resultat) {
          onglet?.close();
          setErreurs((prec) => ({ ...prec, [documentId]: 'Le lien a expiré. Réessayez.' }));
          return;
        }
        if (resultat.error) {
          onglet?.close();
          setErreurs((prec) => ({ ...prec, [documentId]: resultat.error! }));
          return;
        }
        if (resultat.url) {
          if (onglet) {
            onglet.location.href = resultat.url;
          } else {
            // Ici seulement le blocage est réel : l'ouverture a été refusée
            // dans le geste même de l'utilisateur.
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
        onglet?.close();
        setErreurs((prec) => ({ ...prec, [documentId]: 'Le téléchargement a échoué.' }));
      });
  }

  const prets = lignes.filter((l) => l.courant !== null).length;

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-surface-border px-1 py-3 md:flex-row md:items-center md:justify-between md:p-4">
        <p className="text-body-sm text-text-secondary">
          {prets} bulletin(s) prêt(s) sur {lignes.length} élève(s) inscrit(s)
        </p>
        <TelechargerTout
          classeId={classeId}
          periode={periode}
          anneeScolaireId={anneeScolaireId}
          nombreEdites={prets}
          libelleClasse={libelleClasse}
        />
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matricule</TableHead>
              <TableHead>Nom &amp; Prénoms</TableHead>
              <TableHead>État</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Prêt le</TableHead>
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
                      <Badge variant="success">Prêt</Badge>
                      {ligne.versionsRemplacees > 0 && (
                        <Badge variant="neutral">
                          {ligne.versionsRemplacees} version(s) remplacée(s)
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <Badge variant="warning">À générer</Badge>
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
                  <Badge variant="warning">À générer</Badge>
                )}
              </div>
            }
          />
        ))}
      </CarteListeMobile>
    </div>
  );
}
