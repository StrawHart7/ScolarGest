import type { DonneesBulletin } from '@/services/bulletin-donnees';

/**
 * Template HTML+CSS inline (pas de composant React, pas de dépendance
 * réseau/CDN — le document doit rester rendable hors-ligne par Chromium)
 * pour le bulletin trimestriel. Reproduit fidèlement la mise en page de
 * design-maquette/aper_u_bulletin_secondaire_edusync_erp (en-tête
 * établissement/scolaire/élève, tableau des matières, synthèse, signatures),
 * avec les tokens de couleur Luminous Institutional (tailwind.config.ts).
 */

export interface BulletinTemplateInput {
  etablissement: {
    nom: string;
    adresse: string | null;
    ville: string | null;
    telephone: string | null;
    email: string | null;
  };
  anneeScolaireLibelle: string;
  periodeLabel: string;
  eleve: {
    nom: string;
    prenoms: string;
    dateNaissance: string;
    matricule: string;
  };
  classeNom: string;
  reference: string;
  dateGeneration: string;
  donnees: DonneesBulletin;
}

const PERIODE_LABELS: Record<string, string> = {
  TRIMESTRE_1: '1er Trimestre',
  TRIMESTRE_2: '2e Trimestre',
  TRIMESTRE_3: '3e Trimestre',
};

export function periodeLabel(periode: string): string {
  return PERIODE_LABELS[periode] ?? periode;
}

