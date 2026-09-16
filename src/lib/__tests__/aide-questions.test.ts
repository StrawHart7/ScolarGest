import { describe, it, expect } from 'vitest';
import {
  QUESTIONS,
  THEMES,
  correspond,
  normaliser,
  questionsPourRole,
  type ThemeAide,
} from '../aide/questions';
import { cheminAutorise } from '../navigation';
import type { Role } from '@/services/tenant';

const ROLES: Role[] = ['DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT'];

describe('catalogue', () => {
  it('donne à chaque rôle de quoi répondre', () => {
    // Un rôle à deux questions n'a pas d'aide, il a un écriteau. Le seuil est
    // arbitraire ; ce qu'il empêche ne l'est pas — ajouter vingt questions
    // réservées au Directeur et croire l'aide complète.
    for (const role of ROLES) {
      expect(questionsPourRole(role).length, `rôle ${role}`).toBeGreaterThanOrEqual(8);
    }
  });

  it('n’a aucun identifiant en double', () => {
    // L'identifiant sert d'ancre dans l'adresse : un doublon rendrait un lien
    // partagé ambigu.
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('range chaque question dans un thème existant', () => {
    const connus = new Set<ThemeAide>(THEMES.map((t) => t.id));
    for (const q of QUESTIONS) {
      expect(connus.has(q.theme), `${q.id} → ${q.theme}`).toBe(true);
    }
  });

  it('ne laisse aucun thème vide', () => {
    // Un thème sans question afficherait une puce qui ne filtre rien.
    for (const theme of THEMES) {
      expect(
        QUESTIONS.some((q) => q.theme === theme.id),
        `thème ${theme.id} sans question`,
      ).toBe(true);
    }
  });

  it('donne au moins un rôle et une réponse à chaque question', () => {
    for (const q of QUESTIONS) {
      expect(q.roles.length, `${q.id} sans rôle`).toBeGreaterThan(0);
      expect(q.reponse.length, `${q.id} sans réponse`).toBeGreaterThan(0);
      expect(q.reponse.every((p) => p.trim().length > 0), `${q.id} paragraphe vide`).toBe(true);
    }
  });
});

describe('les liens mènent quelque part d’ouvert', () => {
  /**
   * Le piège que ce test ferme : proposer à un Enseignant « Voir les tarifs »
   * et l'envoyer sur un écran que son rôle ne peut pas ouvrir. L'aide se
   * retournerait alors contre elle-même — elle prouverait qu'on ne lui parle
   * pas à lui.
   *
   * `cheminAutorise` est la même fonction que celle qui construit la barre
   * latérale : on compare au vrai périmètre, pas à une liste recopiée.
   */
  it('chaque lien est ouvert à tous les rôles de sa question', () => {
    for (const q of QUESTIONS) {
      if (!q.lien) continue;
      for (const role of q.roles) {
        expect(
          cheminAutorise(q.lien.href, role),
          `${q.id} : ${q.lien.href} fermé au rôle ${role}`,
        ).toBe(true);
      }
    }
  });
});

describe('recherche', () => {
  it('ignore les accents, dans les deux sens', () => {
    const question = QUESTIONS.find((q) => q.id === 'facture-annulee-total')!;
    expect(correspond(question, 'annulee')).toBe(true);
    expect(correspond(question, 'annulée')).toBe(true);
  });

  it('exige tous les mots saisis', () => {
    // « facture annulée » ne doit pas ramener toutes les questions qui parlent
    // de facture : c'est ce qui rend la recherche utile passé dix entrées.
    const question = QUESTIONS.find((q) => q.id === 'facture-annulee-total')!;
    expect(correspond(question, 'facture annulee')).toBe(true);
    expect(correspond(question, 'facture bulletin trimestre')).toBe(false);
  });

  it('trouve par les mots de l’école, pas seulement par les nôtres', () => {
    // « écolage » n'apparaît dans aucune réponse ; c'est pourtant le mot
    // employé au Togo pour les frais de scolarité.
    const tarifs = QUESTIONS.find((q) => q.id === 'tarif-fige')!;
    expect(correspond(tarifs, 'ecolage')).toBe(true);

    const horsLigne = QUESTIONS.find((q) => q.id === 'coupure-courant')!;
    expect(correspond(horsLigne, 'delestage')).toBe(true);
  });

  it('rend tout sur une recherche vide', () => {
    expect(QUESTIONS.every((q) => correspond(q, '   '))).toBe(true);
  });

  it('normalise en minuscules sans accent', () => {
    expect(normaliser('Périmé À')).toBe('perime a');
  });
});

describe('ce que l’aide ne doit plus dire', () => {
  /**
   * Deux réponses étaient devenues fausses sans que personne le voie. Ce test
   * ne peut pas garantir que tout est vrai — seul un relecteur le peut — mais
   * il verrouille les deux règles qui ont changé, et il tombera si quelqu'un
   * les réintroduit de bonne foi en recopiant un ancien texte.
   */
  it('n’annonce plus que les lignes d’une facture se figent au premier versement', () => {
    const texte = normaliser(
      QUESTIONS.flatMap((q) => [q.question, ...q.reponse]).join(' '),
    );
    expect(texte).not.toContain('lignes sont figees');
    expect(texte).not.toContain('ne sont plus modifiables');
  });

  it('n’annonce plus qu’une demande de support est visible par l’établissement', () => {
    const support = QUESTIONS.find((q) => q.id === 'support-reponse')!;
    const texte = normaliser(support.reponse.join(' '));
    expect(texte).toContain('que par vous');
  });
});
