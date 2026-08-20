import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  formaterCellule,
  nomFichier,
  versCsv,
  versHtml,
  versMatrice,
  versXlsx,
  type Rapport,
} from '../rapport';

const RAPPORT: Rapport = {
  titre: 'État des paiements',
  sousTitre: '2025-2026',
  colonnes: [
    { cle: 'matricule', libelle: 'Matricule' },
    { cle: 'eleve', libelle: 'Élève' },
    { cle: 'du', libelle: 'Total dû', numerique: true },
    { cle: 'paye', libelle: 'Total payé', numerique: true },
  ],
  lignes: [
    { matricule: 'ELV-2025-000001', eleve: 'Mensah Kossi', du: 210000, paye: 132000 },
    { matricule: 'ELV-2025-000002', eleve: 'Adjovi; Afiwa', du: 180000, paye: 180000 },
  ],
  totaux: { matricule: 'Totaux', eleve: null, du: 390000, paye: 312000 },
};

describe('formaterCellule', () => {
  it('rend une chaîne vide pour null', () => {
    expect(formaterCellule(null)).toBe('');
  });

  it('formate les nombres en séparateurs français quand la colonne est numérique', () => {
    expect(formaterCellule(210000, true)).toBe((210000).toLocaleString('fr-FR'));
  });

  it('laisse les nombres bruts sur une colonne non numérique', () => {
    expect(formaterCellule(2026)).toBe('2026');
  });
});

describe('versMatrice', () => {
  it('place les en-têtes en première ligne puis les données', () => {
    const matrice = versMatrice(RAPPORT);
    expect(matrice[0]).toEqual(['Matricule', 'Élève', 'Total dû', 'Total payé']);
    expect(matrice[1]).toEqual(['ELV-2025-000001', 'Mensah Kossi', 210000, 132000]);
  });

  it('ajoute la ligne de totaux en dernier', () => {
    const matrice = versMatrice(RAPPORT);
    expect(matrice[matrice.length - 1]).toEqual(['Totaux', null, 390000, 312000]);
  });

  it('n ajoute pas de ligne de totaux quand le rapport n en a pas', () => {
    const sansTotaux = { ...RAPPORT, totaux: undefined };
    expect(versMatrice(sansTotaux)).toHaveLength(3); // en-tête + 2 lignes
  });
});

describe('versCsv', () => {
  it('sépare par des points-virgules et commence par un BOM UTF-8 (attendu par Excel FR)', () => {
    const csv = versCsv(RAPPORT);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Matricule;Élève;Total dû;Total payé');
  });

  it('échappe une valeur contenant le séparateur', () => {
    expect(versCsv(RAPPORT)).toContain('"Adjovi; Afiwa"');
  });

  it('termine les lignes en CRLF', () => {
    expect(versCsv(RAPPORT)).toContain('\r\n');
  });
});

describe('versXlsx', () => {
  it('produit un classeur relisible, avec les données aux bonnes cellules', () => {
    const buffer = versXlsx(RAPPORT);
    const classeur = XLSX.read(buffer, { type: 'buffer' });
    const feuille = classeur.Sheets[classeur.SheetNames[0]!]!;
    const lignes = XLSX.utils.sheet_to_json<Record<string, unknown>>(feuille);

    expect(classeur.SheetNames[0]).toBe('État des paiements');
    expect(lignes).toHaveLength(3); // 2 lignes + totaux
    expect(lignes[0]!['Matricule']).toBe('ELV-2025-000001');
    expect(lignes[0]!['Total dû']).toBe(210000);
  });

  it('tronque un titre de feuille trop long (limite Excel de 31 caractères)', () => {
    const buffer = versXlsx({
      ...RAPPORT,
      titre: 'Un titre de rapport vraiment beaucoup trop long pour Excel',
    });
    const classeur = XLSX.read(buffer, { type: 'buffer' });
    expect(classeur.SheetNames[0]!.length).toBeLessThanOrEqual(31);
  });
});

describe('versHtml', () => {
  const contexte = { etablissement: 'Les Victorieux', genereLe: '19/08/2026' };

  it('inclut le titre, l établissement et toutes les lignes', () => {
    const html = versHtml(RAPPORT, contexte);
    expect(html).toContain('État des paiements');
    expect(html).toContain('Les Victorieux');
    expect(html).toContain('Mensah Kossi');
    expect(html).toContain('2 ligne(s)');
  });

  it('échappe le HTML des données pour qu une valeur ne casse pas le document', () => {
    const html = versHtml(
      {
        ...RAPPORT,
        lignes: [{ matricule: '<script>alert(1)</script>', eleve: null, du: 0, paye: 0 }],
        totaux: undefined,
      },
      contexte,
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('formate les colonnes numériques avec séparateurs de milliers', () => {
    expect(versHtml(RAPPORT, contexte)).toContain((210000).toLocaleString('fr-FR'));
  });
});

describe('nomFichier', () => {
  it('translittère, met en minuscules et date le fichier', () => {
    expect(nomFichier(RAPPORT, 'xlsx', new Date('2026-08-19T10:00:00Z'))).toBe(
      'etat-des-paiements-2026-08-19.xlsx',
    );
  });
});
