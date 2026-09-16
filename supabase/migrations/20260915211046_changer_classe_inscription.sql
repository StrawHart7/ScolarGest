-- Changer un eleve de classe, facture comprise.
--
-- =====================================================================
-- LE CHEMIN SANS ISSUE
-- =====================================================================
--
-- Constate par le testeur le 2026-09-15 : on inscrit un eleve en 6e A alors
-- qu'il doit aller en 6e B, on annule l'inscription — elle passe ANNULEE — et
-- « Inscrire » repond « Cet eleve est deja inscrit pour cette annee scolaire ».
--
-- Trois faits qui s'emboitent :
--
-- 1. `inscription` porte `unique("eleveId", "anneeScolaireId")` : une seule
--    ligne par eleve et par annee, quel que soit son statut. C'est voulu.
-- 2. `fn_inscrire_eleve` refuse des qu'une ligne existe, **sans regarder le
--    statut**. Une inscription annulee bloque donc autant qu'une active.
-- 3. `reinscrireEleve` existait cote service, gardee et testee — et appelee
--    par aucun ecran. Le produit savait reactiver ; l'interface n'y menait pas.
--
-- Annuler etait donc reversible en theorie et definitif en pratique.
--
-- =====================================================================
-- MAIS ANNULER N'EST PAS LE BON GESTE
-- =====================================================================
--
-- Pour une faute de frappe, annuler puis reinscrire est une reponse violente.
-- Le geste juste est **changer la classe**, et c'est ce que fait cette
-- fonction — y compris sur une inscription annulee, qu'elle reactive au
-- passage. Un seul chemin pour les deux situations.
--
-- =====================================================================
-- LA FACTURE EST LE VRAI SUJET
-- =====================================================================
--
-- Les lignes de facture ont ete construites depuis les tarifs de la classe de
-- depart. Changer de classe change ce que la famille doit.
--
-- `reinscrireEleve` portait ce defaut en sommeil : elle changeait `classeId`
-- **sans toucher a la facture**. Cablee telle quelle, un eleve passe de la 6e a
-- la 2nde aurait garde la facture de la 6e. Une erreur d'affichage se voit ;
-- une erreur de montant se decouvre au recouvrement, des mois plus tard.
--
-- **L'ancienne facture est annulee, jamais supprimee** : l'invariant du depot
-- interdit la suppression dure sur les donnees financieres. Elle garde ses
-- lignes, qui restent l'historique de ce qui avait ete facture.
--
-- **Les versements suivent l'eleve.** Decision de l'utilisateur, le
-- 2026-09-15 : la famille a paye, l'argent la suit, seul le reste du a changer.
-- Les alternatives etaient de refuser des qu'un franc etait entre — sur, mais
-- bloquant — ou de laisser les versements sur la facture annulee, ce qui
-- ferait disparaitre l'argent de la vue de l'ecole.
--
-- **Le statut ne se recalcule pas ici** : `fn_recalculer_statut_facture` fait
-- foi, comme pour `fn_enregistrer_paiement`. Reecrire la regle a cote d'elle,
-- c'est la faire diverger au premier ajustement.
--
-- **Le surplus est rendu, pas tu.** Si la classe d'arrivee coute moins cher que
-- ce qui a deja ete verse, la famille se retrouve en avance. La fonction le
-- calcule et le renvoie pour que l'ecran le dise : un trop-percu silencieux se
-- decouvre au moment ou l'on reclame de l'argent a quelqu'un qui n'en doit pas.
--
-- =====================================================================
-- CE QU'ELLE NE FAIT PAS
-- =====================================================================
--
-- Elle ne touche **pas aux recus deja edites**. Un recu prouve qu'un versement
-- a ete recu : cela reste vrai apres le changement de classe. Seule la facture
-- qu'il mentionne a change de numero. Le compte des versements reportes est
-- renvoye pour que l'ecran puisse le signaler ; perimer d'autorite des recus
-- deja remis a des familles serait une decision, pas une consequence.
--
-- Elle n'est **pas** `security definer`, comme les autres RPC metier de ce
-- depot : elle s'execute sous la RLS de l'appelant. Le DIRECTEUR et la
-- SECRETAIRE ont bien l'ecriture sur `inscription`, `facture_eleve`,
-- `ligne_facture` et `paiement` — verifie contre les politiques du jour.

