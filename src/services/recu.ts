import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from './authorization';
import { auditLog } from './audit';
import { getPaiementDetail } from './paiement';
import { getEtablissement } from './etablissement';
import { generateNumeroDocument } from './document-numero';
import { enregistrerDocument, type Document } from './document';
import { renderHtmlToPdf } from '@/lib/pdf/render';
import { renderRecuHtml } from '@/lib/pdf/templates/recu';
import { getParametresDocument, chargerLogoDataUri } from './parametres-document';

const BUCKET = 'documents';

/**
 * Génère le reçu PDF d'un paiement déjà existant en base, l'archive dans
 * Supabase Storage, enregistre l'entité Document et journalise l'audit.
 * Pas d'écran de saisie de paiement en Phase 5 (réservé Phase 6) — cette
 * fonction est prête à être appelée depuis là sans reprise: même pipeline
 * que `genererBulletin` (numérotation REC-..., storage, document, audit).
 */
export async function genererRecuPaiement(paiementId: string): Promise<Document> {
  const ctx = await requireRole('DIRECTEUR', 'SECRETAIRE', 'COMPTABLE');

  const paiement = await getPaiementDetail(paiementId);
  const etablissement = await getEtablissement(paiement.etablissementId);

  // Numéroté sous l'année scolaire courante du paiement — on retrouve
  // l'anneeScolaireId via la facture (déjà résolu dans getPaiementDetail
  // indirectement, mais non exposé: on le redemande ici pour éviter de
  // modifier la forme de PaiementDetail et son usage ailleurs).
  const reference = await generateNumeroDocument('RECU', await resolveAnneeScolaireId(paiement.factureId));

  const parametres = await getParametresDocument();
  const identite = {
    logoDataUri: await chargerLogoDataUri(parametres.logoChemin),
    filigraneTexte: parametres.filigraneActif ? parametres.filigraneTexte : null,
  };

  const html = renderRecuHtml({
    identite,
    etablissement: {
      nom: etablissement.nom,
      adresse: etablissement.adresse,
      ville: etablissement.ville,
      telephone: etablissement.telephone,
      email: etablissement.email,
    },
    reference,
    dateGeneration: new Date().toISOString(),
    eleve: paiement.eleve,
    classeNom: paiement.classeNom,
    responsablePrincipal: paiement.responsablePrincipal,
    paiement: {
      montant: paiement.montant,
      datePaiement: paiement.datePaiement,
      modePaiement: paiement.modePaiement,
      reference: paiement.reference,
    },
  });

  const pdf = await renderHtmlToPdf(html);

  const chemin = `${ctx.etablissementId}/recus/${reference}.pdf`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(chemin, pdf, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) throw new Error(`Échec de l'upload du reçu: ${error.message}`);

  const document = await enregistrerDocument({
    type: 'RECU',
    reference,
    cheminFichier: chemin,
    objetType: 'PAIEMENT',
    objetId: paiementId,
  });

  await auditLog({
    action: 'GENERER_RECU',
    module: 'documents',
    objetType: 'Document',
    objetId: document.id,
    nouvelleValeur: { reference, paiementId },
  });

  return document;
}

async function resolveAnneeScolaireId(factureId: string): Promise<string> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('facture_eleve')
    .select('"anneeScolaireId"')
    .eq('id', factureId)
    .single();
  if (error) throw error;
  return data.anneeScolaireId as string;
}
