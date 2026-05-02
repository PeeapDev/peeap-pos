CREATE TABLE IF NOT EXISTS store_devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn           text NOT NULL UNIQUE,
  device_secret       text NOT NULL UNIQUE,
  owner_user_id       uuid,
  owner_store_id      uuid REFERENCES stores(id) ON DELETE SET NULL,
  claimed_by_user_id  uuid,
  claimed_at          timestamptz,
  model               text NOT NULL DEFAULT 'y68',
  profile             text NOT NULL DEFAULT 'merchant',
  terminal_label      text,
  profile_metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  status              text NOT NULL DEFAULT 'active',
  cloud_state         jsonb,
  last_seen_at        timestamptz,
  last_synced_at      timestamptz,
  security_flag       text,
  reported_stolen_at  timestamptz,
  reported_stolen_by  uuid,
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


CREATE TABLE IF NOT EXISTS store_device_shifts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn       text NOT NULL REFERENCES store_devices(device_sn) ON DELETE CASCADE,
  store_id        uuid REFERENCES stores(id) ON DELETE SET NULL,
  staff_user_id   uuid NOT NULL,
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


CREATE TABLE IF NOT EXISTS store_terminal_assets (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id         uuid,
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
  reviewed_by_user_id      uuid,
  reviewed_at              timestamptz,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT sta_asset_type_chk
    CHECK (asset_type IN ('audio', 'idle_image', 'loading_image')),
  CONSTRAINT sta_status_chk
    CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
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


CREATE TABLE IF NOT EXISTS store_staff (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  role            text NOT NULL DEFAULT 'cashier',
  status          text NOT NULL DEFAULT 'invited',
  invited_by      uuid,
  invited_via     text,
  invited_at      timestamptz NOT NULL DEFAULT now(),
  joined_at       timestamptz,
  removed_at      timestamptz,
  removed_by      uuid,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT store_staff_role_chk
    CHECK (role IN ('owner', 'manager', 'cashier')),
  CONSTRAINT store_staff_status_chk
    CHECK (status IN ('invited', 'approved', 'removed', 'declined'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_staff_active
  ON store_staff(store_id, user_id) WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_store_staff_user_active
  ON store_staff(user_id) WHERE status = 'approved' AND removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_store_staff_pending
  ON store_staff(store_id, invited_at DESC) WHERE status = 'invited';


CREATE TABLE IF NOT EXISTS store_device_security_log (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn                text NOT NULL,
  event_type               text NOT NULL,
  reporter_user_id         uuid,
  triggered_by_user_id     uuid,
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
