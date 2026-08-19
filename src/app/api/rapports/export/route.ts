import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { construireRapport, definitionRapport, type TypeRapport } from '@/services/rapport';
import { getEtablissement } from '@/services/etablissement';
import { getTenantContext } from '@/services/tenant';
import { auditLog } from '@/services/audit';
import { renderHtmlToPdf } from '@/lib/pdf/render';
import { nomFichier, versCsv, versHtml, versXlsx } from '@/lib/export/rapport';

/**
 * Téléchargement d'un rapport dans l'un des trois formats du doc 09 §9.
 *
 * Route Handler plutôt que Server Action : une Server Action renvoie une
 * valeur sérialisée à React, pas un fichier avec ses en-têtes. Ici le
 * navigateur reçoit directement un `Content-Disposition: attachment`, ce qui
 * évite de faire transiter un binaire encodé en base64 dans le payload RSC.
 *
 * Le contrôle d'accès n'est pas dupliqué : `construireRapport` applique la
 * matrice de rôles et lève si l'appelant n'y a pas droit.
 */
const parametresSchema = z.object({
  type: z.enum(['ELEVES', 'ENSEIGNANTS', 'EFFECTIFS', 'PAIEMENTS', 'RESULTATS']),
  format: z.enum(['xlsx', 'csv', 'pdf']),
  anneeScolaireId: z.string().uuid(),
  classeId: z.string().uuid().optional(),
  periode: z.enum(['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3']).optional(),
});

const TYPES_MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
} as const;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = parametresSchema.safeParse({
    type: params.get('type'),
    format: params.get('format'),
    anneeScolaireId: params.get('anneeScolaireId'),
    classeId: params.get('classeId') || undefined,
    periode: params.get('periode') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Paramètres invalides' },
      { status: 400 },
    );
  }

  const { type, format, ...parametres } = parsed.data;
  const definition = definitionRapport(type as TypeRapport);
  if (definition.exigeClasse && !parametres.classeId) {
    return NextResponse.json({ error: 'Ce rapport exige une classe.' }, { status: 400 });
  }
  if (definition.exigePeriode && !parametres.periode) {
    return NextResponse.json({ error: 'Ce rapport exige un trimestre.' }, { status: 400 });
  }

  try {
    const ctx = await getTenantContext();
    const rapport = await construireRapport(type as TypeRapport, parametres);

    let corps: Buffer | string;
    if (format === 'csv') {
      corps = versCsv(rapport);
    } else if (format === 'xlsx') {
      corps = versXlsx(rapport);
    } else {
      const etablissement = ctx.etablissementId
        ? await getEtablissement(ctx.etablissementId)
        : null;
      corps = await renderHtmlToPdf(
        versHtml(rapport, {
          etablissement: etablissement?.nom ?? 'ScolarGest',
          genereLe: new Date().toLocaleString('fr-FR'),
        }),
      );
    }

    await auditLog({
      action: 'EXPORTER_RAPPORT',
      module: 'rapports',
      objetType: 'Rapport',
      objetId: type,
      nouvelleValeur: { format, ...parametres, lignes: rapport.lignes.length },
    });

    return new NextResponse(corps as BodyInit, {
      status: 200,
      headers: {
        'content-type': TYPES_MIME[format],
        'content-disposition': `attachment; filename="${nomFichier(rapport, format)}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur lors de l'export";
    const refus = message.startsWith('Accès refusé');
    return NextResponse.json({ error: message }, { status: refus ? 403 : 500 });
  }
}
