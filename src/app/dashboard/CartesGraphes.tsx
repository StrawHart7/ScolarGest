import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CourbeAire } from '@/components/ui/courbe-aire';
import { BarresHorizontales } from '@/components/ui/barres-horizontales';
import { CarteRepliable } from '@/components/ui/carte-repliable';
import { formaterValeur } from '@/lib/format-graphe';
import type { EffectifClasse, SerieAnnuelle } from '@/services/series-ecole';

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

/**
 * Effectif de chaque classe, rapporte a sa capacite.
 *
 * Remplace l'histogramme des inscriptions, qui n'apprenait rien : dans une
 * ecole, tout le monde s'inscrit en septembre, et la courbe etait une barre
 * suivie de dix mois vides. On savait deja son allure avant de la tracer.
 *
 * Le remplissage par classe, lui, change d'une annee sur l'autre et appelle
 * des decisions — ouvrir une division, en fermer une, redistribuer.
 */
export function CarteEffectifs({ classes }: { classes: EffectifClasse[] }) {
  const total = classes.reduce((s, c) => s + c.effectif, 0);
  const pleines = classes.filter((c) => c.capacite !== null && c.effectif >= c.capacite).length;
  const vides = classes.filter((c) => c.effectif === 0).length;

  // Le resume doit suffire a decider si l'on deplie : combien de classes, et
  // surtout combien meritent une decision.
  const alertes = [
    pleines > 0 ? `${pleines} au complet` : null,
    vides > 0 ? `${vides} sans élève` : null,
  ].filter(Boolean);

  const resume =
    classes.length === 0
      ? 'Aucune classe créée pour cette année scolaire'
      : `${classes.length} classes, ${total.toLocaleString('fr-FR')} élèves${
          alertes.length > 0 ? ` — ${alertes.join(', ')}` : ''
        }`;

  return (
    <CarteRepliable titre="Effectif par classe" resume={resume}>
      {classes.length === 0 ? (
        <p className="py-6 text-center text-body-sm text-text-secondary">
          Créez des classes pour suivre leur remplissage.
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <BarresHorizontales
            lignes={classes.map((c) => ({
              id: c.id,
              libelle: c.nom,
              valeur: c.effectif,
              reference: c.capacite,
            }))}
          />
        </div>
      )}
    </CarteRepliable>
  );
}
