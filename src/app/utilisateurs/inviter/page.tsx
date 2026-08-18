'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { inviterUtilisateur } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Invitation...' : "Envoyer l'invitation"}
    </Button>
  );
}

export default function InviterUtilisateurPage() {
  const [error, formAction] = useFormState(inviterUtilisateur, null);

  return (
    <main className="mx-auto max-w-xl p-container-pad">
      <h1 className="mb-6 text-display-sm text-text-primary">Inviter un utilisateur</h1>

      <form action={formAction} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Détails</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prenom">Prénom</Label>
                <Input id="prenom" name="prenom" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nom">Nom</Label>
                <Input id="nom" name="nom" required />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Rôle</Label>
              <Select name="role" required defaultValue="SECRETAIRE">
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SECRETAIRE">Secrétaire</SelectItem>
                  <SelectItem value="COMPTABLE">Comptable</SelectItem>
                  <SelectItem value="ENSEIGNANT">Enseignant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-body-sm text-error">{error}</p>}
        <SubmitButton />
      </form>
    </main>
  );
}
