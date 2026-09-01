import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getClasse } from '@/services/classe';
import { listCreneauxClasse } from '@/services/emploi-du-temps';
import { listAnneesScolaires } from '@/services/annee-scolaire';
import { getEtablissement } from '@/services/etablissement';
import { getParametresDocument, chargerLogoDataUri } from '@/services/parametres-document';
import { getTenantContext } from '@/services/tenant';
import { auditLog } from '@/services/audit';
import { renderHtmlToPdf } from '@/lib/pdf/render';
import { emploiDuTempsHtml } from '@/lib/pdf/templates/emploi-du-temps';

/**
 * Téléchargement de l'emploi du temps d'une classe en PDF.
 *
 * Route Handler et non Server Action, pour la même raison que l'export des
 * rapports : une Server Action renvoie une valeur sérialisée à React, pas un
 * fichier avec son `Content-Disposition`.
 *
 * Aucun contrôle d'accès n'est réécrit ici — `getClasse` et
 * `listCreneauxClasse` portent leurs gardes et comparent l'établissement au
 * contexte de l'appelant. Un identifiant de classe forgé ne sort donc pas du
 * tenant.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCHEMA = z.object({ classeId: z.string().uuid() });

export async function GET(request: NextRequest) {
  const parsed = SCHEMA.safeParse({
    classeId: request.nextUrl.searchParams.get('classeId'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Classe invalide.' }, { status: 400 });
  }

  try {
    const ctx = await getTenantContext();
    const classe = await getClasse(parsed.data.classeId);
    const [creneaux, annees, etablissement] = await Promise.all([
      listCreneauxClasse(classe.id, classe.anneeScolaireId),
      listAnneesScolaires(),
      ctx.etablissementId ? getEtablissement(ctx.etablissementId) : Promise.resolve(null),
    ]);

    // Le filigrane et le logo sont facultatifs : un incident sur les
    // paramètres de document ne doit pas empêcher d'imprimer un emploi du
    // temps, qui n'est pas une pièce officielle.
    let identite;
    try {
      const parametres = await getParametresDocument();
      identite = {
        logoDataUri: await chargerLogoDataUri(parametres.logoChemin),
        filigraneTexte: parametres.filigraneActif ? parametres.filigraneTexte : null,
      };
    } catch {
      identite = undefined;
    }

    const annee = annees.find((a) => a.id === classe.anneeScolaireId);

    const pdf = await renderHtmlToPdf(
      emploiDuTempsHtml({
        etablissement: etablissement?.nom ?? 'ScolarGest',
        classe: classe.nom,
        niveau: classe.serie?.nom
          ? `${classe.niveau.nom} — Série ${classe.serie.nom}`
          : classe.niveau.nom,
        anneeScolaire: annee?.libelle ?? '',
        creneaux,
        identite,
      }),
    );

    await auditLog({
      action: 'EXPORTER_EMPLOI_DU_TEMPS',
      module: 'academique',
      objetType: 'Classe',
      objetId: classe.id,
      nouvelleValeur: { creneaux: creneaux.length },
    });

    // Nom de fichier assaini : le nom de classe est saisi librement et
    // pourrait porter un guillemet, qui casserait l'en-tête.
    const nom = `emploi-du-temps-${classe.nom}`.replace(/[^a-zA-Z0-9-_]+/g, '-');

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${nom}.pdf"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur lors de l'export.";
    const refus = message.startsWith('Accès refusé');
    return NextResponse.json({ error: message }, { status: refus ? 403 : 500 });
  }
}
