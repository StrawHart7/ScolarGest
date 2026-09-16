import { getTenantContext } from '@/services/tenant';
import { getParametresDocument, chargerLogoDataUri } from '@/services/parametres-document';
import { AppLayout } from '@/components/layout/AppLayout';
import { BarreEtablissement } from '@/components/layout/BarreEtablissement';
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
      {/*
        La rangée de section reste **hors** de la colonne centrée. Deux écrans
        de la section se lisent en `max-w-3xl`, celui-ci et `/abonnement` :
        laisser la rangée dedans la rendait plus courte et décalée du bord ici,
        alors qu'elle borde le contenu partout ailleurs. Un repère qui change de
        place d'un écran à l'autre de la même section cesse d'être un repère —
        c'est la largeur du formulaire qui est particulière, pas la barre.

        `mb-4 md:mb-6` plutôt qu'un conteneur en `space-y-*` : l'écart est le
        même, et la colonne centrée n'a pas à être réindentée pour y entrer.
      */}
      <div className="mb-4 md:mb-6">
        <BarreEtablissement role={ctx.role} actif="/etablissement/documents" />
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
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
