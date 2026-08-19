-- Phase 5 — bucket Supabase Storage pour les documents générés (bulletins,
-- reçus). Bucket privé: tout accès passe par le service-role côté serveur
-- (createAdminClient(), voir src/lib/supabase/admin.ts) — jamais exposé au
-- navigateur. Le chemin de stockage reste scopé par établissement
-- ({etablissementId}/bulletins/{reference}.pdf, {etablissementId}/recus/...)
-- même si le bucket est privé, pour cohérence défense-en-profondeur avec le
-- reste du repo (RLS + etablissementId explicite partout).
--
-- Idempotent (on conflict do nothing) — écrite mais NON appliquée en Phase 5
-- (pas de `supabase db push` exécuté contre un environnement distant).

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- RLS sur storage.objects: le bucket est privé par défaut (public = false),
-- mais storage.objects a RLS activé globalement par Supabase — il faut des
-- policies explicites pour permettre au service-role de lire/écrire (le
-- service-role bypass RLS de toute façon, ces policies sécurisent un accès
-- direct éventuel via un client authentifié scoped-tenant, cohérent avec le
-- reste du schéma qui garde une défense en profondeur même quand une route
-- applicative passe déjà par le service-role).

drop policy if exists documents_tenant_select on storage.objects;
create policy documents_tenant_select on storage.objects for select
  using (
    bucket_id = 'documents'
    and (
      is_super_admin()
      or (storage.foldername(name))[1] = auth_etablissement_id()::text
    )
  );

drop policy if exists documents_service_role_all on storage.objects;
create policy documents_service_role_all on storage.objects for all
  using (bucket_id = 'documents' and auth.role() = 'service_role')
  with check (bucket_id = 'documents' and auth.role() = 'service_role');
