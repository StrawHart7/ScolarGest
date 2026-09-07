import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Le service worker n'est pas un module : il vit dans `public/sw.js` et n'est
 * ni compile, ni type, ni couvert par le reste de la suite. Rien ne le
 * verifiait — c'est pourtant lui qui decide si une ecole voit ses pages
 * pendant une coupure de six heures.
 *
 * Ces tests lisent le fichier reel et eprouvent ses expressions telles
 * qu'elles y sont ecrites. Les recopier ici les ferait diverger en silence.
 */
const SW = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');

function extraireExpression(nom: RegExp): RegExp {
  const trouve = SW.match(nom);
  if (!trouve?.[1]) throw new Error(`Expression introuvable dans sw.js : ${nom}`);
  // eslint-disable-next-line no-eval
  return eval(trouve[1]) as RegExp;
}

describe('sw.js — extraction des ressources d’une page', () => {
  const motif = extraireExpression(/const motif = (\/.*\/g);/);
  const nettoyage = extraireExpression(/replace\((\/\[\^A-Za-z0-9.*?\/), ''\)/);

  function ressources(html: string): string[] {
    const vus = new Set<string>();
    motif.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = motif.exec(html)) !== null) vus.add(m[1]!.replace(nettoyage, ''));
    return [...vus].sort();
  }

  it('trouve scripts, styles et polices, y compris dans les donnees RSC', () => {
    // Sans les fragments JavaScript, le prechargement produit une page **a
    // moitie** disponible : le HTML arrive du cache, l'hydratation echoue, et
    // l'utilisateur lit « Une erreur est survenue » sur une page qu'on croyait
    // preparee. Constate en production le 2026-09-07.
    const html = String.raw`<link rel="preload" href="/_next/static/css/app.css" as="style"/>
      <script src="/_next/static/chunks/webpack-1a2b.js" async></script>
      <script src="/_next/static/chunks/page-d0a2491.js"></script>
      <style>@font-face{src:url(/_next/static/media/f.woff2) format("woff2")}</style>
      <script>self.__next_f.push([1,"3:HL[\"/_next/static/media/g.woff2\",\"font\"]"])</script>`;

    expect(ressources(html)).toEqual([
      '/_next/static/chunks/page-d0a2491.js',
      '/_next/static/chunks/webpack-1a2b.js',
      '/_next/static/css/app.css',
      '/_next/static/media/f.woff2',
      '/_next/static/media/g.woff2',
    ]);
  });

  it('ne laisse pas de caractere d’echappement coller au chemin', () => {
    // Une URL salie n'existe pas : son telechargement echouerait a chaque
    // prechargement, sans que rien ne le signale.
    const html = String.raw`"3:HL[\"/_next/static/media/police.woff2\"]"`;
    expect(ressources(html)).toEqual(['/_next/static/media/police.woff2']);
  });

  it('ignore ce qui n’est pas un asset Next', () => {
    const html = '<img src="/assets/images/logo.png"><a href="/etablissement/eleves">x</a>';
    expect(ressources(html)).toEqual([]);
  });
});

describe('sw.js — invariants de cache', () => {
  it('sert le manifeste depuis le cache', () => {
    // Precache mais intercepte par aucune branche, il partait au reseau et
    // echouait hors ligne alors que sa copie etait a portee de main.
    expect(SW).toContain("url.pathname === '/manifest.webmanifest'");
  });

  it('ne met jamais en cache une reponse redirigee', () => {
    // Le middleware redirige vers /login quand la session expire : mise en
    // cache, cette redirection servirait une page de connexion a la place du
    // tableau de bord, hors ligne, pour toujours.
    const occurrences = SW.match(/redirected/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });

  it('conserve le cache de pages au changement de version', () => {
    // Le vider a chaque deploiement priverait de consultation une ecole qui
    // n'a pas de reseau au moment de la mise a jour.
    expect(SW).toContain('key !== CACHE_VERSION && key !== CACHE_PAGES');
  });

  it('ne precharge pas plus que ce que la navigation en propose', () => {
    expect(SW).toContain('slice(0, 40)');
  });
});
