-- Deux branches de politique sur `utilisateur` que rien n'emprunte.
--
-- **Personne ne supprime un compte.** `desactiverUtilisateur` bannit le compte
-- Auth et bascule le statut ; il n'existe aucun `delete` sur `utilisateur`
-- dans tout `src/` — verifie avant de retirer, pas suppose. La politique
-- laissait pourtant chacun effacer sa propre ligne. C'est du pur cote
-- perdant : le compte Auth survit, donc le jeton reste valide et son porteur
-- se promene sans ligne d'utilisateur, tandis que le journal d'audit garde des
-- references vers un compte que la console n'affiche plus.
--
-- **Personne ne s'insere soi-meme.** Les deux seules insertions du depot —
-- `inviteUtilisateur` et `creerCompteSansEmail` — sont faites par le
-- SUPER_ADMIN ou le Directeur, et posent l'identifiant de l'**invite**, jamais
-- le leur. La branche `id = auth.uid()` n'a donc jamais servi a rien, et elle
-- permettait a un compte de se recreer une ligne apres l'avoir effacee — avec
-- le role de son choix, puisque `fn_proteger_champs_utilisateur` ne se
-- declenche qu'a l'UPDATE.
--
-- Ce n'etait pas une escalade, et il faut le dire clairement :
-- `getTenantContext` lit `app_metadata` du jeton verifie et ne regarde jamais
-- cette colonne. C'etait une corruption de donnee, qu'on decouvrirait dans la
-- console des utilisateurs sans savoir d'ou elle vient.
--
-- La modification garde `id = auth.uid()` : elle, elle sert — chacun met a
-- jour son propre profil.

drop policy if exists utilisateur_suppression on public.utilisateur;

create policy utilisateur_suppression on public.utilisateur for delete
  using (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id() and auth_role() = 'DIRECTEUR')
  );

drop policy if exists utilisateur_insertion on public.utilisateur;

create policy utilisateur_insertion on public.utilisateur for insert
  with check (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id() and auth_role() = 'DIRECTEUR')
  );
