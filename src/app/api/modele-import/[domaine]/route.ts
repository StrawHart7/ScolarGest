import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireRole } from '@/services/authorization';
import { MODELES, modeleCoherent, type DomaineImport } from '@/lib/import/modeles';

/**
 * Le classeur modèle, en-têtes et ligne d'exemple.
 *
 * ## Pourquoi une route et non un fichier statique
 *
 * Les colonnes viennent des schémas Zod qui valident l'import
 * (`src/lib/import/*-import-schema.ts`). Un `.xlsx` déposé dans `public/`
 * serait une seconde vérité : le jour où une colonne change, le modèle
 * continuerait de distribuer l'ancienne, et l'école recevrait un fichier que
 * le produit refuse. Ici les deux ne peuvent pas diverger.
 *
 * ## Elle est gardée
 *
 * Aucun secret dans un modèle vide — mais la route ouvre un client Supabase par
 * sa garde, et surtout un point d'API non authentifié est une porte qu'on ne
 * rouvre pas sans raison. Les quatre rôles d'école y ont accès : un Enseignant
 * ne peut pas importer, mais rien ne justifie de lui refuser de regarder à quoi
 * ressemble un fichier.
 */
export async function GET(_requete: Request, { params }: { params: { domaine: string } }) {
  await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE', 'ENSEIGNANT');

  const domaine = params.domaine as DomaineImport;
  const modele = MODELES[domaine];
  if (!modele) {
    return NextResponse.json({ message: 'Modèle inconnu.' }, { status: 404 });
  }
  if (!modeleCoherent(modele)) {
    // Un exemple désaligné produirait un fichier dont la deuxième ligne ne
    // correspond pas aux en-têtes — pire qu'un modèle sans exemple, parce
    // qu'il serait recopié tel quel.
    return NextResponse.json(
      { message: 'Modèle incohérent : la ligne d’exemple ne couvre pas les colonnes.' },
      { status: 500 },
    );
  }

  const entetes = modele.colonnes.map((c) => c.cle);
  const feuille = XLSX.utils.aoa_to_sheet([entetes, modele.exemple]);

  // Une largeur lisible par colonne : un modèle dont les en-têtes sont tronqués
  // se recopie de travers.
  feuille['!cols'] = modele.colonnes.map((c) => ({ wch: Math.max(c.cle.length + 4, 16) }));

  const livre = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livre, feuille, 'Import');
  const contenu = XLSX.write(livre, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${modele.fichier}.xlsx"`,
      // Le modèle suit le schéma : on ne le laisse pas vivre dans un cache
      // pendant qu'une colonne change.
      'Cache-Control': 'no-store',
    },
  });
}
