-- Phase A of the Terminal-into-POS migration.
--
-- Mirrors the HEMI device tables from Card's Supabase into the POS
-- Supabase, plus introduces the org-ownership concept that the
-- in-marketplace POS plugin needs (owner_store_id, claimed_by_user_id,
-- store_staff).
--
-- Why mirror, not move: the data move is Phase D. This phase creates
-- the destination shape so Phase B (add posDb client to Terminal) and
-- Phase C (switch handlers one at a time) can land safely without
-- touching production data.
--
-- Cross-DB references (users, sso_tokens, wallets, transactions stay
-- in Card) are stored as loose uuids — no foreign key — because Postgres
-- can't FK across databases. The application layer is responsible for
-- consistency. peeap-pos already does this pattern for users via
-- MAIN_SUPABASE_* clients in src/lib/auth.ts.
--
-- Naming convention: every table starts with `store_` to match the
-- existing marketplace convention (stores, store_orders, store_carts)
-- and to make the source-of-truth obvious — POS Supabase, not Card.
--
-- Run in the POS Supabase (jyailfxlouvsssqujspo) SQL Editor.

-- ── store_devices ─────────────────────────────────────────────────────
-- Mirror of Card's merchant_devices, plus owner_store_id /
-- claimed_by_user_id for the multi-staff org pattern designed for
-- supermarkets, fuel stations and any vendor with multiple lanes.
CREATE TABLE IF NOT EXISTS store_devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn           text NOT NULL UNIQUE,
  device_secret       text NOT NULL UNIQUE,

  -- Ownership — exactly one of owner_user_id OR owner_store_id is set.
  -- Single-user merchant: owner_user_id (legacy individual flow).
  -- Org / vendor with staff: owner_store_id → stores(id).
  -- claimed_by_user_id is the currently-operating staff (rotates per
  -- shift handover) and is independent of ownership.
  owner_user_id       uuid,                                  -- loose ref to Card.users(id)
  owner_store_id      uuid REFERENCES stores(id) ON DELETE SET NULL,
  claimed_by_user_id  uuid,                                  -- loose ref to Card.users(id)
  claimed_at          timestamptz,

  -- Identity / configuration
  model               text NOT NULL DEFAULT 'y68',
  profile             text NOT NULL DEFAULT 'merchant',
  terminal_label      text,
  profile_metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Operational state (cloud-speaker pull cache)
  status              text NOT NULL DEFAULT 'active',
  cloud_state         jsonb,
  last_seen_at        timestamptz,
  last_synced_at      timestamptz,

  -- Theft / security (was migration 009 in Card; landed here from the start)
  security_flag       text,
  reported_stolen_at  timestamptz,
  reported_stolen_by  uuid,                                  -- loose ref to Card.users(id)

  -- Audit
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT store_devices_profile_chk
    CHECK (profile IN ('merchant', 'transport', 'pos', 'fuel', 'supermarket', 'event_gate')),
  CONSTRAINT store_devices_model_chk
    CHECK (model IN ('y68', 'soundbox', 'screen', 'keyboard')),
  CONSTRAINT store_devices_status_chk
    CHECK (status IN ('active', 'disabled', 'lost')),
  CONSTRAINT store_devices_security_flag_chk
    CHECK (security_flag IS NULL OR security_flag IN ('reported_stolen', 'fraud_hold')),

  -- Mutually exclusive ownership: a device belongs to a person OR a
  -- store, never both. Either column may be NULL (unclaimed device).
  CONSTRAINT store_devices_ownership_chk
    CHECK (NOT (owner_user_id IS NOT NULL AND owner_store_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_store_devices_owner_user
  ON store_devices(owner_user_id) WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_devices_owner_store
  ON store_devices(owner_store_id) WHERE owner_store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_devices_claimed_by
  ON store_devices(claimed_by_user_id) WHERE claimed_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_devices_unclaimed_secret
  ON store_devices(device_secret)
  WHERE claimed_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_store_devices_last_synced
  ON store_devices(last_synced_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_store_devices_security_flag
  ON store_devices(security_flag) WHERE security_flag IS NOT NULL;

-- ── store_device_shifts ──────────────────────────────────────────────
-- Cashier shifts on a device. With multi-staff orgs, this also tracks
-- which staff member operated which lane on what day for cross-shift
-- reporting (cash drawer reconciliation, sales attribution).
CREATE TABLE IF NOT EXISTS store_device_shifts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn       text NOT NULL REFERENCES store_devices(device_sn) ON DELETE CASCADE,
  store_id        uuid REFERENCES stores(id) ON DELETE SET NULL,
  staff_user_id   uuid NOT NULL,                            -- loose ref to Card.users(id)
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  opened_via      text NOT NULL DEFAULT 'app',
  cash_collected  numeric(14,2),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT store_device_shifts_opened_via_chk
    CHECK (opened_via IN ('pin', 'claim_qr', 'app', 'pos_login'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_device_shifts_open
  ON store_device_shifts(device_sn) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_store_device_shifts_staff
  ON store_device_shifts(staff_user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_device_shifts_device
  ON store_device_shifts(device_sn, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_device_shifts_store
  ON store_device_shifts(store_id, started_at DESC) WHERE store_id IS NOT NULL;

-- ── store_terminal_assets ────────────────────────────────────────────
-- Merchant-uploaded audio + brand images that need admin approval
-- before they can be activated on a device. Mirror of
-- merchant_terminal_assets in Card.
CREATE TABLE IF NOT EXISTS store_terminal_assets (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owning merchant — EITHER a single-user merchant OR a store.
  -- Same mutually-exclusive ownership pattern as store_devices.
  merchant_user_id         uuid,                            -- loose ref to Card.users(id)
  store_id                 uuid REFERENCES stores(id) ON DELETE CASCADE,

  device_sn                text REFERENCES store_devices(device_sn) ON DELETE SET NULL,
  asset_type               text NOT NULL,
  display_name             text NOT NULL,
  original_filename        text NOT NULL,
  mime_type                text NOT NULL,
  size_bytes               integer NOT NULL,
  storage_url              text,
  cloud_speaker_filename   text,
  cloud_speaker_task_id    text,
  status                   text NOT NULL DEFAULT 'pending',
  rejection_reason         text,
  submitted_at             timestamptz NOT NULL DEFAULT now(),
  reviewed_by_user_id      uuid,                            -- loose ref to Card.users(id)
  reviewed_at              timestamptz,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT sta_asset_type_chk CHECK (asset_type IN ('audio', 'idle_image', 'loading_image')),
  CONSTRAINT sta_status_chk     CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  CONSTRAINT sta_ownership_chk
    CHECK (NOT (merchant_user_id IS NOT NULL AND store_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_sta_merchant
  ON store_terminal_assets(merchant_user_id, status, submitted_at DESC)
  WHERE merchant_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sta_store
  ON store_terminal_assets(store_id, status, submitted_at DESC)
  WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sta_pending_queue
  ON store_terminal_assets(submitted_at ASC) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sta_device
  ON store_terminal_assets(device_sn) WHERE device_sn IS NOT NULL;

-- ── store_staff ───────────────────────────────────────────────────────
-- Who works for which store and with what role. Backs the
-- staff-check endpoint that Terminal calls cross-service to validate
-- org membership during device claim.
--
-- The 'owner' role is auto-created for the user who registered the
-- store; 'manager' can invite/remove staff and report stolen; 'cashier'
-- can only operate (claim/sign-out/run sales). UI tier-gates buttons
-- by this role.
CREATE TABLE IF NOT EXISTS store_staff (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,                            -- loose ref to Card.users(id)
  role            text NOT NULL DEFAULT 'cashier',
  status          text NOT NULL DEFAULT 'invited',
  invited_by      uuid,                                     -- loose ref to Card.users(id)
  invited_via     text,                                     -- 'phone', 'email', 'qr_scan', 'self_owner'
  invited_at      timestamptz NOT NULL DEFAULT now(),
  joined_at       timestamptz,
  removed_at      timestamptz,
  removed_by      uuid,                                     -- loose ref to Card.users(id)
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT store_staff_role_chk
    CHECK (role IN ('owner', 'manager', 'cashier')),
  CONSTRAINT store_staff_status_chk
    CHECK (status IN ('invited', 'approved', 'removed', 'declined'))
);

-- One active row per (store, user). Re-invitation after removal is fine,
-- but a user can't simultaneously hold two active roles in the same store.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_staff_active
  ON store_staff(store_id, user_id)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_store_staff_user_active
  ON store_staff(user_id) WHERE status = 'approved' AND removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_store_staff_pending
  ON store_staff(store_id, invited_at DESC) WHERE status = 'invited';

-- ── store_device_security_log ────────────────────────────────────────
-- Replaces what we used to write to Card's system_alerts for the
-- theft honeypot. Keeps the dossier (claimer identity, IP, UA, account
-- age) co-located with the device data the fraud team is investigating.
-- Card's system_alerts continues to receive a cross-link with severity
-- 'critical' so admins on the existing observability surface still see it.
CREATE TABLE IF NOT EXISTS store_device_security_log (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn                text NOT NULL,
  event_type               text NOT NULL,
  reporter_user_id         uuid,                            -- who reported / triggered
  triggered_by_user_id     uuid,                            -- the suspected thief on honeypot trigger
  triggered_by_ip          text,
  triggered_by_user_agent  text,
  context                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sdsl_event_type_chk
    CHECK (event_type IN ('reported_stolen', 'honeypot_claim', 'fraud_hold', 'cleared'))
);

CREATE INDEX IF NOT EXISTS idx_sdsl_device
  ON store_device_security_log(device_sn, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sdsl_triggered_by
  ON store_device_security_log(triggered_by_user_id, created_at DESC)
  WHERE triggered_by_user_id IS NOT NULL;
