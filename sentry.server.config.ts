// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

/**
 * Échantillonnage des traces.
 *
 * La valeur d'origine (1) traçait **100 %** des requêtes et poussait chaque
 * transaction vers l'ingestion Sentry en Allemagne. Sur le runtime edge, cela
 * concernait le middleware, c'est-à-dire absolument toutes les requêtes de
 * l'application ; et sur serverless, le vidage du tampon est attendu avant que
 * la réponse ne parte. Autrement dit, chaque navigation payait un aller-retour
 * réseau supplementaire pour de l'observabilité.
 *
 * En développement on ne trace rien (le diagnostic se fait dans la console) ;
 * en production 10 % suffisent à surveiller les tendances. La variable
 * d'environnement permet de remonter ponctuellement pour une investigation.
 */
const tauxTraces = Number(
  process.env.SENTRY_TRACES_SAMPLE_RATE ?? (process.env.NODE_ENV === 'production' ? 0.1 : 0),
);

Sentry.init({
  dsn: 'https://0cfb1f926f830472965cf2d7787c34c0@o4511927539859456.ingest.de.sentry.io/4511927550476368',

  tracesSampleRate: tauxTraces,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});
