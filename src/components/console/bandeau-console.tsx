import { CourbeAire, type PointCourbe } from '@/components/ui/courbe-aire';
import { PiluleVariation } from '@/components/ui/carte-metrique';
import { formaterFCFA } from '@/lib/tarifs';

/**
 * Bandeau d'ouverture de la console plateforme.
 *
 * **C'est le seul fond sombre de l'application, et c'est délibéré.** La console
 * reprenait l'habillage des tableaux de bord d'école — mêmes cartes blanches,
 * même grille, même densité — si bien que rien ne disait, en arrivant dessus,
 * qu'on avait changé de casquette. Le fond sombre le dit avant la première
 * ligne lue. Il règle aussi le défaut de hiérarchie : la page alignait cinq
 * blocs de poids égal dont aucun ne dominait.
 *
 * **Le grand chiffre est le mois en cours, plus le cumul de l'année.** C'est
 * l'inverse de la version précédente, et cela corrige une confusion qui y était
 * consignée : le cumul douze mois y tenait la vedette pendant que la pilule de
 * variation, juste à côté, portait sur le mois — on lisait donc que le cumul
 * avait baissé. Chiffre et variation parlent désormais de la même chose.
 *
 * **Le mois sert d'intitulé.** Ce n'est pas une décoration : cette activité se
 * compte par mois — les abonnements se renouvellent au mois, les encaissements
 * se relèvent au mois. Nommer le mois en tête situe tout ce qui suit.
 */

/** « 2026-09 » → « septembre 2026 ». En UTC, comme les clés de la série. */
function moisEnToutesLettres(cle: string): string {
  const [annee = 1970, mois = 1] = cle.split('-').map(Number);
  return new Date(Date.UTC(annee, mois - 1, 1)).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Sépare « 265 000 F » en montant et unité, sur le dernier espace.
 *
 * `formaterFCFA` accole l'unité au montant, ce qui convient partout ailleurs.
 * Au corps du bandeau, les deux ne peuvent pas partager la même graisse ni la
 * même taille sans que l'unité se lise comme un chiffre de plus.
 */
function separerUnite(montantFormate: string): [string, string] {
  const coupe = montantFormate.lastIndexOf(' ');
  if (coupe === -1) return [montantFormate, ''];
  return [montantFormate.slice(0, coupe), montantFormate.slice(coupe + 1)];
}

export function BandeauConsole({
  points,
  total,
  moisCourant,
  variation,
}: {
  points: PointCourbe[];
  /** Cumul sur la fenêtre complète. */
  total: number;
  /** Encaissements du mois en cours. */
  moisCourant: number;
  /** Variation du mois en cours par rapport au précédent. `null` si indéfinie. */
  variation: number | null;
}) {
  const cleMois = points.at(-1)?.mois;
  const [montant, unite] = separerUnite(formaterFCFA(moisCourant));

  return (
    <section
      className="relative animate-console-monte overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-text-primary shadow-premium"
      aria-label="Encaissements de la plateforme"
    >
      {/* Arête éclairée en haut de la plaque. Un dégradé seul reste un aplat ;
          ce liseré lui donne son épaisseur. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />

      <div className="grid gap-6 p-5 md:p-7 lg:grid-cols-[minmax(0,290px)_minmax(0,1fr)] lg:items-center lg:gap-10">
        <div>
          {cleMois && (
            <p className="text-console-eyebrow uppercase text-white/55">
              {moisEnToutesLettres(cleMois)}
            </p>
          )}

          {/* L'unité est détachée du montant : à 40px, l'espace de la fonte à
              chasse fixe vaut près de 25px et le « F » partait à la dérive,
              comme un second mot. Réduit et adouci, il redevient ce qu'il est —
              une unité, pas un chiffre.

              Pas de `break-words` non plus : un montant ne se coupe pas. La
              taille est en `clamp`, elle rétrécit d'elle-même sur écran
              étroit. */}
          <p className="mt-3 flex items-baseline gap-1.5 text-white">
            <span className="font-mono text-console-figure" data-mono>
              {montant}
            </span>
            <span className="font-mono text-console-figure-sm text-white/55">{unite}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-body-sm text-white/70">encaissé ce mois</span>
            {/* Rien encaissé ce mois ne vaut pas « −100 % ». Le service calcule
                juste, mais le 2 du mois la comparaison n'a pas encore de sens :
                elle annoncerait un effondrement à chaque début de mois, douze
                fois par an. Un zéro se lit seul. */}
            {variation !== null && moisCourant > 0 && (
              <PiluleVariation variation={variation} ton="sombre" />
            )}
          </div>

          <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-white/15 pt-4">
            <span className="text-console-eyebrow uppercase text-white/55">Sur douze mois</span>
            <span className="font-mono text-body-md font-semibold text-white/90" data-mono>
              {formaterFCFA(total)}
            </span>
          </div>

          <p className="mt-4 text-body-sm leading-relaxed text-white/60">
            Argent réellement encaissé, et non le revenu théorique du catalogue. Les deux diffèrent
            dès qu’une école paie en retard ou d’avance.
          </p>
        </div>

        {total === 0 ? (
          <p className="py-10 text-center text-body-sm text-white/60">
            Aucun paiement d’abonnement encaissé sur les douze derniers mois.
          </p>
        ) : (
          <CourbeAire
            id="encaissements-plateforme"
            points={points}
            format="fcfa"
            ton="sombre"
            className="lg:-mr-2"
          />
        )}
      </div>
    </section>
  );
}
