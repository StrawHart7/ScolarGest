-- « J'ai lu » : la lecture d'une annonce devient une donnée
-- ============================================================
-- L'annonce ne se ferme pas depuis la barre latérale — cette contrainte reste,
-- et c'est elle qui lui donne sa durée. Mais une fois le lecteur plein texte
-- ouvert, la personne a lu : lui refuser le geste de le dire transforme une
-- information en décor, et on apprend à sauter le décor.
--
-- Le bouton vit donc **au bas du lecteur**, jamais sur la carte. Il faut avoir
-- ouvert pour pouvoir écarter.
--
--
-- ## Par personne, pas par école
--
-- La question se pose parce que la Régie veut compter des **écoles**. Il aurait
-- été plus simple de marquer l'annonce lue pour l'établissement entier.
--
-- Ce serait faux. Une annonce s'adresse à une école mais se lit par quelqu'un :
-- si la Directrice écarte « les épreuves du BAC commencent lundi », la
-- Secrétaire et le Comptable ne la verront jamais, et personne ne saura qu'ils
-- ne l'ont pas vue. Le compteur d'écoles se déduit très bien des personnes ;
-- l'inverse ne se rattrape pas.
--
--
-- ## Ce que la Régie voit, et ce qu'elle ne voit pas
--
-- Elle n'a **aucun droit** sur cette table : elle nomme des personnes, et une
-- personne est du contenu d'école. Elle lit `controle.v_annonce_lecture`, qui
-- ne rend que des dénombrements.
--
-- La vue vit dans `controle` et non dans `public` : la branche (a) du contrôle
-- de frontière n'inspecte que `public`, et y poser une vue lisible par la Régie
-- aurait exigé de la déclarer dans `frontiere_autorisee` — donc de faire passer
-- pour un accès au produit ce qui est un agrégat du plan de contrôle. Une vue
-- appartient à son propriétaire : elle lit la table sous les droits de
-- `postgres`, et la Régie n'hérite de rien en la consultant.

create table public.annonce_lue (
  "evenementGlobalId" uuid not null references public.evenement_global_publie(id) on delete cascade,
  "userId" uuid not null,
  -- Dénormalisé volontairement : sans lui, compter les écoles obligerait à
  -- joindre une table de personnes depuis la vue que consulte la Régie. La
  -- colonne est figée à l'écriture par la policy, donc elle ne peut pas mentir.
  "etablissementId" uuid not null references etablissement(id) on delete cascade,
  "luLe" timestamptz not null default now(),
  primary key ("evenementGlobalId", "userId")
);

comment on table public.annonce_lue is
  'Marque « j''ai lu » posee par une personne sur une annonce. Par personne et non par ecole : un collegue qui ecarte ne doit pas faire disparaitre l''annonce pour les autres.';

create index idx_annonce_lue_ecole on public.annonce_lue ("etablissementId", "evenementGlobalId");

alter table public.annonce_lue enable row level security;

-- Lecture et écriture séparées, et les deux bornées à soi-même. Personne n'a
-- besoin de savoir qui, chez ses collègues, a lu quoi — et surtout pas de
-- décider à leur place.
create policy annonce_lue_lecture on public.annonce_lue
  for select using ("userId" = auth.uid());

-- `with check` fige les deux colonnes d'identité : l'établissement vient du
-- JWT vérifié, jamais de l'appelant. Sans cela, une école pourrait gonfler le
-- compteur de lecture d'une autre.
create policy annonce_lue_ecriture on public.annonce_lue
  for insert with check (
    "userId" = auth.uid()
    and "etablissementId" = auth_etablissement_id()
  );

-- Ni `update` ni `delete` : « j'ai lu » est un fait daté, pas un réglage. Une
-- ligne effaçable rendrait le compteur de la Régie révisable par ceux qu'il
-- compte.


-- ============================================================
-- Le KPI, côté plan de contrôle
-- ============================================================
-- Trois chiffres et aucun nom. `ecolesConcernees` est le dénominateur sans
-- lequel les deux autres ne disent rien : « douze écoles ont lu » se lit
-- autrement sur douze écoles concernées que sur deux cents.
create view controle.v_annonce_lecture as
select
  e.id as "evenementGlobalId",
  count(distinct l."userId")::int as "nbLecteurs",
  count(distinct l."etablissementId")::int as "nbEcoles",
  (
    select count(*)::int
      from etablissement et
     where e."cycleId" is null
        or exists (
          select 1 from cycle_etablissement ce
           where ce."etablissementId" = et.id
             and ce."cycleId" = e."cycleId"
             and ce.actif
        )
  ) as "ecolesConcernees",
  min(l."luLe") as "premiereLecture",
  max(l."luLe") as "derniereLecture"
from public.evenement_global_publie e
left join public.annonce_lue l on l."evenementGlobalId" = e.id
group by e.id, e."cycleId";

comment on view controle.v_annonce_lecture is
  'Portee reelle d''une annonce : combien de personnes, combien d''ecoles, sur combien d''ecoles concernees. Aucun identifiant de personne.';

grant select on controle.v_annonce_lecture to regie;


-- ============================================================
-- Contrôle
-- ============================================================
do $do$
declare
  v_lignes int;
  v_premier text;
begin
  -- La Régie ne doit rien avoir gagné sur la table des lectures.
  if has_table_privilege('regie', 'public.annonce_lue', 'SELECT') then
    raise exception
      'La Regie peut lire public.annonce_lue : elle y verrait des identifiants de personnes.';
  end if;

  if not has_table_privilege('regie', 'controle.v_annonce_lecture', 'SELECT') then
    raise exception
      'La Regie ne peut pas lire la vue d''agregat : le KPI serait vide sans que rien ne le dise.';
  end if;

  select count(*), min(objet || ' / ' || privilege || ' : ' || constat)
    into v_lignes, v_premier
    from public.regie_frontiere_debordements();
  if v_lignes > 0 then
    raise exception 'La frontiere rend % ligne(s). Premiere : %', v_lignes, v_premier;
  end if;

  raise notice 'annonce_lue en place : la Regie compte, elle ne lit pas.';
end;
$do$;
