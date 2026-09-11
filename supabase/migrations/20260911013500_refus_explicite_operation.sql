-- Une operation detournee doit etre refusee a voix haute, pas en silence.
--
-- `20260911005324` a scope `fn_achever_operation` et `fn_abandonner_operation`
-- sur `userId = auth.uid()`. Le resserrement fonctionne : l'UPDATE et le DELETE
-- ne touchent plus la ligne d'un collegue.
--
-- Mais ils ne **disent** rien. Les deux fonctions ne renvoient rien, et un
-- UPDATE qui n'affecte aucune ligne est, vu de l'appelant, indiscernable d'un
-- succes. La sonde `scripts/verifier-separation-roles.ts` ne pouvait donc pas
-- prouver le correctif : elle notait l'appel « accepte », faute de pouvoir
-- constater l'absence d'effet.
--
-- C'est un probleme, et pas seulement de mesure. Une protection qu'aucun test
-- ne peut observer est une protection qu'on retirera un jour sans que rien ne
-- s'allume — exactement ce qui est arrive au controle de role, absent de la RLS
-- pendant des mois parce que l'applicatif semblait suffire.
--
-- D'ou un refus explicite quand la cle existe dans l'etablissement mais
-- appartient a quelqu'un d'autre. Le fait de reveler l'existence de la cle est
-- sans consequence : c'est un UUID v4 fabrique par le client, et
-- `fn_reclamer_operation` leve deja sur la meme collision.
--
-- Une cle **inconnue** reste un non-evenement silencieux : la file rejoue, et
-- une operation deja purgee ou jamais reclamee ne doit pas faire echouer un
-- vidage de file.

create or replace function fn_achever_operation(p_cle uuid, p_resultat jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etablissement uuid := auth_etablissement_id();
  v_user uuid := auth.uid();
  v_proprietaire uuid;
begin
  if v_etablissement is null or v_user is null then
    raise exception 'Operation hors session: etablissement ou utilisateur inconnu';
  end if;

  select "userId" into v_proprietaire from operation_client
    where "etablissementId" = v_etablissement and cle = p_cle;

  if v_proprietaire is not null and v_proprietaire <> v_user then
    raise exception 'Cle d''operation % reclamee par un autre utilisateur', p_cle;
  end if;

  -- `resultat is null` : une operation achevee ne se reecrit pas, sans quoi un
  -- rejeu tardif ecraserait le resultat deja rendu aux precedents appelants.
  update operation_client
    set resultat = coalesce(p_resultat, '{}'::jsonb)
    where "etablissementId" = v_etablissement
      and "userId" = v_user
      and cle = p_cle
      and resultat is null;
end;
$$;

create or replace function fn_abandonner_operation(p_cle uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etablissement uuid := auth_etablissement_id();
  v_user uuid := auth.uid();
  v_proprietaire uuid;
begin
  if v_etablissement is null or v_user is null then
    raise exception 'Operation hors session: etablissement ou utilisateur inconnu';
  end if;

  select "userId" into v_proprietaire from operation_client
    where "etablissementId" = v_etablissement and cle = p_cle;

  if v_proprietaire is not null and v_proprietaire <> v_user then
    raise exception 'Cle d''operation % reclamee par un autre utilisateur', p_cle;
  end if;

  -- Abandonner la reclamation d'un collegue rouvrirait la fenetre du double
  -- encaissement que toute cette table sert a fermer.
  delete from operation_client
    where "etablissementId" = v_etablissement
      and "userId" = v_user
      and cle = p_cle
      and resultat is null;
end;
$$;
