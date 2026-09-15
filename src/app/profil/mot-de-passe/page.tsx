import { KeyRound } from 'lucide-react';
import { getTenantContext } from '@/services/tenant';
import { getMonProfil, CLAIM_MOT_DE_PASSE_PROVISOIRE } from '@/services/utilisateur';
import { createClient } from '@/lib/supabase/server';
import { AppLayout } from '@/components/layout/AppLayout';
import { LienRetour } from '@/components/layout/LienRetour';
import { Card, CardContent } from '@/components/ui/card';
import { getSidebarItems } from '@/lib/navigation';
import { estCompteSansEmail, identifiantAffiche } from '@/lib/identifiants';
import { FormulaireMotDePasse } from './FormulaireMotDePasse';
import { DeconnexionButton } from '../parametres/DeconnexionButton';

/**
 * Le seul écran qui permet de changer son mot de passe sans passer par un
 * courrier électronique — donc le seul praticable pour un compte ouvert par
 * identifiant.
 *
 * Il sert aussi de **passage obligé** : un compte dont le mot de passe a été
 * tiré par la plateforme y est renvoyé par le middleware tant qu'il ne l'a pas
 * changé. D'où le bouton de déconnexion sur la page : sans lui, quelqu'un qui
 * ne veut pas changer son mot de passe tout de suite n'aurait aucun moyen de
 * sortir, la navigation étant fermée.
 */
export default async function MotDePassePage() {
  const ctx = await getTenantContext();
  const profil = await getMonProfil();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const impose = Boolean(
    (user?.app_metadata as Record<string, unknown> | undefined)?.[
      CLAIM_MOT_DE_PASSE_PROVISOIRE
    ],
  );

  return (
    <AppLayout
      items={getSidebarItems(ctx.role)}
      schoolName="ScolarGest"
      role={ctx.role}
      userName={ctx.email}
    >
      <div className="mx-auto max-w-lg space-y-6">
        {!impose && <LienRetour href="/profil">Retour au profil</LienRetour>}

        <div>
          <h1 className="text-display-sm text-text-primary">
            {impose ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe'}
          </h1>
          <p className="text-body-sm text-text-secondary">
            {impose
              ? 'Celui qu’on vous a remis a été écrit sur un papier et lu par quelqu’un d’autre. Choisissez-en un que vous seul connaissez, et dont vous vous souviendrez.'
              : 'Il prend effet immédiatement, sur tous vos appareils.'}
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 py-6">
            <div className="flex items-center gap-3 border-b border-surface-border pb-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-fixed text-primary-container">
                <KeyRound className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-body-md text-text-primary">
                  {profil.prenom} {profil.nom}
                </p>
                <p className="truncate text-body-sm text-text-secondary">
                  {estCompteSansEmail(profil.email)
                    ? `Identifiant : ${identifiantAffiche(profil.email)}`
                    : profil.email}
                </p>
              </div>
            </div>

            <FormulaireMotDePasse impose={impose} />
          </CardContent>
        </Card>

        {impose && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-container-lowest px-5 py-4">
            <p className="text-body-sm text-text-secondary">
              Vous préférez le faire plus tard ? Vous devrez repasser par ici à la prochaine
              connexion.
            </p>
            <DeconnexionButton />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
