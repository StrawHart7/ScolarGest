-- Idempotence des ecritures differees : « cette operation a-t-elle deja ete
-- appliquee ? »
--
-- Contexte, donne par l'utilisateur le 2026-09-07 : au Togo les coupures de
-- courant durent de trois a six heures, parfois tous les jours de la semaine.
-- L'appareil continue de fonctionner sur batterie, c'est le reseau qui
-- disparait. Une ecole doit donc pouvoir saisir hors ligne et laisser partir
-- ses ecritures au retour du reseau.
--
-- La file d'attente existante (brouillons de notes, `0.1` de la PWA) s'en
-- passait : `saisirNoteAction` est un upsert sur `(evaluationId, eleveId)`,
-- donc rejouable sans consequence. Cette propriete est une **chance**, pas une
-- regle. Un versement n'est pas un upsert : le rejouer encaisse deux fois.
--
-- D'ou cette table. Le client fabrique une cle avant d'agir ; le serveur
-- refuse la seconde application de la meme cle et **rend le resultat de la
-- premiere**. C'est ce dernier point qui compte : sans lui, un rejeu
-- repondrait « deja fait » sans dire quel recu a ete emis, et le client
-- n'aurait aucun moyen d'afficher le document produit.
--
-- La cle est generee par le client, delibrement. C'est la seule facon qu'un
-- appareil hors ligne depuis six heures produise un identifiant stable : une
-- cle attribuee par le serveur exigerait justement le reseau qu'on n'a pas.

create table if not exists operation_client (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id) on delete cascade,
  "userId" uuid not null references auth.users(id) on delete cascade,

  -- Fabriquee par le client (crypto.randomUUID) avant la mise en file.
  cle uuid not null,

  -- Nature de l'operation : 'PAIEMENT', 'SOUMISSION_NOTES', ... Sert au
  -- diagnostic et interdit qu'une cle rejouee sous un autre type passe pour la
  -- meme operation.
  type text not null,

  -- Ce que la premiere application a produit, rendu tel quel au rejeu.
  -- `jsonb` et non un `uuid` : selon l'operation le resultat est un
  -- identifiant, une reference de document, ou rien du tout.
  resultat jsonb,

  "creeLe" timestamptz not null default now()
);

-- L'unicite porte sur (etablissement, cle) et non sur la cle seule.
--
-- Une collision d'UUID v4 est hors de propos ; ce qui compte est qu'une cle
-- forgee par un tenant ne puisse jamais bloquer l'operation d'un autre. Sans
-- l'etablissement dans la contrainte, un appelant malveillant pourrait
-- pre-inserer des cles pour faire passer les ecritures d'une autre ecole pour
-- « deja appliquees ».
create unique index if not exists operation_client_cle_unique
  on operation_client ("etablissementId", cle);

create index if not exists operation_client_recherche
  on operation_client ("etablissementId", "userId", "creeLe" desc);

comment on table operation_client is
  'Journal d''idempotence des ecritures differees hors ligne. Une ligne = une operation deja appliquee ; son `resultat` est rendu au rejeu.';
comment on column operation_client.cle is
  'Cle fabriquee par le client avant la mise en file. Stable a travers une coupure reseau, contrairement a un identifiant attribue par le serveur.';

-- ------------------------------------------------------------------ RLS ---

alter table operation_client enable row level security;

-- Lecture et insertion par le tenant : la Server Action qui applique
-- l'operation tourne avec la session de l'utilisateur, pas avec la cle
-- service-role.
create policy operation_client_tenant on operation_client for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());

create policy operation_client_insertion on operation_client for insert
  with check (
    is_super_admin()
    or ("etablissementId" = auth_etablissement_id() and "userId" = auth.uid())
  );

-- Ni update ni delete, pour personne.
--
-- Une ligne effacable ne protege plus de rien : il suffirait de la supprimer
-- pour rejouer un encaissement. C'est le meme raisonnement que l'invariant
-- « pas de suppression dure » sur les donnees financieres, applique ici au
-- garde-fou lui-meme.

-- ------------------------------------------------------------- purge ---

