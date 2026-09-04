import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GraduationCap, Target, Users2, TrendingDown } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import {
  getStatistiquesAcademiques,
  SEUIL_REUSSITE,
} from '@/services/statistiques-academiques';
import type { Periode } from '@/services/evaluation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CarteMetrique } from '@/components/ui/carte-metrique';
import { BarresHorizontales } from '@/components/ui/barres-horizontales';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getSidebarItems } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Statistiques' };

/**
 * Statistiques académiques — pilotage pédagogique.
 *
 * **Directeur et Secrétaire** : la garde vit dans le service, la redirection
 * ici n'est qu'une courtoisie pour ne pas afficher une page d'erreur aux
 * autres rôles.
 *
 * Le parti pris est de répondre à quatre questions, et pas plus : où en est
 * l'établissement, quelles classes décrochent, quelles matières demandent un
 * renfort, et comment les résultats se répartissent. Une console qui affiche
 * tout n'aide personne à décider.
 */

const PERIODES: { valeur: Periode; libelle: string }[] = [
  { valeur: 'TRIMESTRE_1', libelle: '1er trimestre' },
  { valeur: 'TRIMESTRE_2', libelle: '2e trimestre' },
  { valeur: 'TRIMESTRE_3', libelle: '3e trimestre' },
];

function surVingt(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(2).replace('.', ',')}/20`;
}

function pourcent(v: number | null): string {
  return v === null ? '—' : `${v} %`;
}

export default async function StatistiquesPage({
  searchParams,
}: {
  searchParams: { periode?: string; anneeScolaireId?: string };
}) {
  const ctx = await getTenantContext();
  if (ctx.role !== 'DIRECTEUR' && ctx.role !== 'SECRETAIRE') redirect('/dashboard');

  const annees = await listAnneesScolaires();
  const anneeActive = annees.find((a) => a.statut === 'ACTIVE');
  const anneeScolaireId = searchParams.anneeScolaireId ?? anneeActive?.id;

  const periode: Periode = PERIODES.some((p) => p.valeur === searchParams.periode)
    ? (searchParams.periode as Periode)
    : 'TRIMESTRE_1';

  const layout = (contenu: React.ReactNode) => (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-surface-border pb-5">
          <div className="min-w-0">
            <p className="text-label-md uppercase tracking-wider text-primary-container">
              Pilotage pédagogique
            </p>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-text-primary sm:text-[32px]">
              Statistiques
            </h1>
            <p className="mt-1 text-body-md text-text-secondary">
              {anneeActive ? anneeActive.libelle : 'Aucune année active'} — résultats de
              l&apos;établissement
            </p>
          </div>

          {/* Sélecteur en liens : la période se partage dans l'URL, et la page
              reste entièrement rendue côté serveur. */}
          <nav className="flex flex-wrap gap-2" aria-label="Période">
            {PERIODES.map((p) => (
              <Link
                key={p.valeur}
                href={`/statistiques?periode=${p.valeur}`}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-body-sm transition-colors',
                  p.valeur === periode
                    ? 'border-primary-container bg-primary-fixed/60 font-medium text-primary-container'
                    : 'border-surface-border text-text-secondary hover:border-primary-container/50',
                )}
              >
                {p.libelle}
              </Link>
            ))}
          </nav>
        </header>
        {contenu}
      </div>
    </AppLayout>
  );

  if (!anneeScolaireId) {
    return layout(
      <Card>
        <CardContent className="p-6">
          <p className="text-body-sm text-text-secondary">
            Aucune année scolaire n&apos;est encore créée pour votre établissement.
          </p>
        </CardContent>
      </Card>,
    );
  }

  const stats = await getStatistiquesAcademiques(anneeScolaireId, periode);

  if (stats.effectifEvalue === 0) {
    return layout(
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <GraduationCap className="h-10 w-10 text-text-secondary/50" aria-hidden />
          <p className="text-body-md text-text-primary">
            Aucune note saisie sur cette période.
          </p>
          <p className="max-w-md text-body-sm text-text-secondary">
            Les statistiques apparaîtront dès que des évaluations auront été notées. Essayez une
            autre période.
          </p>
        </CardContent>
      </Card>,
    );
  }

  // Les matières sont déjà triées de la plus faible à la plus forte : celles
  // qu'on cherche sont en tête.
  const aRenforcer = stats.matieres.filter(
    (m) => m.moyenne !== null && m.moyenne < SEUIL_REUSSITE,
  );

  return layout(
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CarteMetrique
          label="Moyenne générale"
          valeur={surVingt(stats.moyenneGenerale)}
          icone={GraduationCap}
          ton="primaire"
          comparaison={`Sur ${stats.effectifEvalue} élève${stats.effectifEvalue > 1 ? 's' : ''} évalué${stats.effectifEvalue > 1 ? 's' : ''}`}
        />
        <CarteMetrique
          label="Taux de réussite"
          valeur={pourcent(stats.tauxReussite)}
          icone={Target}
          ton={stats.tauxReussite !== null && stats.tauxReussite < 50 ? 'alerte' : 'succes'}
          comparaison={`Élèves au-dessus de ${SEUIL_REUSSITE}/20`}
        />
        <CarteMetrique
          label="Élèves évalués"
          valeur={`${stats.effectifEvalue} / ${stats.effectifTotal}`}
          icone={Users2}
          ton="neutre"
          comparaison={
            stats.effectifEvalue < stats.effectifTotal
              ? `${stats.effectifTotal - stats.effectifEvalue} sans aucune note sur la période`
              : 'Tous les inscrits ont des notes'
          }
        />
        <CarteMetrique
          label="Matières sous le seuil"
          valeur={String(aRenforcer.length)}
          icone={TrendingDown}
          ton={aRenforcer.length > 0 ? 'alerte' : 'succes'}
          comparaison={
            aRenforcer.length > 0
              ? aRenforcer
                  .slice(0, 3)
                  .map((m) => m.libelle)
                  .join(', ')
              : 'Aucune matière en dessous du seuil'
          }
        />
      </div>

      {/* L'avertissement n'est pas une précaution de style : un effectif
          partiellement noté produit des moyennes qui bougeront, et une
          décision prise dessus serait prise sur du sable. */}
      {stats.effectifEvalue < stats.effectifTotal && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-body-sm text-text-secondary">
          {stats.effectifTotal - stats.effectifEvalue} élève
          {stats.effectifTotal - stats.effectifEvalue > 1 ? 's n’ont' : ' n’a'} aucune note sur
          cette période et {stats.effectifTotal - stats.effectifEvalue > 1 ? 'sont' : 'est'} exclu
          {stats.effectifTotal - stats.effectifEvalue > 1 ? 's' : ''} des moyennes. Les compter
          comme zéro fausserait les chiffres — mais ceux-ci évolueront à mesure que les notes
          seront saisies.
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Matières à renforcer</CardTitle>
            <p className="mt-1 text-body-sm text-text-secondary">
              De la plus faible à la plus forte, avec l&apos;écart à la moyenne générale.
            </p>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            <ul className="flex flex-col gap-3">
              {stats.matieres.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-body-sm text-text-primary">
                    {m.libelle}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-body-sm font-medium',
                      m.moyenne !== null && m.moyenne < SEUIL_REUSSITE
                        ? 'text-error'
                        : 'text-text-primary',
                    )}
                    data-mono
                  >
                    {surVingt(m.moyenne)}
                  </span>
                  <span
                    className={cn(
                      'w-16 shrink-0 text-right text-body-sm',
                      (m.ecart ?? 0) < 0 ? 'text-error' : 'text-tertiary',
                    )}
                    data-mono
                  >
                    {m.ecart === null ? '—' : `${m.ecart > 0 ? '+' : ''}${m.ecart}`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition des moyennes</CardTitle>
            <p className="mt-1 text-body-sm text-text-secondary">
              Tranches nommées comme les appréciations des bulletins.
            </p>
          </CardHeader>
          <CardContent>
            <BarresHorizontales
              largeurLibelle="w-48"
              lignes={stats.distribution.map((d) => ({
                id: d.libelle,
                libelle: d.libelle,
                valeur: d.effectif,
                reference: null,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Résultats par classe</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto p-0">
            <Table dense>
              <TableHeader className="sticky top-0 bg-surface-container-lowest">
                <TableRow>
                  <TableHead>Classe</TableHead>
                  <TableHead className="text-right">Évalués</TableHead>
                  <TableHead className="text-right">Moyenne</TableHead>
                  <TableHead className="text-right">Réussite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.classes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-body-sm text-text-primary">{c.libelle}</TableCell>
                    <TableCell className="text-right text-body-sm text-text-secondary" data-mono>
                      {c.effectif}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right text-body-sm font-medium',
                        c.moyenne !== null && c.moyenne < SEUIL_REUSSITE
                          ? 'text-error'
                          : 'text-text-primary',
                      )}
                      data-mono
                    >
                      {surVingt(c.moyenne)}
                    </TableCell>
                    <TableCell className="text-right text-body-sm text-text-secondary" data-mono>
                      {pourcent(c.tauxReussite)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filles et garçons</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {stats.parSexe.map((g) => (
              <div key={g.id} className="rounded-lg border border-surface-border p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body-md font-medium text-text-primary">{g.libelle}</span>
                  <span className="text-body-sm text-text-secondary" data-mono>
                    {g.effectif} évalué{g.effectif > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-4">
                  <span className="text-headline-md text-text-primary" data-mono>
                    {surVingt(g.moyenne)}
                  </span>
                  <span className="text-body-sm text-text-secondary">
                    {pourcent(g.tauxReussite)} de réussite
                  </span>
                </div>
              </div>
            ))}
            <p className="text-body-sm text-text-secondary">
              Un écart entre les deux groupes décrit une situation, il ne l&apos;explique pas.
              Effectifs, filières et matières suivies pèsent souvent davantage que le sexe.
            </p>
          </CardContent>
        </Card>
      </div>
    </>,
  );
}
