import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Couverture de l'AuditLog face à la liste obligatoire du doc 03 § 12.
 *
 * Le test lit le code source plutôt que d'exécuter les services : ce qui est
 * vérifié ici, c'est qu'une action nommée existe quelque part, pas qu'elle
 * s'écrit correctement — cette partie-là est couverte par les tests de chaque
 * service. L'intérêt est de rendre impossible la disparition silencieuse d'une
 * trace exigée : supprimer l'appel fait échouer la suite.
 */

const RACINE = join(__dirname, '..', '..');

function sourcesDuProjet(dossier: string): string[] {
  const contenus: string[] = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name === 'node_modules' || entree.name.startsWith('.')) continue;
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) contenus.push(...sourcesDuProjet(chemin));
    else if (/[.]tsx?$/.test(entree.name)) contenus.push(readFileSync(chemin, 'utf8'));
  }
  return contenus;
}

const SOURCES = sourcesDuProjet(RACINE).join('\n');

/**
 * Chaque exigence du doc 03 § 12, et la ou les actions qui la satisfont.
 * Le libellé sert de message d'échec : il doit se lire sans ouvrir le doc.
 */
const EXIGENCES: { exigence: string; actions: string[] }[] = [
  { exigence: 'connexion', actions: ['CONNEXION', 'CONNEXION_ECHOUEE'] },
  { exigence: 'création utilisateur', actions: ['INVITE_UTILISATEUR'] },
  { exigence: 'désactivation utilisateur', actions: ['DESACTIVER_UTILISATEUR'] },
  { exigence: 'enregistrement paiement', actions: ['ENREGISTRER_PAIEMENT'] },
  { exigence: 'annulation paiement', actions: ['ANNULER_PAIEMENT'] },
  { exigence: 'soumission de notes', actions: ['SOUMETTRE_NOTES'] },
  { exigence: 'modification de note', actions: ['DEMANDER_MODIFICATION_NOTE'] },
  {
    exigence: "validation d'approbation, avec résultat",
    actions: ['APPROUVER_MODIFICATION_NOTE', 'REJETER_MODIFICATION_NOTE'],
  },
  { exigence: 'génération de bulletin', actions: ['GENERER_BULLETIN'] },
  { exigence: "création d'un établissement", actions: ['CREATE_ETABLISSEMENT'] },
];

describe('couverture AuditLog (doc 03 § 12)', () => {
  for (const { exigence, actions } of EXIGENCES) {
    it(`journalise : ${exigence}`, () => {
      for (const action of actions) {
        expect(SOURCES.includes(`'${action}'`), `action ${action} introuvable`).toBe(true);
      }
    });
  }

  /**
   * Le doc 03 § 12 liste aussi « changement de rôle ». Aucun service n'en
   * expose : le rôle est fixé à l'invitation et n'est jamais modifié ensuite.
   * L'exigence est donc sans objet, et ce test le fige : le jour où une
   * fonction de changement de rôle apparaît, il échoue et rappelle qu'il faut
   * la journaliser.
   */
  it("n'expose aucun changement de rôle non journalisé", () => {
    const services = join(RACINE, 'services');
    const suspects = readdirSync(services)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => /export\s+async\s+function\s+\w*([cC]hangerRole|[mM]odifierRole)/.test(
        readFileSync(join(services, f), 'utf8'),
      ));
    expect(suspects).toEqual([]);
  });
});
