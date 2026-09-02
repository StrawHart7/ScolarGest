import { getTenantContext } from '@/services/tenant';
import { getParametresDocument, chargerLogoDataUri } from '@/services/parametres-document';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { ParametresDocumentForm } from './ParametresDocumentForm';

export const metadata = { title: 'Identité des documents' };

export default async function ParametresDocumentPage() {
  const ctx = await getTenantContext();

  // L'écriture est réservée au Directeur (`enregistrerParametresDocument`,
  // `televerserLogo`) : inutile de présenter un formulaire que les autres
  // rôles ne pourraient pas soumettre.
  if (ctx.role !== 'DIRECTEUR' && ctx.role !== 'SUPER_ADMIN') {
    return (
      <AppLayout
        items={getSidebarItems(ctx.role)}
        schoolName="ScolarGest"
        role={ctx.role}
        userName={ctx.email}
      >
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-body-sm text-text-secondary">
              Seule la direction peut modifier l&apos;identité visuelle des documents.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const parametres = await getParametresDocument();
  const logoApercu = await chargerLogoDataUri(parametres.logoChemin);

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <LienRetour href="/etablissement">Retour à l&apos;établissement</LienRetour>

        <div>
          <h1 className="text-display-sm text-text-primary">Identité des documents</h1>
          <p className="text-body-md text-text-secondary">
            Logo et filigrane appliqués aux bulletins et aux reçus que vous générez.
          </p>
        </div>

        <ParametresDocumentForm
          filigraneTexteInitial={parametres.filigraneTexte}
          filigraneActifInitial={parametres.filigraneActif}
          logoApercu={logoApercu}
        />
      </div>
    </AppLayout>
  );
}
