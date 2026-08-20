import * as React from 'react';

/**
 * Mémoïsation à la durée d'*une* requête serveur.
 *
 * `React.cache` n'existe que dans le build « react-server » utilisé par Next :
 * sous Vitest (condition node), l'import est absent. On dégrade alors vers
 * l'identité — la mémoïsation est une optimisation, jamais une condition de
 * correction. Le cache n'est jamais partagé entre deux requêtes ni entre deux
 * utilisateurs : c'est ce qui le rend utilisable sur des données par tenant.
 */
export const memoiserParRequete: <T extends (...args: never[]) => unknown>(fonction: T) => T =
  (React as { cache?: <T extends (...args: never[]) => unknown>(fonction: T) => T }).cache ??
  ((fonction) => fonction);
