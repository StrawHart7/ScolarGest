import { createClient } from '@/lib/supabase/server';
import { requireRole } from './authorization';

/**
 * Recherche transverse depuis la barre du header : élèves, classes et
 * enseignants de l'établissement courant. Chaque catégorie est plafonnée et
 * n'est interrogée que si le rôle y a accès, de sorte qu'un Comptable ne
 * découvre pas le trombinoscope des enseignants par le champ de recherche.
 */

export type CategorieResultat = 'eleve' | 'classe' | 'enseignant';

export interface ResultatRecherche {
  categorie: CategorieResultat;
  id: string;
  libelle: string;
  detail: string | null;
  href: string;
}

const LIMITE_PAR_CATEGORIE = 5;
/** En deçà, la recherche renverrait la moitié de l'établissement. */
const LONGUEUR_MINIMALE = 2;

/** Échappe les jokers PostgREST pour que la saisie reste un texte, pas un motif. */
function motif(terme: string): string {
  return `%${terme.replace(/[%_,()]/g, ' ').trim()}%`;
}

export async function rechercheGlobale(terme: string): Promise<ResultatRecherche[]> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');
  const recherche = terme.trim();
  if (recherche.length < LONGUEUR_MINIMALE) return [];

  const supabase = createClient();
  const filtre = motif(recherche);
  const resultats: ResultatRecherche[] = [];

  const { data: eleves } = await supabase
    .from('eleve')
    .select('id, matricule, nom, prenoms')
    .eq('etablissementId', ctx.etablissementId)
    .or(`nom.ilike.${filtre},prenoms.ilike.${filtre},matricule.ilike.${filtre}`)
    .limit(LIMITE_PAR_CATEGORIE);

  for (const eleve of (eleves ?? []) as {
    id: string;
    matricule: string;
    nom: string;
    prenoms: string;
  }[]) {
    resultats.push({
      categorie: 'eleve',
      id: eleve.id,
      libelle: `${eleve.nom} ${eleve.prenoms}`,
      detail: eleve.matricule,
      href: `/etablissement/eleves/${eleve.id}`,
    });
  }

  if (ctx.role !== 'ENSEIGNANT') {
    const { data: classes } = await supabase
      .from('classe')
      .select('id, nom')
      .eq('etablissementId', ctx.etablissementId)
      .ilike('nom', filtre)
      .limit(LIMITE_PAR_CATEGORIE);

    for (const classe of (classes ?? []) as { id: string; nom: string }[]) {
      resultats.push({
        categorie: 'classe',
        id: classe.id,
        libelle: classe.nom,
        detail: null,
        href: `/etablissement/classes/${classe.id}`,
      });
    }
  }

  if (ctx.role === 'DIRECTEUR' || ctx.role === 'SECRETAIRE') {
    const { data: enseignants } = await supabase
      .from('enseignant')
      .select('id, nom, prenoms')
      .eq('etablissementId', ctx.etablissementId)
      .or(`nom.ilike.${filtre},prenoms.ilike.${filtre}`)
      .limit(LIMITE_PAR_CATEGORIE);

    for (const enseignant of (enseignants ?? []) as {
      id: string;
      nom: string;
      prenoms: string;
    }[]) {
      resultats.push({
        categorie: 'enseignant',
        id: enseignant.id,
        libelle: `${enseignant.nom} ${enseignant.prenoms}`,
        detail: null,
        href: `/etablissement/enseignants/${enseignant.id}`,
      });
    }
  }

  return resultats;
}
