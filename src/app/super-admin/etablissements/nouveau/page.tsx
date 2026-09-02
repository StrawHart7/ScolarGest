'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LienRetour } from '@/components/layout/LienRetour';
import { creerEtablissementEtDirecteur } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Création...' : "Créer l'établissement"}
    </Button>
  );
}

export default function NouvelEtablissementPage() {
  const [error, formAction] = useFormState(creerEtablissementEtDirecteur, null);

  return (
    <main className="mx-auto max-w-2xl px-gutter py-gutter sm:p-container-pad">
      <LienRetour href="/super-admin/etablissements" className="mb-4">
        Retour aux établissements
      </LienRetour>
      <h1 className="mb-6 text-display-sm text-text-primary">Nouvel établissement</h1>

      <form action={formAction} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Établissement</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" name="nom" required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ville">Ville</Label>
                <Input id="ville" name="ville" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input id="telephone" name="telephone" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emailEtablissement">Email de l&apos;établissement</Label>
              <Input id="emailEtablissement" name="emailEtablissement" type="email" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compte Directeur</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="directeurPrenom">Prénom</Label>
                <Input id="directeurPrenom" name="directeurPrenom" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="directeurNom">Nom</Label>
                <Input id="directeurNom" name="directeurNom" required />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="directeurEmail">Email</Label>
              <Input id="directeurEmail" name="directeurEmail" type="email" required />
              <p className="text-body-sm text-text-secondary">
                Une invitation sera envoyée à cette adresse pour activer le compte.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-body-sm text-error">{error}</p>}
        <SubmitButton />
      </form>
    </main>
  );
}
