/*
  # Add Settings Master Tables

  ## Summary
  Creates five master lookup tables that Admin and TMG users can manage
  via the Settings page. These tables power the dropdown/autocomplete
  options shown to employees when filling in their Skill Form.

  ## New Tables

  1. **settings_certifications** — master list of certification names
     - id (uuid, PK)
     - name (text, unique, not null) — e.g. "AWS Solutions Architect"
     - is_active (boolean, default true) — soft delete flag
     - created_at (timestamptz)

  2. **settings_languages** — master list of programming languages
     - id, name (unique), is_active, created_at

  3. **settings_frameworks** — master list of frameworks / libraries
     - id, name (unique), is_active, created_at

  4. **settings_tools** — master list of tools (e.g. Docker, Jira)
     - id, name (unique), is_active, created_at

  5. **settings_databases** — master list of databases (e.g. PostgreSQL, Redis)
     - id, name (unique), is_active, created_at

  ## Security
  - RLS enabled on all tables
  - All authenticated users can SELECT active rows (needed to populate form dropdowns)
  - Only admin and tmg roles can INSERT / UPDATE

  ## Seed Data
  Each table is pre-seeded with common values so the form is immediately
  useful without manual configuration.
*/

-- ──────────────────────────────────────────────
-- Helper: reusable function to check admin/tmg
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin_or_tmg()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'tmg')
      AND is_active = true
  );
$$;

-- ──────────────────────────────────────────────
-- Table: settings_certifications
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings_certifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_certifications_name_unique UNIQUE (name)
);

ALTER TABLE public.settings_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view certifications"
  ON public.settings_certifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin or TMG can insert certifications"
  ON public.settings_certifications FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update certifications"
  ON public.settings_certifications FOR UPDATE
  TO authenticated
  USING (is_admin_or_tmg())
  WITH CHECK (is_admin_or_tmg());

-- ──────────────────────────────────────────────
-- Table: settings_languages
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings_languages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_languages_name_unique UNIQUE (name)
);

ALTER TABLE public.settings_languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view languages"
  ON public.settings_languages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin or TMG can insert languages"
  ON public.settings_languages FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update languages"
  ON public.settings_languages FOR UPDATE
  TO authenticated
  USING (is_admin_or_tmg())
  WITH CHECK (is_admin_or_tmg());

-- ──────────────────────────────────────────────
-- Table: settings_frameworks
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings_frameworks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_frameworks_name_unique UNIQUE (name)
);

ALTER TABLE public.settings_frameworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view frameworks"
  ON public.settings_frameworks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin or TMG can insert frameworks"
  ON public.settings_frameworks FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update frameworks"
  ON public.settings_frameworks FOR UPDATE
  TO authenticated
  USING (is_admin_or_tmg())
  WITH CHECK (is_admin_or_tmg());

-- ──────────────────────────────────────────────
-- Table: settings_tools
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings_tools (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_tools_name_unique UNIQUE (name)
);

ALTER TABLE public.settings_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tools"
  ON public.settings_tools FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin or TMG can insert tools"
  ON public.settings_tools FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update tools"
  ON public.settings_tools FOR UPDATE
  TO authenticated
  USING (is_admin_or_tmg())
  WITH CHECK (is_admin_or_tmg());

-- ──────────────────────────────────────────────
-- Table: settings_databases
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings_databases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_databases_name_unique UNIQUE (name)
);

ALTER TABLE public.settings_databases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view databases"
  ON public.settings_databases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin or TMG can insert databases"
  ON public.settings_databases FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_tmg());

CREATE POLICY "Admin or TMG can update databases"
  ON public.settings_databases FOR UPDATE
  TO authenticated
  USING (is_admin_or_tmg())
  WITH CHECK (is_admin_or_tmg());

-- ──────────────────────────────────────────────
-- Seed Data
-- ──────────────────────────────────────────────
INSERT INTO public.settings_certifications (name) VALUES
  ('AWS Certified Solutions Architect'),
  ('AWS Certified Developer'),
  ('AWS Certified DevOps Engineer'),
  ('Google Cloud Professional Cloud Architect'),
  ('Google Cloud Associate Cloud Engineer'),
  ('Microsoft Azure Administrator (AZ-104)'),
  ('Microsoft Azure Developer (AZ-204)'),
  ('Certified Kubernetes Administrator (CKA)'),
  ('Certified Kubernetes Application Developer (CKAD)'),
  ('HashiCorp Certified Terraform Associate'),
  ('PMP - Project Management Professional'),
  ('Scrum Master Certification (CSM)'),
  ('Oracle Certified Java Programmer'),
  ('CompTIA Security+'),
  ('Certified Ethical Hacker (CEH)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.settings_languages (name) VALUES
  ('JavaScript'),
  ('TypeScript'),
  ('Python'),
  ('Java'),
  ('C#'),
  ('C++'),
  ('Go'),
  ('Rust'),
  ('Kotlin'),
  ('Swift'),
  ('PHP'),
  ('Ruby'),
  ('Scala'),
  ('R'),
  ('Dart'),
  ('SQL'),
  ('Shell / Bash')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.settings_frameworks (name) VALUES
  ('React'),
  ('Angular'),
  ('Vue.js'),
  ('Next.js'),
  ('Nuxt.js'),
  ('Node.js'),
  ('Express.js'),
  ('NestJS'),
  ('Spring Boot'),
  ('Django'),
  ('FastAPI'),
  ('Flask'),
  ('.NET / ASP.NET Core'),
  ('Laravel'),
  ('Ruby on Rails'),
  ('Flutter'),
  ('React Native'),
  ('GraphQL'),
  ('gRPC')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.settings_tools (name) VALUES
  ('Docker'),
  ('Kubernetes'),
  ('Jenkins'),
  ('GitHub Actions'),
  ('GitLab CI/CD'),
  ('Terraform'),
  ('Ansible'),
  ('Helm'),
  ('Jira'),
  ('Confluence'),
  ('Postman'),
  ('VS Code'),
  ('IntelliJ IDEA'),
  ('SonarQube'),
  ('Grafana'),
  ('Prometheus'),
  ('Elasticsearch / ELK Stack'),
  ('Apache Kafka'),
  ('RabbitMQ'),
  ('Nginx')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.settings_databases (name) VALUES
  ('PostgreSQL'),
  ('MySQL'),
  ('Microsoft SQL Server'),
  ('Oracle DB'),
  ('MongoDB'),
  ('Redis'),
  ('Cassandra'),
  ('DynamoDB'),
  ('Firebase Firestore'),
  ('Supabase'),
  ('SQLite'),
  ('MariaDB'),
  ('Elasticsearch'),
  ('Neo4j'),
  ('ClickHouse')
ON CONFLICT (name) DO NOTHING;