function esc(v: string | null | undefined): string {
  if (v === null || v === undefined) return '';
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(v: number | null): string {
  return v === null ? '—' : v.toFixed(2);
}

function fmtRang(v: number | null): string {
  return v === null ? '—' : String(v);
}

export function renderBulletinHtml(input: BulletinTemplateInput): string {
  const { etablissement, eleve, donnees } = input;
  const zebra = (i: number) => (i % 2 === 0 ? '#ffffff' : '#f3f3fb');

  const lignesMatieres = donnees.matieres
    .map(
      (m, i) => `
      <tr style="background:${zebra(i)}; border-bottom:1px solid #DFE1E6;">
        <td style="padding:8px 12px; font-weight:600; color:#172B4D;">${esc(m.matiereNom)}</td>
        <td style="padding:8px 12px; text-align:center; font-family:'Courier New',monospace; color:#44546F;">${m.coefficient}</td>
        <td style="padding:8px 12px; text-align:center; font-family:'Courier New',monospace; font-weight:700; color:#172B4D;">${fmt(m.moyenneFinale)}</td>
        <td style="padding:8px 12px; text-align:center; font-family:'Courier New',monospace; color:#44546F;">${fmtRang(m.rangMatiere)}</td>
        <td style="padding:8px 12px; color:#44546F; font-size:12px;">${esc(m.professeurs) || '—'}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Bulletin scolaire - ${esc(eleve.nom)} ${esc(eleve.prenoms)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    color: #191c1e;
    background: #ffffff;
    padding: 32px 40px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #003d9b;
    padding-bottom: 20px;
    margin-bottom: 24px;
  }
  .etab-nom { font-size: 22px; font-weight: 700; color: #172B4D; text-transform: uppercase; letter-spacing: -0.01em; }
  .etab-info { font-size: 12px; color: #44546F; margin-top: 2px; }
  .doc-title { font-size: 18px; font-weight: 700; color: #172B4D; text-transform: uppercase; text-align: right; }
  .doc-meta { font-size: 12px; color: #44546F; text-align: right; margin-top: 4px; }
  .doc-meta b { font-family: 'Courier New', monospace; color: #191c1e; }
  .info-block {
    display: flex;
    gap: 24px;
    background: #f3f3fb;
    border: 1px solid #DFE1E6;
    border-radius: 4px;
    padding: 14px 18px;
    margin-bottom: 24px;
  }
  .info-col { flex: 1; font-size: 13px; }
  .info-row { display: flex; margin-bottom: 4px; }
  .info-label { width: 100px; color: #44546F; font-size: 11px; text-transform: uppercase; font-weight: 600; }
  .info-value { color: #172B4D; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #DFE1E6; }
  thead tr { background: #e7e8ea; border-bottom: 1px solid #DFE1E6; }
  th { padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em; color: #191c1e; }
  .synthese { display: flex; gap: 16px; margin-bottom: 32px; }
  .synthese-box { flex: 1; border: 1px solid #DFE1E6; border-radius: 4px; padding: 16px 18px; }
  .synthese-primary { background: #dae2ff; }
  .synthese-line { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12px; color: #0040a2; }
  .synthese-title { font-size: 15px; font-weight: 700; color: #001848; }
  .synthese-value { font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #001848; }
  .synthese-sub { font-size: 12px; color: #44546F; }
  .synthese-sub b { font-family: 'Courier New', monospace; color: #191c1e; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 24px; border-top: 1px solid #DFE1E6; }
  .signature { width: 30%; text-align: center; }
  .signature-label { font-size: 11px; color: #44546F; text-transform: uppercase; margin-bottom: 50px; }
  .signature-line { border-top: 1px solid #DFE1E6; padding-top: 6px; font-size: 13px; color: #172B4D; }
  .footer { text-align: center; margin-top: 24px; font-size: 10px; color: #737685; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="etab-nom">${esc(etablissement.nom)}</div>
      <div class="etab-info">${esc(etablissement.adresse)}${etablissement.adresse && etablissement.ville ? ', ' : ''}${esc(etablissement.ville)}</div>
      <div class="etab-info">${etablissement.telephone ? 'Tél : ' + esc(etablissement.telephone) : ''}${etablissement.telephone && etablissement.email ? ' &bull; ' : ''}${etablissement.email ? 'email : ' + esc(etablissement.email) : ''}</div>
    </div>
    <div>
      <div class="doc-title">Bulletin Scolaire</div>
      <div class="doc-meta">Année Scolaire : <b>${esc(input.anneeScolaireLibelle)}</b></div>
      <div class="doc-meta">Période : <b>${esc(input.periodeLabel)}</b></div>
      <div class="doc-meta">Référence : <b>${esc(input.reference)}</b></div>
    </div>
  </div>

  <div class="info-block">
    <div class="info-col">
      <div class="info-row"><span class="info-label">Nom</span><span class="info-value">${esc(eleve.nom).toUpperCase()}</span></div>
      <div class="info-row"><span class="info-label">Prénoms</span><span class="info-value">${esc(eleve.prenoms)}</span></div>
      <div class="info-row"><span class="info-label">Né(e) le</span><span class="info-value">${new Date(eleve.dateNaissance).toLocaleDateString('fr-FR')}</span></div>
    </div>
    <div class="info-col">
      <div class="info-row"><span class="info-label">Matricule</span><span class="info-value">${esc(eleve.matricule)}</span></div>
      <div class="info-row"><span class="info-label">Classe</span><span class="info-value">${esc(input.classeNom)}</span></div>
      <div class="info-row"><span class="info-label">Effectif</span><span class="info-value">${donnees.synthese.effectifClasse}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:26%;">Matières</th>
        <th style="width:10%; text-align:center;">Coef.</th>
        <th style="width:14%; text-align:center;">Moyenne</th>
        <th style="width:10%; text-align:center;">Rang</th>
        <th>Professeur</th>
      </tr>
    </thead>
    <tbody>
      ${lignesMatieres}
    </tbody>
  </table>

  <div class="synthese">
    <div class="synthese-box synthese-primary">
      <div class="synthese-line">
        <span class="synthese-title">Moyenne Générale</span>
        <span class="synthese-value">${fmt(donnees.synthese.moyenneTrimestrielle)}</span>
      </div>
      <div class="synthese-line"><span>Rang Général</span><span><b>${fmtRang(donnees.synthese.rangGeneral)}</b> / ${donnees.synthese.effectifClasse}</span></div>
      <div class="synthese-line"><span>Meilleure moyenne de la classe</span><span>${fmt(donnees.synthese.meilleureMoyenneClasse)}</span></div>
      <div class="synthese-line"><span>Plus faible moyenne de la classe</span><span>${fmt(donnees.synthese.plusFaibleMoyenneClasse)}</span></div>
      ${donnees.synthese.moyenneAnnuelle !== null ? `<div class="synthese-line"><span>Moyenne annuelle</span><span>${fmt(donnees.synthese.moyenneAnnuelle)}</span></div>` : ''}
    </div>
    <div class="synthese-box" style="background:#f3f3fb;">
      <div style="font-size:11px; text-transform:uppercase; color:#44546F; margin-bottom:8px; font-weight:600;">Appréciation générale</div>
      <div style="font-size:14px; color:#172B4D; font-style:italic;">${esc(donnees.synthese.appreciation) || 'Non disponible (moyenne non calculable pour cette période).'}</div>
    </div>
  </div>

  <div class="signatures">
    <div class="signature">
      <div class="signature-label">Le Professeur Principal</div>
      <div class="signature-line"></div>
    </div>
    <div class="signature">
      <div class="signature-label">Signature des Parents</div>
      <div class="signature-line" style="font-style:italic; color:#44546F;">(Lu et pris connaissance)</div>
    </div>
    <div class="signature">
      <div class="signature-label">Le Chef d'Établissement</div>
      <div class="signature-line"></div>
    </div>
  </div>

  <div class="footer">Document généré par ScolarGest le ${new Date(input.dateGeneration).toLocaleDateString('fr-FR')} — Référence ${esc(input.reference)}</div>
</body>
</html>`;
}
