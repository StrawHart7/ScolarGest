'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { archiverEleve } from '@/services/eleve';
import { annulerInscription } from '@/services/inscription';
import { linkResponsableEleve, updateResponsable } from '@/services/responsable';

const idSchema = z.string().uuid();

export async function archiverEleveAction(eleveId: string): Promise<string | null> {
  const parsed = idSchema.safeParse(eleveId);
  if (!parsed.success) return 'Identifiant invalide';
  try {
    await archiverEleve(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'archivage";
  }
  revalidatePath(`/etablissement/eleves/${eleveId}`);
  return null;
}

export async function annulerInscriptionAction(
  eleveId: string,
  inscriptionId: string,
): Promise<string | null> {
  const parsed = idSchema.safeParse(inscriptionId);
  if (!parsed.success) return 'Identifiant invalide';
  try {
    await annulerInscription(parsed.data);
  } catch (e) {
    return e instanceof Error ? e.message : "Erreur lors de l'annulation";
  }
  revalidatePath(`/etablissement/eleves/${eleveId}`);
  return null;
}

const responsableSchema = z.object({
  nom: z.string().min(1, 'Nom requis'),
  prenoms: z.string().min(1, 'Prénoms requis'),
  telephone: z.string().optional(),
  email: z.string().email('Adresse e-mail invalide').optional().or(z.literal('')),
  adresse: z.string().optional(),
  profession: z.string().optional(),
  type: z.enum(['PERE', 'MERE', 'TUTEUR', 'AUTRE']),
});

/**
 * La section « Responsables légaux » était en lecture seule : une erreur de
 * numéro de téléphone saisie à l'inscription ne pouvait plus être corrigée,
 * alors que c'est le seul canal de contact de l'école avec la famille.
 */
export async function modifierResponsableAction(
  _etatPrecedent: string | null,
  donnees: FormData,
): Promise<string | null> {
  const responsableId = String(donnees.get('responsableId') ?? '');
  if (!responsableId) return 'Responsable introuvable.';

  const parsed = responsableSchema.safeParse({
    nom: donnees.get('nom'),
    prenoms: donnees.get('prenoms'),
    telephone: donnees.get('telephone') ?? undefined,
    email: donnees.get('email') ?? undefined,
    adresse: donnees.get('adresse') ?? undefined,
    profession: donnees.get('profession') ?? undefined,
    type: donnees.get('type'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await updateResponsable(responsableId, {
      nom: parsed.data.nom,
      prenoms: parsed.data.prenoms,
      telephone: parsed.data.telephone || null,
      email: parsed.data.email || null,
      adresse: parsed.data.adresse || null,
      profession: parsed.data.profession || null,
      type: parsed.data.type,
    });
  } catch (erreur) {
    return erreur instanceof Error ? erreur.message : 'Erreur lors de la modification';
  }

  revalidatePath(`/etablissement/eleves/${String(donnees.get('eleveId') ?? '')}`);
  return 'OK';
}

export async function ajouterResponsableAction(
  _etatPrecedent: string | null,
  donnees: FormData,
): Promise<string | null> {
  const eleveId = String(donnees.get('eleveId') ?? '');
  const lienParente = String(donnees.get('lienParente') ?? '').trim();
  if (!eleveId) return 'Élève introuvable.';
  if (!lienParente) return 'Lien de parenté requis.';

  const parsed = responsableSchema.safeParse({
    nom: donnees.get('nom'),
    prenoms: donnees.get('prenoms'),
    telephone: donnees.get('telephone') ?? undefined,
    email: donnees.get('email') ?? undefined,
    adresse: donnees.get('adresse') ?? undefined,
    profession: donnees.get('profession') ?? undefined,
    type: donnees.get('type'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Formulaire invalide';
  }

  try {
    await linkResponsableEleve(eleveId, {
      nom: parsed.data.nom,
      prenoms: parsed.data.prenoms,
      telephone: parsed.data.telephone || undefined,
      email: parsed.data.email || undefined,
      adresse: parsed.data.adresse || undefined,
      profession: parsed.data.profession || undefined,
      type: parsed.data.type,
      lienParente,
      principal: donnees.get('principal') === 'on',
    });
  } catch (erreur) {
    return erreur instanceof Error ? erreur.message : "Erreur lors de l'ajout du responsable";
  }

  revalidatePath(`/etablissement/eleves/${eleveId}`);
  return 'OK';
}
