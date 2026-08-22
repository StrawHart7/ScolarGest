'use client';

import { useState, useTransition } from 'react';
import { FileText, GraduationCap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CarteListeMobile, LigneCarteMobile } from '@/components/ui/carte-liste-mobile';
import { genererBulletinAction, genererBulletinsClasseAction } from './actions';

export function BulletinsListe({
  eleves,
  classeId,
  periode,
  anneeScolaireId,
}: {
  eleves: { id: string; nom: string; prenoms: string; matricule: string }[];
  classeId: string;
  periode: string;
  anneeScolaireId: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, startBulkTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  function genererUn(eleveId: string) {
    setPendingId(eleveId);
    setErrors((prev) => ({ ...prev, [eleveId]: '' }));
    genererBulletinAction(eleveId, classeId, periode, anneeScolaireId)
      .then((result) => {
        setPendingId(null);
        // Une action expirée (504) peut renvoyer un résultat vide : on ne lit
        // jamais `.error`/`.url` sans garde, sinon le clic plante côté client.
        if (!result) {
          setErrors((prev) => ({ ...prev, [eleveId]: 'La génération a expiré. Réessayez.' }));
          return;
        }
        if (result.error) {
          setErrors((prev) => ({ ...prev, [eleveId]: result.error! }));
          return;
        }
        if (result.url) {
          window.open(result.url, '_blank', 'noopener,noreferrer');
        }
      })
      .catch(() => {
        setPendingId(null);
        setErrors((prev) => ({
          ...prev,
          [eleveId]: 'La génération a échoué (délai dépassé ou réseau). Réessayez.',
        }));
      });
  }

  function genererTout() {
    if (
      !window.confirm(
        `Générer le bulletin de ${eleves.length} élève(s) pour cette classe et cette période ?`,
      )
    )
      return;
    setBulkMessage(null);
    startBulkTransition(async () => {
      try {
        const result = await genererBulletinsClasseAction(classeId, periode, anneeScolaireId);
        if (!result) {
          setBulkMessage(
            'La génération groupée a expiré. Sur un gros effectif, générez par plus petits lots ou bulletin par bulletin.',
          );
          return;
        }
        if (result.error) {
          setBulkMessage(result.error);
          return;
        }
        setBulkMessage(`${result.succes} bulletin(s) généré(s), ${result.echecs} échec(s).`);
      } catch {
        setBulkMessage(
          'La génération groupée a échoué (délai dépassé). Sur un gros effectif, générez par plus petits lots ou bulletin par bulletin.',
        );
      }
    });
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-surface-border px-1 py-3 md:flex-row md:items-center md:justify-between md:p-4">
        <p className="text-body-sm text-text-secondary">
          {eleves.length} élève(s) inscrit(s) (statut ACTIF)
        </p>
        <Button
          size="sm"
          onClick={genererTout}
          disabled={bulkPending || eleves.length === 0}
          className="w-full md:w-auto"
        >
          {bulkPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          <span className="md:hidden">Générer tous les bulletins</span>
          <span className="hidden md:inline">Générer tous les bulletins de la classe</span>
        </Button>
      </div>
      {bulkMessage && <p className="px-4 pt-2 text-body-sm text-text-secondary">{bulkMessage}</p>}

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matricule</TableHead>
              <TableHead>Nom &amp; Prénoms</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eleves.map((eleve) => (
              <TableRow key={eleve.id}>
                <TableCell data-mono>{eleve.matricule}</TableCell>
                <TableCell className="font-medium">
                  {eleve.nom} {eleve.prenoms}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pendingId === eleve.id}
                      onClick={() => genererUn(eleve.id)}
                    >
                      {pendingId === eleve.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <FileText className="h-4 w-4" aria-hidden />
                      )}
                      Générer le bulletin
                    </Button>
                    {errors[eleve.id] && <p className="text-body-sm text-error">{errors[eleve.id]}</p>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CarteListeMobile>
        {eleves.map((eleve) => (
          <LigneCarteMobile
            key={eleve.id}
            icone={GraduationCap}
            titre={`${eleve.nom} ${eleve.prenoms}`}
            reference={eleve.matricule}
            actions={
              <div className="flex flex-col items-start gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pendingId === eleve.id}
                  onClick={() => genererUn(eleve.id)}
                >
                  {pendingId === eleve.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <FileText className="h-4 w-4" aria-hidden />
                  )}
                  Générer le bulletin
                </Button>
                {errors[eleve.id] && <p className="text-body-sm text-error">{errors[eleve.id]}</p>}
              </div>
            }
          />
        ))}
      </CarteListeMobile>
    </div>
  );
}
