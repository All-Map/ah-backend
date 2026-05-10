-- Manual migration: agent commissions + payouts
-- Run this against your Supabase DB (e.g. via supabase SQL editor or psql).
-- Idempotent so it's safe to re-run.

-- ─── ENUMS ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE agent_commission_status_enum AS ENUM ('pending','available','reserved','paid','voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agent_payout_method_enum AS ENUM ('momo','bank');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE agent_payout_status_enum AS ENUM ('requested','approved','paid','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── TABLES ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_payouts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id        UUID NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  method          agent_payout_method_enum NOT NULL,
  destination     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          agent_payout_status_enum NOT NULL DEFAULT 'requested',
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ(6),
  paid_at         TIMESTAMPTZ(6),
  transaction_ref VARCHAR,
  rejection_reason TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_payouts_agent_status_idx ON agent_payouts(agent_id, status);
CREATE INDEX IF NOT EXISTS agent_payouts_status_idx ON agent_payouts(status);

CREATE TABLE IF NOT EXISTS agent_commissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id    UUID NOT NULL UNIQUE,
  agent_id      UUID NOT NULL,
  hostel_id     UUID NOT NULL,
  amount        DECIMAL(10,2) NOT NULL DEFAULT 35,
  status        agent_commission_status_enum NOT NULL DEFAULT 'pending',
  available_at  TIMESTAMPTZ(6) NOT NULL,
  paid_out_at   TIMESTAMPTZ(6),
  payout_id     UUID,
  notes         TEXT,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_commissions_booking_fk
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT agent_commissions_payout_fk
    FOREIGN KEY (payout_id)  REFERENCES agent_payouts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS agent_commissions_agent_status_idx ON agent_commissions(agent_id, status);

-- ─── BOOKING FEE DEFAULT BUMP (70 → 100) ────────────────────────
ALTER TABLE bookings ALTER COLUMN booking_fee SET DEFAULT 100;

-- updated_at auto-bump triggers
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_commissions_set_updated_at ON agent_commissions;
CREATE TRIGGER agent_commissions_set_updated_at
  BEFORE UPDATE ON agent_commissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS agent_payouts_set_updated_at ON agent_payouts;
CREATE TRIGGER agent_payouts_set_updated_at
  BEFORE UPDATE ON agent_payouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
