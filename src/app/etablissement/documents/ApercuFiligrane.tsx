/**
 * Le filigrane, montré plutôt que décrit.
 *
 * L'écran expliquait en trois lignes de prose ce qu'un filigrane fait : « en
 * fond de page, en diagonale et très estompé, sur chaque page ». Trois
 * affirmations qu'on ne peut ni vérifier ni contredire avant d'avoir généré un
 * bulletin — c'est-à-dire trop tard. Une vignette les remplace toutes.
 *
 * ## La géométrie est reprise du gabarit réel
 *
 * `src/lib/pdf/templates/identite.ts` pose le filigrane à `rotate(-35deg)`,
 * centré, en gras, 68px sur une page A4 de 794px de large, teinte `#1b3a6b`.
 * La vignette fait 132px : la taille de police est mise à l'échelle dans le
 * même rapport (68 × 132 / 794 ≈ 11px), l'interlettrage aussi. Un aperçu qui
 * inventerait son angle ou sa place ne servirait à rien.
 *
 * ## L'opacité, elle, est relevée — et c'est délibéré
 *
 * Le document réel est à 0,07. Réduite au quart, la graisse du trait se réduit
 * d'autant : à 11px, 0,07 ne donne plus rien du tout à l'écran, et la vignette
 * montrerait une page blanche pour un filigrane pourtant bien présent. Elle
 * annoncerait donc l'inverse de la vérité. L'opacité compense la réduction du
 * trait ; ce que la vignette promet, c'est le texte, sa place et son angle, pas
 * une mesure de densité d'encre.
 *
 * ## Le texte du document passe par-dessus
 *
 * Comme dans le gabarit (`body > *:not(.filigrane) { z-index: 1 }`), les
 * lignes du document sont dessinées après le filigrane. C'est ce qui montre
 * qu'il passe dessous et ne masque rien de ce qui est lu.
 */
export function ApercuFiligrane({ texte, actif }: { texte: string; actif: boolean }) {
  const visible = actif && texte !== '';

  return (
    <figure className="shrink-0">
      <div className="relative h-[187px] w-[132px] overflow-hidden rounded border border-surface-border bg-white shadow-subtle">
        {visible && (
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[35deg] whitespace-nowrap text-[11px] font-bold leading-none tracking-[0.66px] text-[#1b3a6b] opacity-25"
          >
            {texte}
          </span>
        )}

        {/* Le document suggéré : un en-tête centré, puis des lignes. */}
        <div className="absolute inset-0 flex flex-col gap-[7px] p-3" aria-hidden>
          <div className="mx-auto h-[9px] w-[54px] rounded-[1px] bg-surface-container-high" />
          <div className="mx-auto mb-1 h-[3px] w-[32px] rounded-[1px] bg-surface-container" />
          {[100, 92, 97, 72, 100, 88, 95, 68, 84].map((largeur, rang) => (
            <div
              key={rang}
              className="h-[3px] rounded-[1px] bg-surface-container"
              style={{ width: `${largeur}%` }}
            />
          ))}
        </div>
      </div>

      <figcaption className="mt-2 text-center text-body-sm text-text-secondary">
        {visible ? 'Aperçu' : 'Sans filigrane'}
      </figcaption>
    </figure>
  );
}
