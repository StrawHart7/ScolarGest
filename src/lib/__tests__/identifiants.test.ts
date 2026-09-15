import { describe, it, expect } from 'vitest';
import {
  DOMAINE_INTERNE,
  emailDepuisIdentifiant,
  estCompteSansEmail,
  identifiantAffiche,
  identifiantOuEmail,
  identifiantValide,
  motDePasseProvisoire,
  normaliserIdentifiant,
  proposerIdentifiant,
} from '../identifiants';

/**
 * Se connecter sans adresse email.
 *
 * Tout repose sur une correspondance sans stockage : l'identifiant est
 * l'adresse interne privée de son domaine. Si elle se défait dans un sens, des
 * comptes deviennent inaccessibles ; si elle se défait dans l'autre, une
 * adresse qui ne reçoit rien s'affiche comme un moyen de contact.
 */
describe('identifiant et adresse interne', () => {
  it('fait l’aller-retour', () => {
    const email = emailDepuisIdentifiant('kossi.adjovi');
    expect(email).toBe(`kossi.adjovi@${DOMAINE_INTERNE}`);
    expect(estCompteSansEmail(email)).toBe(true);
    expect(identifiantAffiche(email)).toBe('kossi.adjovi');
  });

  it('laisse une vraie adresse intacte', () => {
    expect(estCompteSansEmail('directeur@ecole.tg')).toBe(false);
    expect(identifiantAffiche('directeur@ecole.tg')).toBe('directeur@ecole.tg');
  });

  it('ne confond pas un domaine qui ressemble', () => {
    // `scolargest.com` n'est pas `comptes.scolargest.com` : un compte du
    // support passerait pour un compte sans adresse, et son email disparaîtrait
    // des écrans.
    expect(estCompteSansEmail('support@scolargest.com')).toBe(false);
    expect(estCompteSansEmail('a@faux-comptes.scolargest.com.tg')).toBe(false);
  });
});

describe('normalisation', () => {
  it('retire les accents plutôt que de refuser le nom', () => {
    // « Koffi Ayélé » doit produire un identifiant qu'on sait retaper : un
    // identifiant qui exige un accent est un identifiant qu'on ne tape pas.
    expect(normaliserIdentifiant('Ayélé')).toBe('ayele');
    expect(normaliserIdentifiant('Kodjo  Ahouéfa')).toBe('kodjo.ahouefa');
  });

  it('écrase les séparateurs de bord et les doublons', () => {
    expect(normaliserIdentifiant('  ..kossi--adjovi.. ')).toBe('kossi--adjovi');
    expect(normaliserIdentifiant('a@@@b')).toBe('a.b');
  });

  it('propose prénom.nom, pas l’inverse', () => {
    expect(proposerIdentifiant('ADJOVI', 'Kossi Marc')).toBe('kossi.adjovi');
  });

  it('refuse ce qui ne se distingue pas', () => {
    expect(identifiantValide('ab')).toBe(false);
    expect(identifiantValide('...')).toBe(false);
    expect(identifiantValide('abc')).toBe(true);
  });
});

describe('ce que l’écran de connexion envoie', () => {
  it('complète une saisie sans arobase', () => {
    expect(identifiantOuEmail('kossi.adjovi')).toBe(`kossi.adjovi@${DOMAINE_INTERNE}`);
  });

  it('laisse passer une adresse telle quelle', () => {
    // Surtout pas de normalisation ici : elle remplacerait le `+` d'une
    // adresse `nom+ecole@gmail.com` et la connexion échouerait sans motif.
    expect(identifiantOuEmail(' nom+ecole@gmail.com ')).toBe('nom+ecole@gmail.com');
  });
});

describe('mot de passe provisoire', () => {
  it('a la longueur demandée et se lit sans ambiguïté', () => {
    for (let i = 0; i < 200; i += 1) {
      const mot = motDePasseProvisoire();
      expect(mot).toHaveLength(12);
      // Il est recopié à la main sur un papier puis retapé par quelqu'un qui
      // n'a peut-être jamais utilisé de clavier : deux caractères qui se
      // ressemblent, et c'est un appel au directeur.
      expect(mot).not.toMatch(/[Il1O0]/);
      expect(mot).toMatch(/^[A-Za-z2-9]+$/);
    }
  });

  it('ne rend pas deux fois la même chose', () => {
    const tirages = new Set(Array.from({ length: 100 }, () => motDePasseProvisoire()));
    expect(tirages.size).toBe(100);
  });
});
