-- Piece jointe sur une demande de support.
--
-- Cas d'usage qui la motive : une ecole depose un fichier d'import dont les
-- colonnes ne correspondent pas au gabarit. Lui demander de decrire son
-- en-tete par ecrit ne marche pas — c'est precisement ce qu'elle n'arrive pas
-- a lire. Le fichier doit parvenir au support tel quel, pour qu'il remette les
-- colonnes en forme et le renvoie.
--
-- Une seule piece jointe, pas une collection. Une table dediee permettrait n
-- fichiers par demande, mais le besoin est « le fichier qui pose probleme »,
-- au singulier. Une colonne se transforme en table le jour ou le besoin
-- change ; l'inverse ne se fait pas.

alter table support_demande
  add column "fichierChemin" text,
  add column "fichierNom" text;

comment on column support_demande."fichierChemin" is
  'Chemin dans le bucket `support`, prefixe par etablissementId. Null si aucune piece jointe.';
comment on column support_demande."fichierNom" is
  'Nom d''origine du fichier, tel que l''ecole l''a envoye. Le chemin de stockage est
   randomise ; sans ce champ le support ne saurait plus de quel fichier il s''agit.';

-- Bucket prive. Meme parti que `documents` (migration 0007) : tout acces passe
-- par le serveur, jamais par une URL exposee au navigateur.
insert into storage.buckets (id, name, public)
values ('support', 'support', false)
on conflict (id) do nothing;

-- Lecture : son propre etablissement, ou tout pour le SUPER_ADMIN. Le prefixe
-- de dossier porte l'etablissementId, comme pour `documents`.
drop policy if exists support_tenant_select on storage.objects;
create policy support_tenant_select on storage.objects for select
  using (
    bucket_id = 'support'
    and (
      is_super_admin()
      or (storage.foldername(name))[1] = auth_etablissement_id()::text
    )
  );

-- Ecriture reservee au service-role : le depot se fait depuis une Server Action
-- gardee, qui construit elle-meme le chemin. Laisser le tenant ecrire
-- directement dans le bucket lui permettrait de choisir son prefixe, donc
-- d'ecrire sous le dossier d'une autre ecole.
drop policy if exists support_service_role_all on storage.objects;
create policy support_service_role_all on storage.objects for all
  using (bucket_id = 'support' and auth.role() = 'service_role')
  with check (bucket_id = 'support' and auth.role() = 'service_role');
