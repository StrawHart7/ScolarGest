import {
  STYLE_IDENTITE,
  htmlFiligrane,
  htmlLogo,
  type IdentiteDocument,
} from './identite';
/**
 * Template HTML+CSS inline pour le reçu de paiement. Reproduit fidèlement la
 * mise en page de design-maquette/re_u_de_paiement_rc_2023_089_edusync_erp,
 * avec les tokens de couleur Luminous Institutional. Pas de dépendance
 * réseau/CDN (cohérent avec bulletin.ts).
 */

export interface RecuTemplateInput {
  /** Logo et filigrane de l'établissement (facultatifs). */
  identite?: IdentiteDocument;
  etablissement: {
    nom: string;
    adresse: string | null;
    ville: string | null;
    telephone: string | null;
    email: string | null;
  };
  reference: string;
  dateGeneration: string;
  eleve: {
    nom: string;
    prenoms: string;
    matricule: string;
  };
  classeNom: string | null;
  responsablePrincipal: { nom: string; prenoms: string } | null;
  paiement: {
    montant: number;
    datePaiement: string;
    modePaiement: string;
    reference: string | null;
  };
}

const MODE_LABELS: Record<string, string> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement bancaire',
  MOBILE_MONEY: 'Mobile Money',
  AUTRE: 'Autre',
};

function esc(v: string | null | undefined): string {
  if (v === null || v === undefined) return '';
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMontant(v: number): string {
  return new Intl.NumberFormat('fr-FR').format(v);
}

const UNITES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const DIZAINES = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
const TEENS = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];

/** Conversion nombre -> lettres (français, montants FCFA usuels, best effort). */
export function montantEnLettres(n: number): string {
  if (n === 0) return 'zéro';
  const entier = Math.round(n);

  function centaines(bloc: number): string {
    const c = Math.floor(bloc / 100);
    const reste = bloc % 100;
    let s = '';
    if (c > 0) s += (c > 1 ? UNITES[c] + ' cent' : 'cent') + (c > 1 && reste === 0 ? 's' : '') + (reste > 0 ? ' ' : '');
    if (reste >= 10 && reste < 20) {
      s += TEENS[reste - 10];
    } else if (reste >= 20) {
      const d = Math.floor(reste / 10);
      const u = reste % 10;
      s += DIZAINES[d] + (u > 0 ? '-' + UNITES[u] : '');
    } else if (reste > 0) {
      s += UNITES[reste];
    }
    return s.trim();
  }

  function groupe(nb: number): string {
    if (nb === 0) return '';
    if (nb < 100) return centaines(nb);
    return centaines(nb);
  }

  const millions = Math.floor(entier / 1_000_000);
  const milliers = Math.floor((entier % 1_000_000) / 1000);
  const unites = entier % 1000;

  const parts: string[] = [];
  if (millions > 0) parts.push(`${groupe(millions)} million${millions > 1 ? 's' : ''}`);
  if (milliers > 0) parts.push(milliers === 1 ? 'mille' : `${groupe(milliers)} mille`);
  if (unites > 0 || parts.length === 0) parts.push(groupe(unites));

  return parts.join(' ').trim();
}