create or replace function public.fn_changer_classe_inscription(
  p_etablissement_id uuid,
  p_inscription_id uuid,
  p_classe_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_insc record;
  v_classe record;
  v_ancienne_facture record;
  v_nouvelle_facture uuid;
  v_ancienne_classe uuid;
  v_total numeric(12,2) := 0;
  v_tarif record;
  v_paye numeric(12,2) := 0;
  v_nb_paiements integer := 0;
  v_recalc jsonb;
begin
  -- 1. L'inscription, verrouillee : deux secretaires peuvent changer la meme
  --    classe en meme temps, et la seconde doit voir ce que la premiere a fait.
  select i.id, i."eleveId", i."anneeScolaireId", i."classeId", i.statut, i."etablissementId"
    into v_insc
    from inscription i
   where i.id = p_inscription_id
   for update;

  if not found then
    raise exception 'Inscription introuvable.' using errcode = 'P0001';
  end if;

  if v_insc."etablissementId" <> p_etablissement_id then
    raise exception 'Cette inscription appartient a un autre etablissement.' using errcode = 'P0001';
  end if;

  -- 2. La classe cible. Memes gardes que `fn_inscrire_eleve`, et pour la meme
  --    raison : une classe d'une autre annee produisait une inscription
  --    incoherente et une facture a zero, en silence.
  select c.id, c.nom, c."anneeScolaireId", c."etablissementId"
    into v_classe
    from classe c
   where c.id = p_classe_id;

  if not found then
    raise exception 'Classe cible introuvable.' using errcode = 'P0001';
  end if;

  if v_classe."etablissementId" <> p_etablissement_id then
    raise exception 'Cette classe appartient a un autre etablissement.' using errcode = 'P0001';
  end if;

  if v_classe."anneeScolaireId" <> v_insc."anneeScolaireId" then
    raise exception
      'La classe % appartient a une autre annee scolaire que celle de l''inscription.', v_classe.nom
      using errcode = 'P0001';
  end if;

  if v_insc."classeId" = p_classe_id and v_insc.statut = 'ACTIVE' then
    raise exception 'Cet eleve est deja inscrit dans cette classe.' using errcode = 'P0001';
  end if;

  v_ancienne_classe := v_insc."classeId";

  -- 3. La facture en vigueur, s'il y en a une. Une ecole qui n'a pas encore
  --    pose ses tarifs n'en a pas, et le changement de classe doit tout de
  --    meme aboutir.
  select f.id, f."montantTotal"
    into v_ancienne_facture
    from facture_eleve f
   where f."eleveId" = v_insc."eleveId"
     and f."anneeScolaireId" = v_insc."anneeScolaireId"
     and f.statut <> 'ANNULE'
   order by f."dateCreation" desc
   limit 1
   for update;

  -- 4. La nouvelle facture, depuis les tarifs de la classe d'arrivee.
  insert into facture_eleve ("etablissementId", "eleveId", "anneeScolaireId", "montantTotal")
  values (p_etablissement_id, v_insc."eleveId", v_insc."anneeScolaireId", 0)
  returning id into v_nouvelle_facture;

  for v_tarif in
    select tf.id as "typeFraisId", tf.nom, ts.montant
      from tarif_scolaire ts
      join type_frais tf on tf.id = ts."typeFraisId"
     where ts."anneeScolaireId" = v_insc."anneeScolaireId"
       and ts."classeId" = p_classe_id
  loop
    insert into ligne_facture ("factureId", "typeFraisId", designation, montant)
    values (v_nouvelle_facture, v_tarif."typeFraisId", v_tarif.nom, v_tarif.montant);
    v_total := v_total + v_tarif.montant;
  end loop;

  update facture_eleve set "montantTotal" = v_total where id = v_nouvelle_facture;

  -- 5. Les versements suivent l'eleve, puis l'ancienne facture est annulee.
  --
  --    Dans cet ordre : annuler d'abord laisserait, le temps d'une erreur, des
  --    versements rattaches a une facture annulee — c'est-a-dire de l'argent
  --    encaisse que plus aucun ecran ne compte.
  if v_ancienne_facture.id is not null then
    select count(*), coalesce(sum(montant), 0)
      into v_nb_paiements, v_paye
      from paiement
     where "factureId" = v_ancienne_facture.id
       and statut <> 'ANNULE';

    -- Les versements annules suivent aussi : ils appartiennent a l'historique
    -- de cette scolarite, et les laisser derriere les rendrait orphelins d'une
    -- facture que plus rien n'affiche.
    update paiement set "factureId" = v_nouvelle_facture
     where "factureId" = v_ancienne_facture.id;

    update facture_eleve set statut = 'ANNULE' where id = v_ancienne_facture.id;
  end if;

  -- 6. Le statut se deduit, il ne se decide pas ici.
  v_recalc := fn_recalculer_statut_facture(v_nouvelle_facture);

  -- 7. L'inscription. `ACTIVE` sans condition : c'est ce qui fait de cette
  --    fonction le chemin de retour d'une inscription annulee.
  update inscription
     set "classeId" = p_classe_id,
         statut = 'ACTIVE',
         "decisionFinAnnee" = null
   where id = p_inscription_id;

  return v_recalc || jsonb_build_object(
    'inscriptionId', p_inscription_id,
    'ancienneClasseId', v_ancienne_classe,
    'nouvelleClasseId', p_classe_id,
    'factureId', v_nouvelle_facture,
    'ancienneFactureId', v_ancienne_facture.id,
    'paiementsReportes', coalesce(v_nb_paiements, 0),
    'surplus', greatest(v_paye - v_total, 0)
  );
end;
$function$;

comment on function public.fn_changer_classe_inscription(uuid, uuid, uuid) is
  'Change la classe d''une inscription : annule l''ancienne facture, en emet une '
  'nouvelle depuis les tarifs de la classe d''arrivee, y reporte les versements, '
  'et reactive l''inscription si elle etait annulee. Voir la migration '
  '20260915211046 pour le raisonnement.';
