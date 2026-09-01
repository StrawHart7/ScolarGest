'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Download, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { Creneau } from '@/lib/emploi-du-temps';
import {
  placerCreneauAction,
  retirerCreneauAction,
  verifierConflitAction,
} from './emploi-du-temps-actions';

/**
 * Grille hebdomadaire d'une classe : jours en colonnes, heures en lignes.
 *
 * Aucune heure d'horloge n'est affichée — les lignes sont des rangs ordonnés
 * (« Première heure »…). Une école togolaise n'a pas de journée type
 * universelle, et imposer une grille horaire obligerait chacune à décrire sa
 * journée avant de placer le moindre cours.
 *
 * Le conflit d'enseignant est **annoncé puis refusé** : la vérification
 * préalable produit une phrase lisible (« M. Kossi assure déjà Mathématiques
 * en 3ème A »), l'index unique en base refuse l'écriture. La première sert le
 * confort, la seconde la correction — deux saisies simultanées passeraient la
 * vérification applicative sans jamais franchir la contrainte.
 */

/** Sentinelle : Radix refuse une valeur vide sur un `SelectItem`. */
const AUCUN = 'AUCUN';

export interface OptionMatiere {
  id: string;
  nom: string;
}

export interface OptionEnseignant {
  id: string;
  nom: string;
  prenoms: string;
}

interface Props {
  classeId: string;
  anneeScolaireId: string;
  creneaux: Creneau[];
  matieres: OptionMatiere[];
  enseignants: OptionEnseignant[];
  jours: readonly string[];
  rangs: readonly string[];
  /** Directeur et Secrétaire modifient ; les autres consultent. */
  modifiable: boolean;
}

interface CaseOuverte {
  jour: number;
  rang: number;
  existant: Creneau | undefined;
}

