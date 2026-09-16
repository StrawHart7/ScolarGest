import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Les RPC retirées de l'API publique ne s'appellent qu'avec la clé de service.
 *
 * La migration `20260911005324` a révoqué `EXECUTE` sur deux fonctions de
 * maintenance pour `anon` et `authenticated` : elles écrivent sur **toutes**
 * les écoles de la plateforme et n'ont rien à faire au bout d'une URL
 * PostgREST. La révocation était juste ; ce qu'elle n'a pas fait, c'est
 * chercher qui les appelait déjà.
 *
 * `expirerAbonnementsEchus` est restée sur le client de session. Résultat :
 * `42501` à chaque appel, et `/super-admin/abonnements` — qui balaye avant
 * d'afficher — tombait en page d'erreur **à chaque ouverture, pendant cinq
 * jours**, sans que rien ne le signale. Découvert le 2026-09-16 dans les
 * journaux Postgres, six refus en dix minutes.
 *
 * Ce test lit les fichiers réels plutôt que d'appeler les services : la faute
 * est une question de *quel client* ouvre l'appel, pas de comportement, et
 * elle se rejouerait au premier `createClient()` écrit par réflexe. Même
 * esprit que `service-worker.test.ts`, qui éprouve un fichier non compilé.
 *
 * Les rôles Postgres ne peuvent pas trancher à notre place : le SUPER_ADMIN et
 * un enseignant sont tous deux `authenticated`. La garde de rôle est donc
 * applicative (`requireRole()`), et l'exécution passe par la clé de service.
 */

const RACINE = join(process.cwd(), 'src');

/** Retirées de l'API publique par `20260911005324`. */
const RPC_RESERVEES = ['fn_expirer_abonnements', 'fn_purger_operations_client'];

function lire(chemin: string): string {
  return readFileSync(join(RACINE, chemin), 'utf8');
}

describe('RPC retirées de l’API publique', () => {
  it('expirerAbonnementsEchus passe par la clé de service, pas par la session', () => {
    const source = lire('services/abonnement.ts');
    const corps = source.slice(source.indexOf('export async function expirerAbonnementsEchus'));
    const fin = corps.indexOf('\n}');
    const fonction = corps.slice(0, fin);

    expect(fonction).toContain('createAdminClient()');
    // Le point du test : c'est l'absence de `createClient()` qui compte. Un
    // client de session ici rend `42501` et casse la page entière.
    expect(fonction).not.toMatch(/\bcreateClient\(\)/);
  });

  it('garde sa garde de rôle : la clé de service ne remplace pas requireRole', () => {
    // Sans elle, une fonction qui écrit sur toutes les écoles serait joignable
    // par n'importe quelle Server Action.
    const source = lire('services/abonnement.ts');
    const corps = source.slice(source.indexOf('export async function expirerAbonnementsEchus'));
    expect(corps.slice(0, corps.indexOf('\n}'))).toContain('await requireRole()');
  });

  it('aucun service n’appelle ces RPC avec un client de session', () => {
    // Balayage : la règle vaut pour les appelants futurs, pas seulement pour
    // celui qui a été corrigé.
    const fichiers = ['services/abonnement.ts', 'services/relances-abonnement.ts'];
    for (const fichier of fichiers) {
      const source = lire(fichier);
      for (const rpc of RPC_RESERVEES) {
        if (!source.includes(rpc)) continue;
        const index = source.indexOf(`rpc('${rpc}'`);
        if (index === -1) continue;
        // Les 200 caractères qui précèdent l'appel portent le client employé.
        const avant = source.slice(Math.max(0, index - 200), index);
        expect(avant, `${fichier} appelle ${rpc} sans client de service`).toMatch(
          /admin\.?$|admin\b/,
        );
      }
    }
  });
});
