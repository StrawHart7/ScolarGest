import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { extraireMatrice, signature, type FichierService } from '../matrice';

const SERVICES = join(__dirname, '..', '..', '..', 'services');
const INSTANTANE = join(__dirname, 'matrice.instantane.txt');

function lireServices(): FichierService[] {
  return readdirSync(SERVICES)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({
      nom: f.replace(/[.]ts$/, ''),
      contenu: readFileSync(join(SERVICES, f), 'utf8'),
    }));
}

/** Petit utilitaire de lisibilité : un service factice écrit ligne à ligne. */
function service(nom: string, lignes: string[]): FichierService {
  return { nom, contenu: lignes.join('\n') };
}

describe('extraireMatrice', () => {
  it('lit les rôles listés dans requireRole et y ajoute toujours SUPER_ADMIN', () => {
    const [entree] = extraireMatrice([
      service('exemple', [
        'export async function listeX() {',
        "  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE');",
        '}',
      ]),
    ]);
    expect(entree?.garde).toEqual({
      type: 'roles',
      roles: ['SUPER_ADMIN', 'DIRECTEUR', 'SECRETAIRE'],
    });
  });

  it('traite requireRole() sans argument comme SUPER_ADMIN seul', () => {
    // C'est le piège exact de la Phase 5 : un `requireRole()` nu sur
    // `getEtablissement` avait verrouillé la génération de bulletins pour les
    // trois rôles école. La matrice doit le rendre visible, pas le masquer.
    const [entree] = extraireMatrice([
      service('exemple', ['export async function x() {', '  await requireRole();', '}']),
    ]);
    expect(entree?.garde).toEqual({ type: 'roles', roles: ['SUPER_ADMIN'] });
  });

  it("distingue une session simple d'une absence totale de garde", () => {
    const entrees = extraireMatrice([
      service('exemple', [
        'export async function avecSession() {',
        '  const ctx = await getTenantContext();',
        '}',
        'export function pure(a: number) {',
        '  return a + 1;',
        '}',
      ]),
    ]);
    expect(entrees.find((e) => e.fonction === 'avecSession')?.garde.type).toBe('authentifie');
    expect(entrees.find((e) => e.fonction === 'pure')?.garde.type).toBe('aucune');
  });

  it('reconnaît une garde héritée, y compris derrière un alias local', () => {
    const entrees = extraireMatrice([
      service('exemple', [
        "const verifierPin = (pin: string) => exigerPin(pin, 'SECRETAIRE');",
        'export async function garde() {',
        "  await requireRole('DIRECTEUR');",
        '}',
        'export async function deleguee() {',
        '  await garde();',
        '}',
        'export async function parAlias(pin: string) {',
        '  await verifierPin(pin);',
        '}',
      ]),
    ]);
    expect(entrees.find((e) => e.fonction === 'deleguee')?.garde).toEqual({
      type: 'deleguee',
      vers: 'garde',
    });
    expect(entrees.find((e) => e.fonction === 'parAlias')?.garde).toEqual({
      type: 'deleguee',
      vers: 'verifierPin',
    });
  });

  it('signale des rôles dynamiques plutôt que de deviner', () => {
    const [entree] = extraireMatrice([
      service('exemple', [
        'export async function x(roles: Role[]) {',
        '  await requireRole(...roles);',
        '}',
      ]),
    ]);
    expect(entree?.garde.type).toBe('dynamique');
  });
});

describe('matrice des permissions réelle', () => {
  /**
   * Instantané versionné des gardes de `src/services/`.
   *
   * Ce test ne juge pas si une garde est *bonne* — il rend impossible de la
   * changer sans le voir. Élargir un accès ou en fermer un fait échouer ici, et
   * la mise à jour de l'instantané devient un geste explicite, relu en diff.
   * C'est précisément le filet qui manquait quand la Phase 5 a livré un
   * `getEtablissement` réservé au SUPER_ADMIN sans que personne s'en aperçoive.
   *
   * Pour régénérer après un changement voulu :
   *   npx tsx scripts/matrice-permissions.ts --instantane
   */
  it("correspond à l'instantané versionné", () => {
    expect(existsSync(INSTANTANE)).toBe(true);
    const attendu = readFileSync(INSTANTANE, 'utf8').trim().split(/\r?\n/);
    const obtenu = extraireMatrice(lireServices()).map(signature);
    expect(obtenu).toEqual(attendu);
  });

  /**
   * Exceptions assumées, avec leur raison d'être. Toute autre fonction qui
   * ouvre un client Supabase sans garde fait échouer le test ci-dessous.
   *
   * La liste est volontairement courte et nominative : une règle qui souffre
   * des exceptions anonymes n'est plus une règle.
   */
  const SANS_GARDE_ASSUME: Record<string, string> = {
    'audit.journaliserConnexion':
      "journalise les tentatives de connexion, y compris échouées : par définition, il n'y a alors aucune session à contrôler.",
    'paiement-fedapay.recevoirWebhookFedapay':
      "appelée par le webhook FedaPay, qui arrive sans session ni cookie. L'authentification est la signature X-FEDAPAY-SIGNATURE, vérifiée avant tout traitement : un requireRole y serait toujours en échec et rendrait le paiement impossible.",
    'relances-abonnement.traiterEcheances':
      "appelée par le balayage quotidien des échéances, déclenché par un planificateur sans session ni cookie. L'authentification est le secret partagé CRON_SECRET, vérifié dans la route avant tout appel ; un requireRole y serait toujours en échec et aucune relance ne partirait jamais.",
    'plateforme.getPlacesFondatrices':
      "compteur du programme fondateur, lu par la page d'accueil publique — qui s'adresse par definition a des visiteurs anonymes. Ne renvoie que deux entiers : places prises et plafond, jamais un nom d'ecole ni un montant. Le comptage passe par la cle service-role plutot que par une policy publique sur `etablissement`, qui echangerait l'isolation entre ecoles contre un chiffre marketing.",
    'paiement-fedapay.traiterEvenementFedapay':
      "traite un événement dont la signature a déjà été vérifiée par recevoirWebhookFedapay. Aucun appelant utilisateur : l'unique chemin est la route de webhook.",
  };

  it('ne laisse aucune fonction de service toucher la base sans garde', () => {
    // Les fonctions légitimement sans garde sont des calculs purs : elles
    // n'ouvrent aucun client Supabase. On le vérifie au lieu de le supposer,
    // sinon un oubli de `requireRole` se cacherait dans la masse.
    const fautives = extraireMatrice(lireServices())
      .filter((e) => e.garde.type === 'aucune' && e.accedeDonnees)
      .map((e) => e.service + '.' + e.fonction)
      .filter((nom) => !(nom in SANS_GARDE_ASSUME));

    expect(fautives).toEqual([]);
  });
});
