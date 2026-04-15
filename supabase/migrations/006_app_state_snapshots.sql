-- ============================================================
-- APP STATE SNAPSHOTS
-- Stores the full demo app snapshot for optional remote hydration.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_state_snapshots (
  snapshot_key TEXT PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(state) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_state_snapshots ENABLE ROW LEVEL SECURITY;

-- The browser should access snapshots through the care-sync edge function.
-- Service-role access bypasses RLS, so no direct client policies are required here.

DROP TRIGGER IF EXISTS trg_app_state_snapshots_updated ON app_state_snapshots;
CREATE TRIGGER trg_app_state_snapshots_updated BEFORE UPDATE ON app_state_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
