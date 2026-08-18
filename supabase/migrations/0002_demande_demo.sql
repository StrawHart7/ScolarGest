-- Demandes de démo depuis la landing page (formulaire public, pas d'auth requise).
-- Traitées manuellement par le SUPER_ADMIN (pas de self-service, voir analysis.md Q5).

create type statut_demande_demo as enum ('NOUVELLE', 'CONTACTEE', 'CONVERTIE', 'REJETEE');

create table demande_demo (
  id uuid primary key default gen_random_uuid(),
  "nomEtablissement" text not null,
  "nomContact" text not null,
  email text not null,
  telephone text,
  ville text,
  message text,
  statut statut_demande_demo not null default 'NOUVELLE',
  "createdAt" timestamptz not null default now()
);
create index idx_demande_demo_statut on demande_demo(statut);

alter table demande_demo enable row level security;

-- Formulaire public : n'importe qui (y compris anonyme) peut créer une demande.
create policy demande_demo_insert_public on demande_demo for insert
  to anon, authenticated
  with check (true);

-- Seul le SUPER_ADMIN peut lire/traiter les demandes.
create policy demande_demo_read_super_admin on demande_demo for select
  using (is_super_admin());
create policy demande_demo_update_super_admin on demande_demo for update
  using (is_super_admin());
