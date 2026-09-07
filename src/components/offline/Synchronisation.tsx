import { getTenantContext } from '@/services/tenant';
import { SynchronisationProvider } from './synchronisation-context';

/**
 * Enveloppe serveur du moteur de synchronisation.
 *
 * Elle existe pour une seule raison : le fournisseur a besoin de l'identifiant
 * de l'utilisateur et de son etablissement, et un composant client ne peut pas
 * lire le contexte tenant. Passer ces deux valeurs en props depuis chaque page
 * aurait exige de toucher une quarantaine de fichiers, et la premiere page
 * oubliee aurait perdu sa file sans que rien ne le signale.
 *
 * Montee dans `AppLayout`, donc sur toute l'application authentifiee — jamais
 * sur `/login` ni sur la landing, qui n'ont rien a synchroniser.
 */
export async function Synchronisation({
  cheminsAPrecharger,
  children,
}: {
  cheminsAPrecharger?: string[];
  children: React.ReactNode;
}) {
  let userId = '';
  let etablissementId = '';
  try {
    const ctx = await getTenantContext();
    userId = ctx.userId;
    etablissementId = ctx.etablissementId;
  } catch {
    // Session illisible : on rend les enfants sans file plutot que de faire
    // tomber toute la page. `useSynchronisation` repond alors `null`, et les
    // ecrans retombent sur l'envoi direct.
  }

  if (!userId) return <>{children}</>;

  return (
    <SynchronisationProvider
      userId={userId}
      etablissementId={etablissementId}
      cheminsAPrecharger={cheminsAPrecharger}
    >
      {children}
    </SynchronisationProvider>
  );
}
