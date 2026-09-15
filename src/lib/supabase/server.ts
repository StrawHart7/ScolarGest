import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { creerFetchResilient } from './reprise-reseau';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      /**
       * Reprise des lectures transitoires, et corps donné aux réponses muettes.
       *
       * C'est ici que se referme l'incident « Référence 5381 » du 2026-09-15 :
       * une réponse en erreur au corps vide — le cas ordinaire d'un comptage,
       * qui voyage en HEAD — produisait un objet sans message ni pile, et donc
       * un écran d'erreur que rien ne permettait de diagnostiquer. Tout est
       * expliqué dans `reprise-reseau.ts`.
       *
       * `fetch` est lu à l'appel et non capturé à l'import : Next remplace le
       * `fetch` global par le sien, celui qui porte le cache et la
       * revalidation. Le figer priverait chaque requête de ce mécanisme.
       */
      global: { fetch: creerFetchResilient(fetch) },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component — Next.js forbids cookie mutation there.
            // Middleware refreshes the session, so this is safe to ignore.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // See above.
          }
        },
      },
    },
  );
}
