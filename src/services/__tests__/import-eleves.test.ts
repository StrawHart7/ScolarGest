import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';

const mockGetTenantContext = vi.fn();
vi.mock('../tenant', () => ({
  getTenantContext: () => mockGetTenantContext(),
}));
vi.mock('../audit', () => ({ auditLog: vi.fn(async () => undefined) }));

const mockCreateEleveAvecResponsables = vi.fn();
vi.mock('../eleve', () => ({
  createEleveAvecResponsables: (...args: unknown[]) => mockCreateEleveAvecResponsables(...args),
}));

const mockCreerInscriptionAvecFacture = vi.fn();
vi.mock('../inscription', () => ({
  creerInscriptionAvecFacture: (...args: unknown[]) => mockCreerInscriptionAvecFacture(...args),
}));

const mockClasses = vi.fn();
const mockElevesExistants = vi.fn();

/**
 * Requête Supabase simulée : chaînable (`.eq()`, `.order()`) et attendable.
 * Le service enchaîne un nombre de `.eq()` différent selon la table.
 */
function requete(resultat: unknown) {
  const obj = {
    eq: () => obj,
    order: () => obj,
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(resultat).then(res, rej),
  };
  return obj;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => requete(table === 'classe' ? mockClasses() : mockElevesExistants()),
    }),
  }),
}));

import { preparerImportEleves, executerImportEleves } from '../import-eleves';

const ENTETE_COMPLETE = {
  nom: 'Kouassi',
  prenoms: 'Awa',
  sexe: 'F',
  date_naissance: '2012-03-15',
  lieu_naissance: 'Lomé',
  nationalite: 'Togolaise',
  ancien_matricule: '',
  classe: '6e A',
  nom_responsable: 'Kouassi',
  prenoms_responsable: 'Jean',
  telephone_responsable: '90000000',
  email_responsable: 'jean@example.com',
  type_responsable: 'PERE',
  lien_parente: 'Père',
  principal: 'OUI',
};

function classeur(lignes: Record<string, string>[]): Buffer {
  const feuille = XLSX.utils.json_to_sheet(lignes);
  const livre = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livre, feuille, 'Feuille1');
  return XLSX.write(livre, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function eleve(overrides: Record<string, string> = {}) {
  return { ...ENTETE_COMPLETE, ...overrides };
}

describe('preparerImportEleves', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
    mockClasses.mockReturnValue({ data: [{ id: 'classe1', nom: '6e A' }], error: null });
    mockElevesExistants.mockReturnValue({ data: [], error: null });
    mockCreateEleveAvecResponsables.mockReset();
    mockCreerInscriptionAvecFacture.mockReset();
  });

  it('marque prete une ligne valide dont la classe existe', async () => {
    const { analyse, aEcrire } = await preparerImportEleves(classeur([eleve()]), 'annee1');
    expect(analyse.entetes.conforme).toBe(true);
    expect(analyse.lignes).toHaveLength(1);
    expect(analyse.lignes[0]?.statut).toBe('PRETE');
    expect(aEcrire).toHaveLength(1);
  });

  it("n'ecrit rien : preparer est une lecture", async () => {
    await preparerImportEleves(classeur([eleve()]), 'annee1');
    expect(mockCreateEleveAvecResponsables).not.toHaveBeenCalled();
    expect(mockCreerInscriptionAvecFacture).not.toHaveBeenCalled();
  });

  it('refuse une ligne dont la classe est introuvable, sans toucher aux autres', async () => {
    const { analyse, aEcrire } = await preparerImportEleves(
      classeur([eleve(), eleve({ nom: 'Autre', classe: 'Classe inexistante' })]),
      'annee1',
    );
    expect(analyse.lignes.map((l) => l.statut)).toEqual(['PRETE', 'REFUSEE']);
    expect(analyse.lignes[1]?.motif).toMatch(/introuvable/);
    expect(aEcrire).toHaveLength(1);
  });

  it('ecarte un eleve deja present en base', async () => {
    mockElevesExistants.mockReturnValue({
      data: [{ nom: 'Kouassi', prenoms: 'Awa', dateNaissance: '2012-03-15T00:00:00+00:00' }],
      error: null,
    });
    const { analyse, aEcrire } = await preparerImportEleves(classeur([eleve()]), 'annee1');
    expect(analyse.lignes[0]?.statut).toBe('DOUBLON');
    expect(aEcrire).toHaveLength(0);
  });

  it('ecarte le second exemplaire d_une meme ligne repetee dans le fichier', async () => {
    // Le piege : la liste des identites est chargee avant la boucle. Sans mise
    // a jour au fil de l'eau, la seconde occurrence passerait.
    const { analyse, aEcrire } = await preparerImportEleves(
      classeur([eleve(), eleve()]),
      'annee1',
    );
    expect(analyse.lignes.map((l) => l.statut)).toEqual(['PRETE', 'DOUBLON']);
    expect(aEcrire).toHaveLength(1);
  });

  it('ne confond pas deux homonymes nes a des dates differentes', async () => {
    const { analyse } = await preparerImportEleves(
      classeur([eleve(), eleve({ date_naissance: '2013-03-15' })]),
      'annee1',
    );
    expect(analyse.lignes.map((l) => l.statut)).toEqual(['PRETE', 'PRETE']);
  });

  it("s'arrete net si les colonnes ne correspondent pas, sans lister 230 fois la meme erreur", async () => {
    const { analyse, aEcrire } = await preparerImportEleves(
      classeur([
        { 'Nom complet': 'Kouassi Awa', Naissance: '2012-03-15' },
        { 'Nom complet': 'Autre Eleve', Naissance: '2011-01-01' },
      ]),
      'annee1',
    );
    expect(analyse.entetes.conforme).toBe(false);
    expect(analyse.entetes.manquantes).toContain('date_naissance');
    expect(analyse.lignes).toEqual([]);
    expect(analyse.erreursValidation).toEqual([]);
    expect(analyse.totalLignes).toBe(2);
    expect(aEcrire).toHaveLength(0);
  });

  it('accepte une casse differente dans les en-tetes et lit quand meme les valeurs', async () => {
    const majuscules = Object.fromEntries(
      Object.entries(eleve()).map(([k, v]) => [k.toUpperCase(), v]),
    ) as Record<string, string>;
    const { analyse } = await preparerImportEleves(classeur([majuscules]), 'annee1');
    expect(analyse.entetes.conforme).toBe(true);
    expect(analyse.lignes[0]?.statut).toBe('PRETE');
    expect(analyse.lignes[0]?.libelle).toBe('Kouassi Awa');
  });
});

