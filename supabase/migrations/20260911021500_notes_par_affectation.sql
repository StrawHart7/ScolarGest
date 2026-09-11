-- Un enseignant n'ecrit que sur ce qu'il enseigne.
--
-- ## Pourquoi le role ne suffisait pas ici
--
-- La politique `note_tenant` etait en `ALL` avec pour seule condition
-- `c."etablissementId" = auth_etablissement_id()`. Aucune mention de
-- l'affectation. N'importe quel enseignant de l'ecole pouvait donc reecrire
-- n'importe quelle note, **y compris `VALIDE`**, par appel direct a PostgREST —
-- en contournant tout le circuit saisie -> soumission -> validation par la
-- Secretaire avec son PIN.
--
-- Et contrairement aux tables d'argent, **un resserrement par role ne fermait
-- rien** : `saisirNote` est reserve a l'ENSEIGNANT, c'est son metier d'ecrire
-- des notes. Une politique « ENSEIGNANT autorise » aurait simplement ecarte le
-- COMPTABLE, qui n'y touchait pas. Le bon axe n'est pas le role, c'est
-- l'affectation.
--
-- ## Ce qui a ete verifie avant d'ecrire cette condition
--
-- Sur les donnees reelles : 113 affectations, **aucune sans annee scolaire**, et
-- **aucune evaluation** dont le triplet (classe, matiere, annee) n'ait au moins
-- une affectation. Le resserrement ne rend donc aucune note existante
-- non saisissable. C'est la verification qui manquait a `20260911005324`, et
-- dont l'absence a casse les encaissements.
--
-- Les 26 enseignants sans `utilisateurId` ne sont pas concernes : sans compte,
-- ils ne sont jamais l'appelant.
--
-- ## Qui garde la main
--
-- DIRECTEUR et SECRETAIRE conservent l'ecriture a l'echelle de l'etablissement :
-- ce sont eux qui font tourner le circuit (`fn_valider_soumission`,
-- `fn_rejeter_soumission`, `approuverModification`), et ils le font sur les
-- classes de toute l'ecole. Le COMPTABLE n'ecrit sur aucune des deux tables.

-- ---------------------------------------------------------------------------
-- Le predicat, nomme une fois plutot que recopie quatre
-- ---------------------------------------------------------------------------
--
-- SECURITY INVOKER deliberement : la fonction lit `affectation_enseignant` et
-- `enseignant`, deja lisibles par tout l'etablissement. La passer en DEFINER
-- lui donnerait une portee qu'elle n'a pas besoin d'avoir.
create or replace function est_affecte(
  p_classe uuid,
  p_matiere uuid,
  p_annee uuid
)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from affectation_enseignant a
    join enseignant e on e.id = a."enseignantId"
    where a."classeId" = p_classe
      and a."matiereId" = p_matiere
      and a."anneeScolaireId" = p_annee
      and a."etablissementId" = auth_etablissement_id()
      and e."utilisateurId" = auth.uid()
  );
$$;

comment on function est_affecte is
  'Vrai si l''appelant est l''enseignant affecte a ce couple (classe, matiere) pour cette annee. Porte le controle d''acces aux notes et aux evaluations : un role ne suffit pas, puisque saisir des notes EST le metier de l''enseignant.';

-- ---------------------------------------------------------------------------
-- note
-- ---------------------------------------------------------------------------
-- La lecture reste a l'echelle de l'etablissement, inchangee : les bulletins,
-- les moyennes de classe et les statistiques la parcourent largement, et la
-- resserrer demanderait de reprendre ces calculs. Ce qui se ferme ici, c'est
-- l'ecriture.

drop policy if exists note_tenant on note;

create policy note_lecture on note for select
  using (
    is_super_admin()
    or exists (
      select 1 from evaluation ev
      join classe c on c.id = ev."classeId"
      where ev.id = note."evaluationId"
        and c."etablissementId" = auth_etablissement_id()
    )
  );

