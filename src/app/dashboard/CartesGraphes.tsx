import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CourbeAire } from '@/components/ui/courbe-aire';
import { HistogrammeMensuel } from '@/components/ui/histogramme-mensuel';
import { formaterValeur } from '@/lib/format-graphe';
import type { SerieAnnuelle } from '@/services/series-ecole';

/**
 * Cartes de graphes du tableau de bord.
 *
 * Composants serveur : ils n'ont aucun etat propre et se contentent d'habiller
 * les primitives, qui sont clientes pour le survol. Faire remonter la frontiere
 * client jusqu'ici embarquerait la carte et l'en-tete dans le bundle pour rien.
 *
 * Chaque carte porte **son total sur la periode** a cote du titre. Une courbe
 * repond a « comment ca evolue » ; le chiffre repond a « combien au total ».
 * Les deux questions se posent en meme temps, et sans le total il faudrait
 * additionner douze points a l'oeil.
 */



function Entete({
  titre,
  total,
  variation,
}: {
  titre: string;
  total: string;
  variation: number | null;
}) {
  return (
    <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1 space-y-0">
      <CardTitle>{titre}</CardTitle>
      <div className="flex items-baseline gap-2">
        <span className="text-headline-md text-text-primary" data-mono>
          {total}
        </span>
        {/* La variation ne s'affiche que si elle veut dire quelque chose : sans
            annee precedente, ou depuis un total nul, il n'y a pas de
            pourcentage a donner. */}
        {variation !== null && (
          <span
            className={cn(
              'text-body-sm font-medium',
              variation > 0 && 'text-tertiary',
              variation < 0 && 'text-error',
              variation === 0 && 'text-text-secondary',
            )}
          >
            {variation > 0 ? '+' : ''}
            {variation} % vs l&apos;an dernier
          </span>
        )}
      </div>
    </CardHeader>
  );
}

/** Message tenu quand la serie est vide, plutot qu'un graphe plat sans explication. */
function Vide({ message }: { message: string }) {
  return (
    <CardContent>
      <p className="py-10 text-center text-body-sm text-text-secondary">{message}</p>
    </CardContent>
  );
}

export function CarteEncaissements({ serie }: { serie: SerieAnnuelle }) {
  return (
    <Card>
      <Entete
        titre="Encaissements de l'année"
        total={formaterValeur(serie.total, 'fcfa')}
        variation={serie.variation}
      />
      {serie.total === 0 ? (
        <Vide message="Aucun paiement enregistré sur cette année scolaire." />
      ) : (
        <CardContent>
          <CourbeAire id="encaissements" points={serie.points} format="fcfa" />
        </CardContent>
      )}
    </Card>
  );
}

export function CarteInscriptions({ serie }: { serie: SerieAnnuelle }) {
  return (
    <Card>
      <Entete
        titre="Inscriptions de l'année"
        total={serie.total.toLocaleString('fr-FR')}
        variation={serie.variation}
      />
      {serie.total === 0 ? (
        <Vide message="Aucune inscription enregistrée sur cette année scolaire." />
      ) : (
        <CardContent>
          <HistogrammeMensuel barres={serie.points} unite="inscription" />
        </CardContent>
      )}
    </Card>
  );
}
