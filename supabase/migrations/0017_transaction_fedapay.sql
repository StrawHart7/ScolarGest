-- Paiement en ligne des abonnements via FedaPay (Mobile Money, XOF).
--
-- Une ligne par tentative de paiement. Elle porte tout ce qu'il faut pour
-- créer l'abonnement **sans rien redemander au navigateur** : le webhook
-- arrive depuis les serveurs de FedaPay, sans session, sans cookie et sans
-- rien savoir du contexte où l'école a cliqué. Ce qui n'est pas écrit ici au
-- moment de l'intention est définitivement perdu au moment de la confirmation.

create table if not exists transaction_fedapay (
  id uuid primary key default gen_random_uuid(),
  "etablissementId" uuid not null references etablissement(id),
  "planId" uuid not null references plan_abonnement(id),

  -- Figés à l'intention : ce que l'école a vu affiché est ce qu'elle paiera,
  -- même si le catalogue change entre le clic et la confirmation.
  "nombreCycles" integer not null check ("nombreCycles" >= 1),
  montant numeric(12, 2) not null check (montant > 0),

  -- Identifiant FedaPay. `unique` : c'est la clé d'idempotence du webhook,
  -- que FedaPay rejoue tant qu'il n'a pas reçu un accusé de réception.
  "fedapayId" text unique,

  -- 'moov_tg', 'mtn'… ou NULL pour un paiement par page hébergée.
  operateur text,
  telephone text,
  "urlPaiement" text,

  statut text not null default 'EN_ATTENTE'
    check (statut in ('EN_ATTENTE', 'APPROUVE', 'ANNULE', 'ECHOUE')),

  -- Rempli à l'approbation. Sa présence est ce qui prouve que la transaction
  -- a déjà été honorée : un rejeu du webhook la trouve non nulle et n'ouvre
  -- pas une seconde période.
  "abonnementId" uuid references abonnement_etablissement(id),

  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists idx_transaction_fedapay_etab
  on transaction_fedapay("etablissementId");
create index if not exists idx_transaction_fedapay_statut
  on transaction_fedapay(statut);

drop trigger if exists trg_transaction_fedapay_updated on transaction_fedapay;
create trigger trg_transaction_fedapay_updated
  before update on transaction_fedapay
  for each row execute function touch_updated_at();

-- ============================================================
-- RLS
-- ============================================================
-- Lecture par le tenant : une école doit voir ses propres tentatives, pour
-- comprendre pourquoi un paiement n'a pas abouti.
--
-- **Aucune écriture pour le tenant.** Une école qui pourrait insérer ou
-- modifier une ligne ici s'offrirait un abonnement sans payer. Les écritures
-- passent exclusivement par le code serveur avec la clé service-role : la
-- création de l'intention (service gardé) et le webhook (signature FedaPay
-- vérifiée). C'est le même raisonnement que pour les dates d'essai en `0015` :
-- ce que le bénéficiaire peut écrire, il peut le falsifier.
alter table transaction_fedapay enable row level security;

drop policy if exists transaction_fedapay_lecture on transaction_fedapay;
create policy transaction_fedapay_lecture on transaction_fedapay for select
  using (is_super_admin() or "etablissementId" = auth_etablissement_id());

comment on table transaction_fedapay is
  'Tentatives de paiement d''abonnement via FedaPay. Lecture seule pour le tenant : les écritures passent par la clé service-role (service gardé, ou webhook signé).';
comment on column transaction_fedapay."fedapayId" is
  'Identifiant de la transaction chez FedaPay. UNIQUE : clé d''idempotence du webhook, que FedaPay rejoue jusqu''à accusé de réception.';
comment on column transaction_fedapay."abonnementId" is
  'Abonnement ouvert par ce paiement. Non nul = paiement déjà honoré : un rejeu du webhook n''ouvre pas une seconde période.';