export function renderRecuHtml(input: RecuTemplateInput): string {
  const { etablissement, eleve, paiement, identite } = input;
  const montantLettres = `${montantEnLettres(paiement.montant)} francs CFA`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Reçu de paiement ${esc(input.reference)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #191c1e; background: #ffffff; padding: 40px 48px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #003d9b; padding-bottom: 24px; margin-bottom: 32px; }
  .etab-nom { font-size: 20px; font-weight: 700; color: #172B4D; text-transform: uppercase; letter-spacing: 0.02em; }
  .etab-info { font-size: 12px; color: #44546F; margin-top: 2px; }
  .doc-title { font-size: 22px; font-weight: 700; color: #003d9b; text-transform: uppercase; text-align: right; margin-bottom: 8px; }
  .ref-box { display: inline-block; background: #f3f3fb; border: 1px solid #DFE1E6; border-radius: 4px; padding: 8px 16px; text-align: right; }
  .ref-label { font-size: 11px; color: #44546F; text-transform: uppercase; margin-bottom: 2px; }
  .ref-value { font-family: 'Courier New', monospace; font-weight: 700; font-size: 16px; color: #191c1e; }
  .sections { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 32px; }
  .section h3 { font-size: 11px; text-transform: uppercase; color: #44546F; border-bottom: 2px solid #e7e8ea; padding-bottom: 4px; margin-bottom: 8px; }
  .section p { font-size: 13px; color: #44546F; margin-bottom: 2px; }
  .section .nom { font-size: 16px; font-weight: 600; color: #191c1e; margin-bottom: 4px; }
  .section.right { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { border-bottom: 2px solid #DFE1E6; background: #f3f3fb; }
  th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #44546F; }
  th.right, td.right { text-align: right; }
  tbody td { padding: 12px; border-bottom: 1px solid #DFE1E6; font-size: 14px; }
  tfoot td { padding: 12px; font-weight: 700; }
  .total-label { text-align: right; font-size: 14px; text-transform: uppercase; color: #44546F; }
  .total-value { text-align: right; font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #003d9b; background: #f3f3fb; border-bottom: 3px solid #003d9b; }
  .lettres { background: #f3f3fb; border: 1px solid #DFE1E6; border-radius: 4px; padding: 12px 16px; font-size: 12px; color: #44546F; font-style: italic; margin-bottom: 40px; }
  .lettres b { font-style: normal; color: #191c1e; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 24px; border-top: 1px solid #DFE1E6; }
  .signature { width: 45%; text-align: center; }
  .signature-label { font-size: 11px; color: #44546F; text-transform: uppercase; margin-bottom: 50px; }
  .signature-line { border-top: 1px solid #DFE1E6; padding-top: 6px; }
  .footer { text-align: center; margin-top: 32px; padding-top: 12px; border-top: 1px solid #DFE1E6; font-size: 10px; color: #737685; }
${STYLE_IDENTITE}
</style>
</head>
<body>
  ${htmlFiligrane(identite)}
  <div class="header">
    <div>
      ${htmlLogo(identite)}
      <div class="etab-nom">${esc(etablissement.nom)}</div>
      <div class="etab-info">${esc(etablissement.adresse)}${etablissement.adresse && etablissement.ville ? ', ' : ''}${esc(etablissement.ville)}</div>
      <div class="etab-info">${etablissement.email ? esc(etablissement.email) : ''}${etablissement.email && etablissement.telephone ? ' | ' : ''}${etablissement.telephone ? esc(etablissement.telephone) : ''}</div>
    </div>
    <div>
      <div class="doc-title">Reçu de Paiement</div>
      <div class="ref-box">
        <div class="ref-label">N° de reçu</div>
        <div class="ref-value">${esc(input.reference)}</div>
      </div>
    </div>
  </div>

  <div class="sections">
    <div class="section">
      <h3>Informations élève</h3>
      <p class="nom">${esc(eleve.nom)} ${esc(eleve.prenoms)}</p>
      <p>Matricule : <b style="font-family:'Courier New',monospace;">${esc(eleve.matricule)}</b></p>
      ${input.classeNom ? `<p>Classe : ${esc(input.classeNom)}</p>` : ''}
      ${input.responsablePrincipal ? `<p>Responsable : ${esc(input.responsablePrincipal.prenoms)} ${esc(input.responsablePrincipal.nom)}</p>` : ''}
    </div>
    <div class="section right">
      <h3>Détails du règlement</h3>
      <p>Date : ${new Date(paiement.datePaiement).toLocaleDateString('fr-FR')}</p>
      <p>Mode de paiement : ${MODE_LABELS[paiement.modePaiement] ?? esc(paiement.modePaiement)}</p>
      ${paiement.reference ? `<p>Référence règlement : ${esc(paiement.reference)}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description / Motif</th>
        <th class="right">Montant (FCFA)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Paiement de scolarité</td>
        <td class="right" style="font-family:'Courier New',monospace;">${fmtMontant(paiement.montant)}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td class="total-label">Total perçu</td>
        <td class="total-value">${fmtMontant(paiement.montant)} FCFA</td>
      </tr>
    </tfoot>
  </table>

  <div class="lettres">Arrêté le présent reçu à la somme de : <b>${montantLettres}</b>.</div>

  <div class="signatures">
    <div class="signature">
      <div class="signature-label">Le Caissier / Le Comptable</div>
      <div class="signature-line"></div>
    </div>
    <div class="signature">
      <div class="signature-label">Cachet de l'Établissement</div>
      <div class="signature-line"></div>
    </div>
  </div>

  <div class="footer">Document généré par ScolarGest le ${new Date(input.dateGeneration).toLocaleString('fr-FR')} — Référence ${esc(input.reference)}</div>
</body>
</html>`;
}
