-- Le piege : `revoke execute ... from anon, authenticated` ne retire rien
-- quand personne n'a jamais octroye a ces roles.
--
-- Postgres donne `EXECUTE` a **PUBLIC** sur toute fonction nouvellement creee.
-- `anon` et `authenticated` en heritent sans figurer nulle part dans `proacl`,
-- ou l'octroi s'ecrit `=X/postgres` — grantee vide, c'est-a-dire PUBLIC. Une
-- revocation nominative passe donc a cote et **ne produit aucune erreur** :
-- elle a l'air d'avoir fonctionne.
--
-- Constate le 2026-09-17 sur `fn_borner_demande_demo`, creee le matin meme
-- avec sa revocation : l'avertissement de Supabase est revenu sur la fonction
-- que je venais d'ecrire pour fermer une surface. C'est ce retour qui a revele
-- que les autres revocations de la journee n'avaient marche que parce que ces
-- fonctions-la portaient, elles, des octrois explicites.
--
-- **Toute migration qui cree une fonction doit donc revoquer a `public`**, et
-- reoctroyer ensuite aux seuls roles qui l'appellent.

revoke execute on function public.fn_borner_demande_demo() from public;

-- `rafraichir_agregats` est `security definer` et recalcule les agregats de la
-- Regie. Le schema `controle` n'est pas expose par PostgREST, donc rien ne
-- l'atteignait — mais une surface qui ne tient que par une configuration
-- exterieure au depot n'est pas une garde. `regie` garde son octroi explicite.
revoke execute on function controle.rafraichir_agregats(boolean) from public;
revoke execute on function controle.fn_chainer_journal() from public;
revoke execute on function controle.fn_journal_immuable() from public;
revoke execute on function controle.meta_sans_contenu(jsonb) from public;

-- `fn_changer_classe_inscription` est `security invoker` — la RLS s'y applique,
-- ce n'etait donc pas une escalade. Mais elle porte deja un octroi explicite a
-- `authenticated`, qui est son appelant reel : l'octroi implicite ne lui
-- ajoutait que `anon`, pour qui chaque appel echouerait de toute facon.
revoke execute on function public.fn_changer_classe_inscription(uuid, uuid, uuid) from public;
