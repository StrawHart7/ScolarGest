import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CourbeAire } from '@/components/ui/courbe-aire';
import { HistogrammeMensuel } from '@/components/ui/histogramme-mensuel';
import { formaterValeur } from '@/lib/format-graphe';
import type { PointMensuel } from '@/services/series-ecole';

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



function Entete({ titre, total, precision }: { titre: string; total: string; precision: string }) {
  return (
    <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1 space-y-0">
      <CardTitle>{titre}</CardTitle>
      <div className="flex items-baseline gap-2">
        <span className="text-headline-md text-text-primary" data-mono>
          {total}
        </span>
        <span className="text-body-sm text-text-secondary">{precision}</span>
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

export function CarteEncaissements({ points }: { points: PointMensuel[] }) {
  const total = points.reduce((s, p) => s + p.valeur, 0);

  return (
    <Card>
      <Entete titre="Encaissements" total={formaterValeur(total, 'fcfa')} precision="sur 12 mois" />
      {total === 0 ? (
        <Vide message="Aucun paiement enregistré sur les douze derniers mois." />
      ) : (
        <CardContent>
          <CourbeAire id="encaissements" points={points} format="fcfa" />
        </CardContent>
      )}
    </Card>
  );
}

export function CarteInscriptions({ points }: { points: PointMensuel[] }) {
  const total = points.reduce((s, p) => s + p.valeur, 0);

  return (
    <Card>
      <Entete
        titre="Inscriptions"
        total={total.toLocaleString('fr-FR')}
        precision="sur 12 mois"
      />
      {total === 0 ? (
        <Vide message="Aucune inscription enregistrée sur les douze derniers mois." />
      ) : (
        <CardContent>
          <HistogrammeMensuel barres={points} unite="inscription" />
        </CardContent>
      )}
    </Card>
  );
}