export function GrilleEmploiDuTemps({
  classeId,
  anneeScolaireId,
  creneaux,
  matieres,
  enseignants,
  jours,
  rangs,
  modifiable,
}: Props) {
  const router = useRouter();
  const { succes, erreur } = useToast();

  const index = React.useMemo(() => {
    const m = new Map<string, Creneau>();
    for (const c of creneaux) m.set(`${c.jour}:${c.rang}`, c);
    return m;
  }, [creneaux]);

  const [ouverte, setOuverte] = React.useState<CaseOuverte | null>(null);
  const [matiereId, setMatiereId] = React.useState<string>('');
  const [enseignantId, setEnseignantId] = React.useState<string>(AUCUN);
  const [salle, setSalle] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [conflit, setConflit] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

  function ouvrir(jour: number, rang: number) {
    if (!modifiable) return;
    const existant = index.get(`${jour}:${rang}`);
    setOuverte({ jour, rang, existant });
    setMatiereId(existant?.matiereId ?? '');
    setEnseignantId(existant?.enseignantId ?? AUCUN);
    setSalle(existant?.salle ?? '');
    setPin('');
    setConflit(null);
  }

  // L'avertissement se recalcule dès que l'enseignant change, avant tout
  // enregistrement : découvrir le conflit au moment de valider serait tard.
  React.useEffect(() => {
    if (!ouverte || enseignantId === AUCUN) {
      setConflit(null);
      return;
    }
    let annule = false;
    (async () => {
      let resultat: Awaited<ReturnType<typeof verifierConflitAction>> | undefined;
      try {
        resultat = await verifierConflitAction({
          enseignantId,
          anneeScolaireId,
          jour: ouverte.jour,
          rang: ouverte.rang,
          creneauIgnoreId: ouverte.existant?.id,
        });
      } catch {
        resultat = undefined;
      }
      if (annule) return;
      const c = resultat?.ok ? resultat.conflit : null;
      setConflit(
        c ? `Cet enseignant assure déjà ${c.matiereNom} en ${c.classeNom} sur ce créneau.` : null,
      );
    })();
    return () => {
      annule = true;
    };
  }, [ouverte, enseignantId, anneeScolaireId]);

  async function enregistrer() {
    if (!ouverte || !matiereId) return;
    setEnCours(true);
    let resultat: Awaited<ReturnType<typeof placerCreneauAction>> | undefined;
    try {
      resultat = await placerCreneauAction({
        classeId,
        anneeScolaireId,
        jour: ouverte.jour,
        rang: ouverte.rang,
        matiereId,
        enseignantId: enseignantId === AUCUN ? null : enseignantId,
        salle: salle.trim() || null,
        pin,
      });
    } catch {
      resultat = undefined;
    }
    setEnCours(false);
    if (!resultat || !resultat.ok) {
      erreur('Enregistrement impossible', resultat?.message ?? 'Connexion interrompue. Réessayez.');
      return;
    }
    setOuverte(null);
    succes('Créneau enregistré');
    router.refresh();
  }

  async function retirer() {
    if (!ouverte?.existant) return;
    setEnCours(true);
    let resultat: Awaited<ReturnType<typeof retirerCreneauAction>> | undefined;
    try {
      resultat = await retirerCreneauAction({ id: ouverte.existant.id, classeId, pin });
    } catch {
      resultat = undefined;
    }
    setEnCours(false);
    if (!resultat || !resultat.ok) {
      erreur('Suppression impossible', resultat?.message ?? 'Connexion interrompue. Réessayez.');
      return;
    }
    setOuverte(null);
    succes('Créneau retiré');
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="secondary" size="sm">
          {/* Lien direct plutôt qu'un appel client : le navigateur reçoit le
              PDF avec son en-tête de téléchargement, sans transiter par React. */}
          <a href={`/api/emploi-du-temps?classeId=${classeId}`} download>
            <Download className="h-4 w-4" aria-hidden />
            Télécharger en PDF
          </a>
        </Button>
      </div>

      {/* La grille déborde sur mobile plutôt que de se comprimer : six colonnes
          lisibles valent mieux que six colonnes illisibles. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-body-sm">
          <thead>
            <tr>
              <th className="w-32 border border-surface-border bg-surface-container-low p-2" />
              {jours.map((jour) => (
                <th
                  key={jour}
                  className="border border-surface-border bg-surface-container-low p-2 text-label-md uppercase tracking-wide text-text-secondary"
                >
                  {jour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rangs.map((libelle, i) => {
              const rang = i + 1;
              return (
                <tr key={libelle}>
                  <th className="border border-surface-border bg-surface-container-low p-2 text-left text-body-sm font-medium text-text-secondary">
                    {libelle}
                  </th>
                  {jours.map((_, j) => {
                    const jour = j + 1;
                    const creneau = index.get(`${jour}:${rang}`);
                    return (
                      <td
                        key={jour}
                        className="border border-surface-border p-0 align-top"
                      >
                        <button
                          type="button"
                          onClick={() => ouvrir(jour, rang)}
                          disabled={!modifiable}
                          className={cn(
                            'flex h-20 w-full flex-col items-center justify-center gap-0.5 p-2 text-center transition-colors',
                            modifiable && 'hover:bg-primary-fixed/40',
                            !modifiable && 'cursor-default',
                            creneau && 'bg-primary-fixed/20',
                          )}
                          aria-label={
                            creneau
                              ? `${creneau.matiere.nom}, ${jours[j]} ${libelle}`
                              : `Case libre, ${jours[j]} ${libelle}`
                          }
                        >
                          {creneau ? (
                            <>
                              <span className="text-body-sm font-medium text-text-primary">
                                {creneau.matiere.nom}
                              </span>
                              {creneau.enseignant && (
                                <span className="text-body-sm text-text-secondary">
                                  {creneau.enseignant.nom} {creneau.enseignant.prenoms}
                                </span>
                              )}
                              {creneau.salle && (
                                <span className="text-label-md text-text-secondary">
                                  {creneau.salle}
                                </span>
                              )}
                            </>
                          ) : (
                            modifiable && (
                              <Plus className="h-4 w-4 text-text-secondary/40" aria-hidden />
                            )
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={ouverte !== null} onOpenChange={(o) => !o && setOuverte(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ouverte ? `${jours[ouverte.jour - 1]} — ${rangs[ouverte.rang - 1]}` : ''}
            </DialogTitle>
            <DialogDescription>
              Choisissez la matière enseignée sur ce créneau. Seules les matières au programme
              du niveau sont proposées.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            {matieres.length === 0 ? (
              <p className="text-body-sm text-text-secondary">
                Aucune matière n&apos;est encore au programme de ce niveau. Renseignez le
                programme avant de construire l&apos;emploi du temps.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edt-matiere">Matière</Label>
                  <Select value={matiereId} onValueChange={setMatiereId}>
                    <SelectTrigger id="edt-matiere">
                      <SelectValue placeholder="Choisir une matière" />
                    </SelectTrigger>
                    <SelectContent>
                      {matieres.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edt-enseignant">Enseignant</Label>
                  <Select value={enseignantId} onValueChange={setEnseignantId}>
                    <SelectTrigger id="edt-enseignant">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUCUN}>À définir</SelectItem>
                      {enseignants.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nom} {e.prenoms}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {conflit && (
                  <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-body-sm text-text-primary">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                    {conflit} L&apos;enregistrement sera refusé.
                  </p>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edt-salle">Salle (facultatif)</Label>
                  <Input
                    id="edt-salle"
                    value={salle}
                    onChange={(e) => setSalle(e.target.value)}
                    placeholder="Salle 12, Labo…"
                    maxLength={60}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edt-pin">PIN de confirmation</Label>
                  <Input
                    id="edt-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••••"
                  />
                </div>
              </>
            )}
          </DialogBody>

          <DialogFooter>
            {ouverte?.existant && (
              <Button
                variant="ghost"
                onClick={retirer}
                disabled={enCours || pin.length < 4}
                className="mr-auto text-error"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Retirer
              </Button>
            )}
            <Button variant="secondary" onClick={() => setOuverte(null)} disabled={enCours}>
              Annuler
            </Button>
            <Button
              onClick={enregistrer}
              chargement={enCours}
              disabled={enCours || !matiereId || pin.length < 4 || conflit !== null}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
