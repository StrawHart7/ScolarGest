import { NextResponse } from 'next/server';
import { rechercheGlobale } from '@/services/recherche-globale';

export const dynamic = 'force-dynamic';

/** Alimente la barre de recherche du header (voir `RechercheGlobale.tsx`). */
export async function GET(requete: Request) {
  const terme = new URL(requete.url).searchParams.get('q') ?? '';
  try {
    return NextResponse.json(await rechercheGlobale(terme));
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : 'Recherche indisponible';
    const statut = message.startsWith('Accès refusé') ? 403 : message === 'Non authentifié' ? 401 : 500;
    return NextResponse.json({ message }, { status: statut });
  }
}
