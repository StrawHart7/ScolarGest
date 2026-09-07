-- Une demande de support ne se lit que par son auteur.
--
-- Nommee au format horodate, comme toutes les migrations depuis
-- `20260902130110` : la numerotation `00NN` s'est arretee a `0024`, et un
-- `0026` se serait classe *avant* les migrations deja appliquees — la CLI
-- Supabase compare les versions lexicographiquement.
--
-- La policy de `0023` ouvrait la lecture a tout l'etablissement, au motif
-- qu'un collegue verrait qu'une question a deja ete posee et eviterait le
-- doublon. Le calcul etait mauvais : une demande raconte un blocage, parfois
-- nominatif — un compte suspendu, une erreur de saisie, un differend sur une
-- facture — et la savoir lisible par toute l'ecole dissuade d'ecrire. Un
-- doublon coute au support ; une confidence lue par un collegue coute a
-- l'utilisateur.
--
-- Le service filtre deja (`listMesDemandesSupport`). Cette migration ferme le
-- meme acces au niveau de la base, parce que la cle anon est publique : la RLS
-- est la seule barriere qui tienne si un jour une lecture passe a cote du
-- service. C'est la regle habituelle du depot — s'appuyer sur la seule RLS ne
-- suffit pas, mais l'inverse non plus.

-- `auteurId` est le `sub` du jeton : `utilisateur.id` est provisionne avec
-- l'identifiant Auth, sans valeur par defaut (voir `0001`). `auth.uid()` et
-- `auteurId` designent donc bien la meme personne.
--
-- La comparaison d'etablissement reste, en plus de celle d'auteur. `auteurId`
-- est nullable : une ligne dont l'auteur aurait ete efface ne redeviendra pas
-- lisible par le reste de l'ecole — elle deviendra illisible, ce qui est le
-- bon sens du repli. Et un compte qui change d'etablissement n'emporte pas
-- avec lui l'historique de l'ancien.
drop policy if exists support_demande_select on support_demande;
create policy support_demande_select on support_demande for select
  using (
    is_super_admin()
    or (
      "etablissementId" = auth_etablissement_id()
      and "auteurId" = auth.uid()
    )
  );

-- L'insertion fige l'auteur sur le porteur du jeton. Sans ce test, une ecole
-- pouvait deposer une demande au nom d'un collegue : elle ne la relirait pas
-- elle-meme, mais le support recevrait une demande signee de quelqu'un qui ne
-- l'a pas ecrite — et l'identite figee de `0023` ne vaudrait plus rien.
drop policy if exists support_demande_insert_tenant on support_demande;
create policy support_demande_insert_tenant on support_demande for insert
  to authenticated
  with check (
    "etablissementId" = auth_etablissement_id()
    and "auteurId" = auth.uid()
  );

-- Le bucket `support` repasse en service-role seul.
--
-- La policy de lecture de `0024` portait sur le prefixe d'etablissement : elle
-- laissait n'importe quel compte de l'ecole telecharger la piece jointe d'un
-- collegue — le plus souvent un fichier d'import, c'est-a-dire une liste
-- d'eleves. Restreindre l'ecran sans fermer le bucket n'aurait ete que
-- cosmetique.
--
-- Rien ne la reclamait : la piece jointe n'est jamais servie au navigateur
-- directement, elle passe par une URL signee emise cote serveur
-- (`getLienPieceJointe`), qui s'appuie sur la cle service-role et verifie
-- elle-meme que l'appelant est l'auteur de la demande.
drop policy if exists support_tenant_select on storage.objects;
