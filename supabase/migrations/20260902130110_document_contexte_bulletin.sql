-- Un bulletin en base ne savait pas de quel trimestre il était.
--
-- `document` ne portait que `objetType = 'ELEVE'` et `objetId = eleveId`. La
-- période, la classe et l'année n'existaient que dans le journal d'audit, en
-- `nouvelleValeur`. Conséquence concrète : impossible d'afficher les bulletins
-- déjà édités d'une classe pour un trimestre donné, donc impossible de répondre
-- à la seule question qu'on se pose devant cet écran — « qui n'a pas encore
-- son bulletin ? ». On regénérait à l'aveugle, ce qui empile les documents.
--
-- Les trois colonnes sont nullables : un RECU ou un RAPPORT n'a pas de
-- trimestre, et les rendre obligatoires forcerait une valeur inventée pour les
-- deux autres types de documents.
--
-- Numéro 0025 et non 0024 : une session parallèle a réservé 0024 pour les
-- pièces jointes du support (arbitré avec l'utilisateur le 2026-09-02).

alter table document
  add column periode periode,
  add column "classeId" uuid references classe(id),
  add column "anneeScolaireId" uuid references annee_scolaire(id);

-- Reprise des bulletins déjà générés depuis le journal d'audit, qui consigne
-- ce contexte depuis l'origine (`GENERER_BULLETIN` et `REGENERER_BULLETIN`,
-- `objetId` = identifiant du document).
--
-- Une ligne d'audit absente laisse le document sans contexte plutôt que de lui
-- en inventer un : la liste affichera « période inconnue », ce qui est vrai et
-- se corrige en régénérant. Attribuer un trimestre au hasard produirait un
-- écran qui ment sur des documents remis aux familles.
update document d
set periode = (a."nouvelleValeur" ->> 'periode')::periode,
    "classeId" = nullif(a."nouvelleValeur" ->> 'classeId', '')::uuid,
    "anneeScolaireId" = nullif(a."nouvelleValeur" ->> 'anneeScolaireId', '')::uuid
from audit_log a
where a."objetType" = 'Document'
  and a."objetId" = d.id::text
  and a.action in ('GENERER_BULLETIN', 'REGENERER_BULLETIN')
  and a."nouvelleValeur" ? 'periode'
  and d.type = 'BULLETIN'
  and d.periode is null;

-- L'écran interroge toujours par (établissement, classe, période) : c'est cet
-- index qui évite de balayer tous les documents de l'école à chaque affichage.
create index idx_document_bulletin_classe_periode
  on document ("etablissementId", "classeId", periode)
  where type = 'BULLETIN';

do $$
declare
  orphelins int;
  total int;
begin
  select count(*) into total from document where type = 'BULLETIN';
  select count(*) into orphelins from document where type = 'BULLETIN' and periode is null;
  -- Constat, pas garde-fou : la migration ne doit pas échouer parce qu'une
  -- école a purgé son journal. Le chiffre est affiché pour qu'on sache
  -- combien de bulletins resteront sans trimestre dans la liste.
  raise notice 'Bulletins repris : % / % (% sans contexte)', total - orphelins, total, orphelins;
end $$;