create policy note_ecriture on note for all
  using (
    is_super_admin()
    or exists (
      select 1 from evaluation ev
      join classe c on c.id = ev."classeId"
      where ev.id = note."evaluationId"
        and c."etablissementId" = auth_etablissement_id()
        and (
          auth_role() in ('DIRECTEUR', 'SECRETAIRE')
          or (
            auth_role() = 'ENSEIGNANT'
            and est_affecte(ev."classeId", ev."matiereId", ev."anneeScolaireId")
          )
        )
    )
  )
  with check (
    is_super_admin()
    or exists (
      select 1 from evaluation ev
      join classe c on c.id = ev."classeId"
      where ev.id = note."evaluationId"
        and c."etablissementId" = auth_etablissement_id()
        and (
          auth_role() in ('DIRECTEUR', 'SECRETAIRE')
          or (
            auth_role() = 'ENSEIGNANT'
            and est_affecte(ev."classeId", ev."matiereId", ev."anneeScolaireId")
          )
        )
    )
  );

comment on table note is
  'Ecriture bornee a l''affectation pour un ENSEIGNANT, ouverte a l''etablissement pour DIRECTEUR et SECRETAIRE qui font tourner le circuit de validation. Les RPC fn_soumettre_notes, fn_valider_soumission et fn_rejeter_soumission sont SECURITY INVOKER : elles passent par cette politique, ne pas la retirer en croyant qu''elles suffisent.';

-- ---------------------------------------------------------------------------
-- evaluation
-- ---------------------------------------------------------------------------
-- Meme raisonnement. Supprimer une evaluation d'autrui effacerait les notes
-- qu'elle porte : c'est la meme atteinte que de les reecrire, en plus brutal.

drop policy if exists evaluation_tenant on evaluation;

create policy evaluation_lecture on evaluation for select
  using (
    is_super_admin()
    or exists (
      select 1 from classe c
      where c.id = evaluation."classeId"
        and c."etablissementId" = auth_etablissement_id()
    )
  );

create policy evaluation_ecriture on evaluation for all
  using (
    is_super_admin()
    or exists (
      select 1 from classe c
      where c.id = evaluation."classeId"
        and c."etablissementId" = auth_etablissement_id()
        and (
          auth_role() in ('DIRECTEUR', 'SECRETAIRE')
          or (
            auth_role() = 'ENSEIGNANT'
            and est_affecte(evaluation."classeId", evaluation."matiereId", evaluation."anneeScolaireId")
          )
        )
    )
  )
  with check (
    is_super_admin()
    or exists (
      select 1 from classe c
      where c.id = evaluation."classeId"
        and c."etablissementId" = auth_etablissement_id()
        and (
          auth_role() in ('DIRECTEUR', 'SECRETAIRE')
          or (
            auth_role() = 'ENSEIGNANT'
            and est_affecte(evaluation."classeId", evaluation."matiereId", evaluation."anneeScolaireId")
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Priorite 3 : dossiers d'eleves et inscriptions
-- ---------------------------------------------------------------------------
-- Roles tires de `matrice.instantane.txt` :
--   eleve.updateEleve / archiverEleve / createEleveAvecResponsables = DIRECTEUR + SECRETAIRE
--   inscription.* (ecritures)                                       = DIRECTEUR + SECRETAIRE
--   responsable.updateResponsable / linkResponsableEleve            = DIRECTEUR + SECRETAIRE
--
-- Un enseignant consulte la fiche d'un eleve (`listElevesInscritsClasse`) ; il
-- n'a aucun chemin pour la modifier. La lecture reste donc ouverte.

drop policy if exists eleve_tenant on eleve;
create policy eleve_lecture on eleve for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());
create policy eleve_ecriture on eleve for all
  using (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id()
        and auth_role() in ('DIRECTEUR', 'SECRETAIRE'))
  )
  with check (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id()
        and auth_role() in ('DIRECTEUR', 'SECRETAIRE'))
  );

drop policy if exists inscription_tenant on inscription;
create policy inscription_lecture on inscription for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());
create policy inscription_ecriture on inscription for all
  using (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id()
        and auth_role() in ('DIRECTEUR', 'SECRETAIRE'))
  )
  with check (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id()
        and auth_role() in ('DIRECTEUR', 'SECRETAIRE'))
  );

