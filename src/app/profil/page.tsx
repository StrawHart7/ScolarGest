import { UserRound } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getMonProfil } from '@/services/utilisateur';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSidebarItems } from '@/lib/navigation';
import { PinForm } from './PinForm';

export default async function ProfilPage() {
  const ctx = await getTenantContext();
  const profil = await getMonProfil();
  const peutDefinirPin = profil.role === 'DIRECTEUR' || profil.role === 'SECRETAIRE';

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-display-sm text-text-primary">Mon profil</h1>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-on">
              <UserRound className="h-7 w-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-headline-sm text-text-primary">
                {profil.prenom} {profil.nom}
              </p>
              <p className="truncate text-body-sm text-text-secondary">{profil.email}</p>
            </div>
            <Badge variant="primary" className="ml-auto">
              {profil.role}
            </Badge>
          </CardContent>
        </Card>

        {peutDefinirPin && <PinForm pinConfigure={profil.pinConfigure} />}
      </div>
    </AppLayout>
  );
}
