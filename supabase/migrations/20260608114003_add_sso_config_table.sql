
-- SSO configuration table (one row per provider, admin-managed)
CREATE TABLE IF NOT EXISTS sso_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    TEXT NOT NULL UNIQUE,          -- 'google'
  enabled     BOOLEAN NOT NULL DEFAULT false,
  client_id   TEXT,
  updated_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sso_config ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_all_sso_config" ON sso_config
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Anyone authenticated can read (needed by login page to know if SSO is on)
CREATE POLICY "authenticated_read_sso_config" ON sso_config
  FOR SELECT TO authenticated
  USING (true);

-- Allow anon read so login page (before sign-in) can fetch the config
CREATE POLICY "anon_read_sso_config" ON sso_config
  FOR SELECT TO anon
  USING (true);

-- Seed with a disabled Google entry so the row always exists
INSERT INTO sso_config (provider, enabled, client_id)
VALUES ('google', false, null)
ON CONFLICT (provider) DO NOTHING;
