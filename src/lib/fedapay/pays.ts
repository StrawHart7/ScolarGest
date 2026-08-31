/**
 * Pays couverts par le paiement mobile FedaPay, et format de leurs numéros.
 *
 * La liste n'est pas « l'Afrique de l'Ouest » mais **les pays des moyens de
 * paiement que FedaPay documente réellement** : `mtn` et `moov` (Bénin),
 * `moov_tg` (Togo), `mtn_ci` (Côte d'Ivoire). Proposer le Sénégal ou le Mali
 * afficherait un choix qui échouerait au moment de payer, ce qui est pire que
 * de ne pas le proposer.
 *
 * Les longueurs sont données en intervalle plutôt qu'en valeur exacte : les
 * plans de numérotation ont bougé récemment dans la sous-région (passage à dix
 * chiffres au Bénin et en Côte d'Ivoire), et les numéros de test de FedaPay
 * sont encore à huit chiffres. Un contrôle trop strict rejetterait des numéros
 * valides — et rejeter un client qui veut payer est la pire erreur possible
 * sur cet écran.
 */

export interface PaysFedaPay {
  /** Code ISO 3166-1 alpha-2 en minuscules, tel qu'attendu par FedaPay. */
  code: string;
  nom: string;
  /** Indicatif international, affiché devant le champ. */
  indicatif: string;
  longueurMin: number;
  longueurMax: number;
  exemple: string;
}

export const PAYS_FEDAPAY: PaysFedaPay[] = [
  { code: 'tg', nom: 'Togo', indicatif: '+228', longueurMin: 8, longueurMax: 8, exemple: '90 12 34 56' },
  { code: 'bj', nom: 'Bénin', indicatif: '+229', longueurMin: 8, longueurMax: 10, exemple: '01 97 00 00 00' },
  { code: 'ci', nom: "Côte d'Ivoire", indicatif: '+225', longueurMin: 8, longueurMax: 10, exemple: '07 07 00 00 00' },
];

export function trouverPays(code: string): PaysFedaPay | undefined {
  return PAYS_FEDAPAY.find((p) => p.code === code);
}

export interface NumeroNormalise {
  ok: boolean;
  /** Numéro national, chiffres uniquement — la forme attendue par FedaPay. */
  numero?: string;
  message?: string;
}

/**
 * Ramène une saisie libre au numéro national attendu par FedaPay.
 *
 * Retire les espaces, points, tirets et parenthèses, puis l'indicatif sous
 * toutes ses formes usuelles : `+228`, `00228`, ou `228` collé devant. Ce
 * dernier cas exige une précaution — un numéro togolais peut légitimement
 * commencer par 228 ? non, mais un numéro plus long le peut : on ne retire
 * donc l'indicatif que si ce qui reste a une longueur plausible.
 *
 * Normaliser ici plutôt qu'en base : ce qui est stocké dans
 * `transaction_fedapay.telephone` doit être exactement ce qui a été envoyé à
 * FedaPay, sinon un rapprochement en cas de litige devient impossible.
 */
export function normaliserNumero(brut: string, codePays: string): NumeroNormalise {
  const pays = trouverPays(codePays);
  if (!pays) return { ok: false, message: 'Pays non pris en charge.' };

  let chiffres = brut.replace(/\D/g, '');
  if (chiffres === '') return { ok: false, message: 'Saisissez votre numéro de téléphone.' };

  const indicatif = pays.indicatif.replace('+', '');
  if (chiffres.startsWith('00' + indicatif)) {
    chiffres = chiffres.slice(2 + indicatif.length);
  } else if (
    chiffres.startsWith(indicatif) &&
    chiffres.length - indicatif.length >= pays.longueurMin
  ) {
    chiffres = chiffres.slice(indicatif.length);
  }

  if (chiffres.length < pays.longueurMin || chiffres.length > pays.longueurMax) {
    const attendu =
      pays.longueurMin === pays.longueurMax
        ? `${pays.longueurMin} chiffres`
        : `${pays.longueurMin} à ${pays.longueurMax} chiffres`;
    return {
      ok: false,
      message: `Numéro ${pays.nom} invalide : ${attendu} attendus, par exemple ${pays.exemple}.`,
    };
  }

  return { ok: true, numero: chiffres };
}