drop policy if exists responsable_tenant on responsable;
create policy responsable_lecture on responsable for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());
create policy responsable_ecriture on responsable for all
  using (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id()
        and auth_role() in ('DIRECTEUR', 'SECRETAIRE'))
  )
  with check (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id()
        and auth_role() in ('DIRECTEUR', 'SECRETAIRE'))
  );

drop policy if exists eleve_responsable_tenant on eleve_responsable;
create policy eleve_responsable_lecture on eleve_responsable for select
  using (
    is_super_admin()
    or exists (
      select 1 from eleve e
      where e.id = eleve_responsable."eleveId"
        and e."etablissementId" = auth_etablissement_id()
    )
  );
create policy eleve_responsable_ecriture on eleve_responsable for all
  using (
    is_super_admin()
    or (
      auth_role() in ('DIRECTEUR', 'SECRETAIRE')
      and exists (
        select 1 from eleve e
        where e.id = eleve_responsable."eleveId"
          and e."etablissementId" = auth_etablissement_id()
      )
    )
  )
  with check (
    is_super_admin()
    or (
      auth_role() in ('DIRECTEUR', 'SECRETAIRE')
      and exists (
        select 1 from eleve e
        where e.id = eleve_responsable."eleveId"
          and e."etablissementId" = auth_etablissement_id()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Priorite 4 : le PIN d'approbation n'appartient qu'a son porteur
-- ---------------------------------------------------------------------------
--
-- `utilisateur_tenant` etait en `ALL` sur tout l'etablissement. Constate le
-- 2026-09-11 : un Enseignant a efface le hash du PIN d'approbation de la
-- Secretaire. Ce n'est pas une elevation de privilege — `exigerPin` echoue
-- ferme et lit le hash de l'appelant apres `requireRole` — mais c'est un
-- blocage du circuit de validation jusqu'a ce que la victime redefinisse son
-- PIN.
--
-- Le DIRECTEUR garde l'ecriture : il invite, desactive et reactive les comptes.
-- Chacun garde la sienne : `definirPin` porte sur sa propre ligne.
--
-- Mais « sa propre ligne » inclurait `role` et `statut`, donc un enseignant
-- pourrait encore se promouvoir — cosmetique, puisque le role applicatif vient
-- du JWT verifie, mais une liste de comptes qui mente n'est pas acceptable.
-- La RLS ne sait pas restreindre par colonne ; le depot a deja rencontre ce
-- probleme exact avec les dates d'essai, ecrivables par le Directeur sur sa
-- propre ligne d'etablissement, et l'a resolu par un declencheur
-- (`fn_proteger_dates_essai`). On reprend ce motif plutot que d'en inventer un.

create or replace function fn_proteger_champs_utilisateur()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  -- La cle service-role n'a pas de claim de role : les outils de la plateforme
  -- et les crons doivent continuer de passer.
  if auth_role() is null or is_super_admin() or auth_role() = 'DIRECTEUR' then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.statut is distinct from old.statut
     or new."etablissementId" is distinct from old."etablissementId" then
    raise exception 'Seule la direction peut modifier le role, le statut ou l''etablissement d''un compte.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_champs_utilisateur on utilisateur;
create trigger trg_proteger_champs_utilisateur
  before update on utilisateur
  for each row execute function fn_proteger_champs_utilisateur();

-- Pas de `revoke` sur cette fonction, pour la raison deja donnee dans
-- `20260911005324` : elle renvoie `trigger`, PostgREST ne l'expose pas, et il
-- n'y a donc aucune URL a fermer.

drop policy if exists utilisateur_tenant on utilisateur;
create policy utilisateur_lecture on utilisateur for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());
create policy utilisateur_ecriture on utilisateur for all
  using (
    is_super_admin()
    or (
      "etablissementId" = auth_etablissement_id()
      and (auth_role() = 'DIRECTEUR' or id = auth.uid())
    )
  )
  with check (
    is_super_admin()
    or (
      "etablissementId" = auth_etablissement_id()
      and (auth_role() = 'DIRECTEUR' or id = auth.uid())
    )
  );
