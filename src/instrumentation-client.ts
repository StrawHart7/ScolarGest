// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
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
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? (process.env.NODE_ENV === 'production' ? 0.1 : 0),
);

Sentry.init({
  dsn: 'https://0cfb1f926f830472965cf2d7787c34c0@o4511927539859456.ingest.de.sentry.io/4511927550476368',

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  tracesSampleRate: tauxTraces,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Le Replay enregistre les mutations du DOM en continu dans le navigateur :
  // c'est du temps CPU pris sur l'affichage. On ne l'active plus par tirage au
  // sort sur les sessions ordinaires ; il ne se déclenche que sur erreur, où il
  // vaut son coût.
  replaysSessionSampleRate: 0,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