-- Une ligne ne sert qu'a reconnaitre un rejeu, et un rejeu arrive dans les
-- minutes ou les heures qui suivent la reconnexion — jamais six mois plus
-- tard. La table grossirait sans fin sans cette purge.
--
-- Un an, et non trente jours : la fenetre doit couvrir le cas ou un appareil
-- reste eteint toute une periode de vacances scolaires avec des ecritures en
-- attente. Purger trop tot ferait exactement ce qu'on cherche a empecher.
create or replace function fn_purger_operations_client()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  nombre integer;
begin
  delete from operation_client where "creeLe" < now() - interval '1 year';
  get diagnostics nombre = row_count;
  return nombre;
end;
$$;

comment on function fn_purger_operations_client is
  'Retire les traces d''idempotence de plus d''un an. Fenetre volontairement large : un appareil peut rester eteint toute une periode de vacances avec des ecritures en attente.';

-- ------------------------------------------- reclamer / achever / abandonner ---

-- Trois transitions, et aucune que le tenant puisse ecrire directement.
--
-- Le premier reflexe etait « lire, puis executer si absent, puis inserer ».
-- Il est faux : deux onglets revenus en ligne en meme temps lisent tous les
-- deux « absent », executent tous les deux, et encaissent deux fois. La lecture
-- prealable ne verrouille rien.
--
-- C'est donc l'insertion qui fait office de verrou — l'index unique tranche, et
-- le perdant apprend qu'il rejoue. `resultat` reste nul tant que le travail
-- n'est pas acheve, ce qui distingue trois etats et non deux : jamais vue,
-- en cours ailleurs, ou terminee avec son resultat.

create or replace function fn_reclamer_operation(p_cle uuid, p_type text)
returns table (rejeu boolean, achevee boolean, resultat jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etablissement uuid := auth_etablissement_id();
  v_user uuid := auth.uid();
  v_existant operation_client;
begin
  if v_etablissement is null or v_user is null then
    raise exception 'Operation hors session: etablissement ou utilisateur inconnu';
  end if;

  begin
    insert into operation_client ("etablissementId", "userId", cle, type)
    values (v_etablissement, v_user, p_cle, p_type);
    -- Reclamation obtenue : l'appelant execute.
    return query select false, false, null::jsonb;
    return;
  exception when unique_violation then
    -- Quelqu'un a deja reclame cette cle. On rend son etat.
    null;
  end;

  select * into v_existant from operation_client
    where "etablissementId" = v_etablissement and cle = p_cle;

  -- Meme cle sous un autre type : ce n'est pas un rejeu, c'est une collision.
  -- Laisser passer reviendrait a rendre le resultat d'un encaissement a une
  -- soumission de notes.
  if v_existant.type is distinct from p_type then
    raise exception 'Cle d''operation % deja utilisee pour le type %', p_cle, v_existant.type;
  end if;

  return query select true, v_existant.resultat is not null, v_existant.resultat;
end;
$$;

create or replace function fn_achever_operation(p_cle uuid, p_resultat jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etablissement uuid := auth_etablissement_id();
begin
  -- `resultat is null` dans le WHERE : une operation achevee ne se reecrit
  -- pas. Sans cette condition, un rejeu tardif ecraserait le resultat rendu
  -- aux precedents appelants, et deux clients liraient deux reponses
  -- differentes pour la meme operation.
  update operation_client
    set resultat = coalesce(p_resultat, '{}'::jsonb)
    where "etablissementId" = v_etablissement and cle = p_cle and resultat is null;
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
begin
  -- Le travail a echoue : on retire la reclamation pour que la file puisse
  -- reessayer. Sans cela, une panne reseau au milieu d'un encaissement
  -- laisserait une cle reclamee pour toujours, et le versement ne partirait
  -- jamais — l'idempotence se retournerait contre l'utilisateur.
  --
  -- `resultat is null` : on n'efface jamais une operation achevee.
  delete from operation_client
    where "etablissementId" = v_etablissement and cle = p_cle and resultat is null;
end;
$$;

comment on function fn_reclamer_operation is
  'Reclame une cle d''idempotence. L''insertion sert de verrou : le perdant de la course apprend qu''il rejoue au lieu d''executer une seconde fois.';
comment on function fn_achever_operation is
  'Enregistre le resultat d''une operation reclamee. N''ecrase jamais un resultat deja rendu.';
comment on function fn_abandonner_operation is
  'Retire une reclamation dont le travail a echoue, pour que la file puisse reessayer. Ne touche pas aux operations achevees.';
