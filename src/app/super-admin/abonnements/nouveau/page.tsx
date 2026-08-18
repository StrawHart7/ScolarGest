import { listEtablissements } from '@/services/etablissement';
import { listPlans } from '@/services/abonnement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AbonnementForm } from './AbonnementForm';

export default async function NouvelAbonnementPage() {
  const [etablissements, plans] = await Promise.all([listEtablissements(), listPlans()]);

  return (
    <main className="mx-auto max-w-xl p-container-pad">
      <h1 className="mb-6 text-display-sm text-text-primary">Nouvel abonnement</h1>

      <Card>
        <CardHeader>
          <CardTitle>Détails</CardTitle>
        </CardHeader>
        <CardContent>
          <AbonnementForm etablissements={etablissements} plans={plans} />
        </CardContent>
      </Card>
    </main>
  );
}
