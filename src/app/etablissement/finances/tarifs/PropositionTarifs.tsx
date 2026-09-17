'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { PropositionTarif, ConflitTarif } from '@/lib/reconduction';
import { validerTarifsReconduitsAction } from './actions';

const fcfa = (montant: number) => `${Number(montant).toLocaleString('fr-FR')} FCFA`;

/**
 * Les tarifs de l'an dernier, pré-remplis, à relire avant d'être posés.
 *
 * **Proposer et non poser** : un tarif est immuable une fois créé (doc 08 § 6).
 * Les écrire d'office enfermerait l'école dans les prix de l'an dernier pour
 * toute l'année, alors qu'une rentrée est justement le moment où ils bougent.
 * Le Directeur voit les montants remplis, corrige ceux qui ont changé, valide
 * une fois — et ne ressaisit rien.
 *
 * Les montants sont groupés **par classe** parce que c'est ainsi qu'ils sont
 * stockés et facturés, mais ils viennent du niveau : la 6ème A et la 6ème B
 * portent la même ligne, et la modifier des deux côtés est un geste conscient.
 */
export function PropositionTarifs({
  anneeScolaireId,
  sourceLibelle,
  propositions,
  conflits,
}: {
  anneeScolaireId: string;
  sourceLibelle: string;
  propositions: PropositionTarif[];
  conflits: ConflitTarif[];
}) {
  const [montants, setMontants] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      propositions.map((p) => [`${p.classeCibleId}|${p.typeFraisId}`, String(p.montant)]),
    ),
  );
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const parClasse = useMemo(() => {
    const groupes = new Map<string, { nom: string; lignes: PropositionTarif[] }>();
    for (const p of propositions) {
      const groupe = groupes.get(p.classeCibleId) ?? { nom: p.classeCibleNom, lignes: [] };
      groupe.lignes.push(p);
      groupes.set(p.classeCibleId, groupe);
    }
    return [...groupes.entries()].sort((a, b) => a[1].nom.localeCompare(b[1].nom, 'fr'));
  }, [propositions]);

  const total = useMemo(
    () => Object.values(montants).reduce((s, v) => s + (Number(v) || 0), 0),
    [montants],
  );

  function valider() {
    setErreur(null);
    const lignes = propositions.map((p) => ({
      classeId: p.classeCibleId,
      typeFraisId: p.typeFraisId,
      montant: Number(montants[`${p.classeCibleId}|${p.typeFraisId}`] ?? p.montant),
    }));
    if (lignes.some((l) => !Number.isFinite(l.montant) || l.montant < 0)) {
      setErreur('Chaque montant doit être un nombre positif.');
      return;
    }
    demarrer(async () => {
      const reponse = await validerTarifsReconduitsAction(anneeScolaireId, lignes);
      // Une Server Action interrompue peut se résoudre sur `undefined` sans
      // rejeter : sans ce repli, l'écran tomberait sur une erreur brute.
      if (!reponse) setErreur('La connexion a été interrompue. Réessayez.');
      else if (!reponse.ok) setErreur(reponse.message);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <Coins className="mt-0.5 h-5 w-5 shrink-0 text-primary-container" aria-hidden />
          <div>
            <h2 className="text-body-md font-semibold text-text-primary">
              Reprendre les tarifs de {sourceLibelle}
            </h2>
            <p className="mt-1 text-body-sm text-text-secondary">
              Cette année n&apos;a encore aucun tarif. Voici ceux de l&apos;an dernier, reportés par
              niveau. Corrigez ce qui a changé, puis validez une fois.{' '}
              <strong>Un tarif ne se modifie plus une fois créé</strong> — c&apos;est le moment de
              les relire.
            </p>
          </div>
        </div>

        {conflits.length > 0 && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-body-sm text-warning-on-container">
            Non repris, parce que l&apos;an dernier deux classes du même niveau portaient des
            montants différents :{' '}
            {conflits.map((c) => `${c.typeFraisNom} (${c.montants.map(fcfa).join(' / ')})`).join(', ')}.
            À saisir à la main.
          </p>
        )}

        {erreur && (
          <p
            className="rounded-lg border border-error/30 bg-error/10 p-3 text-body-sm text-error-on-container"
            role="alert"
          >
            {erreur}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {parClasse.map(([classeId, groupe]) => (
            <div key={classeId}>
              <h3 className="text-label-md uppercase tracking-wide text-text-secondary">
                {groupe.nom}
              </h3>
              <div className="mt-2 flex flex-col gap-2">
                {groupe.lignes.map((ligne) => {
                  const cle = `${ligne.classeCibleId}|${ligne.typeFraisId}`;
                  return (
                    <div key={cle} className="flex items-center gap-3">
                      <label
                        htmlFor={`tarif-${cle}`}
                        className="flex-1 text-body-sm text-text-primary"
                      >
                        {ligne.typeFraisNom}
                      </label>
                      <Input
                        id={`tarif-${cle}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="w-40"
                        value={montants[cle] ?? ''}
                        onChange={(e) =>
                          setMontants((m) => ({ ...m, [cle]: e.target.value }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-4">
          <p className="text-body-sm text-text-secondary">
            {propositions.length} tarif(s), {fcfa(total)} au total sur l&apos;ensemble des classes.
          </p>
          <Button type="button" variant="primary" disabled={enCours} onClick={valider}>
            <Check className="h-4 w-4" aria-hidden />
            {enCours ? 'Création…' : `Créer ces ${propositions.length} tarifs`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