describe('executerImportEleves', () => {
  beforeEach(() => {
    mockGetTenantContext.mockResolvedValue({
      userId: 'u1',
      etablissementId: 'etab1',
      role: 'SECRETAIRE',
      email: 'a@a.com',
    });
    mockClasses.mockReturnValue({ data: [{ id: 'classe1', nom: '6e A' }], error: null });
    mockElevesExistants.mockReturnValue({ data: [], error: null });
    mockCreateEleveAvecResponsables.mockReset();
    mockCreerInscriptionAvecFacture.mockReset();
  });

  it("n'ecrit que les lignes pretes, et compte les doublons a part", async () => {
    mockElevesExistants.mockReturnValue({
      data: [{ nom: 'Kouassi', prenoms: 'Awa', dateNaissance: '2012-03-15T00:00:00+00:00' }],
      error: null,
    });
    mockCreateEleveAvecResponsables.mockResolvedValue('eleve1');
    mockCreerInscriptionAvecFacture.mockResolvedValue({ inscriptionId: 'i1', factureId: 'f1' });

    const { rapport } = await executerImportEleves(
      classeur([eleve(), eleve({ nom: 'Neuf', prenoms: 'Eleve' })]),
      'annee1',
    );

    expect(mockCreateEleveAvecResponsables).toHaveBeenCalledTimes(1);
    expect(rapport.succes).toBe(1);
    expect(rapport.doublons).toBe(1);
    expect(rapport.echecs).toBe(0);
  });

  it("un echec d'ecriture n'arrete pas les lignes suivantes", async () => {
    mockCreateEleveAvecResponsables
      .mockRejectedValueOnce(new Error('Erreur RPC simulée'))
      .mockResolvedValueOnce('eleve2');
    mockCreerInscriptionAvecFacture.mockResolvedValue({ inscriptionId: 'i1', factureId: 'f1' });

    const { rapport } = await executerImportEleves(
      classeur([eleve(), eleve({ nom: 'Autre', prenoms: 'Personne' })]),
      'annee1',
    );

    expect(rapport.details).toHaveLength(2);
    expect(rapport.details[0]).toMatchObject({ ok: false, message: 'Erreur RPC simulée' });
    expect(rapport.details[1]).toMatchObject({ ok: true, eleveId: 'eleve2' });
    expect(rapport.succes).toBe(1);
    expect(rapport.echecs).toBe(1);
  });

  it('un fichier entierement redepose ne reecrit rien', async () => {
    mockElevesExistants.mockReturnValue({
      data: [
        { nom: 'Kouassi', prenoms: 'Awa', dateNaissance: '2012-03-15T00:00:00+00:00' },
        { nom: 'Autre', prenoms: 'Personne', dateNaissance: '2012-03-15T00:00:00+00:00' },
      ],
      error: null,
    });

    const { rapport } = await executerImportEleves(
      classeur([eleve(), eleve({ nom: 'Autre', prenoms: 'Personne' })]),
      'annee1',
    );

    expect(mockCreateEleveAvecResponsables).not.toHaveBeenCalled();
    expect(rapport.succes).toBe(0);
    expect(rapport.echecs).toBe(0);
    expect(rapport.doublons).toBe(2);
  });
});
