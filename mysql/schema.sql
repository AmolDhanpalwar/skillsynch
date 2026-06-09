-- ============================================================================
-- HAPTIQ SKILLSYNC — COMPLETE MYSQL SCHEMA
-- ============================================================================
--
-- Converted from Supabase/PostgreSQL to MySQL 8.0+
--
-- ARCHITECTURE NOTE (updated 2026-06-09)
-- ----------------------------------------
-- All business logic has been moved out of the database into Git-tracked
-- Supabase Edge Functions (supabase/functions/). The database is a pure
-- data-persistence layer. There are no SECURITY DEFINER functions or
-- business-logic stored procedures in this schema.
--
-- Edge Functions that replace former DB procedures/triggers:
--   activate-cycle  → replaces activate_cycle_reset_forms() RPC
--   suspend-cycle   → replaces suspend_cycle() RPC
--   approve-form    → replaces trg_skill_form_approval_snapshot trigger
--   return-form     → handles form return + employee notification
--   admin-create-user     → creates Supabase Auth user + users profile row
--   admin-reset-password  → resets a user's password via service role
--
-- For standalone MySQL deployments (without Edge Functions), see the
-- "STANDALONE MYSQL" section at the bottom of this file for equivalent
-- stored procedures you can re-enable.
--
-- KEY DIFFERENCES FROM THE POSTGRESQL VERSION
-- -------------------------------------------
-- 1. UUIDs          : CHAR(36) + UUID() function
-- 2. ENUMS          : MySQL native ENUM columns (no separate type objects)
-- 3. JSONB          : JSON column type (MySQL 8 supports JSON natively)
-- 4. timestamptz    : DATETIME(6) — store all times in UTC at application level
-- 5. text[]         : JSON (MySQL has no native array type)
-- 6. numeric(4,1)   : DECIMAL(4,1)
-- 7. boolean        : TINYINT(1)  (0 = false, 1 = true)
-- 8. DEFAULT now()  : DEFAULT CURRENT_TIMESTAMP(6)
-- 9. RLS policies   : Removed — enforce access control in your API layer
-- 10. auth.users    : Replaced with standalone `auth_users` table
-- 11. SECURITY DEFINER functions : moved to Edge Functions (see above)
-- 12. ON CONFLICT DO NOTHING : INSERT IGNORE
-- 13. gen_random_uuid() : UUID()
-- 14. Partial unique index (WHERE clause) : enforced via BEFORE trigger
-- 15. updated_at auto-update : ON UPDATE CURRENT_TIMESTAMP(6)
--
-- HOW TO RUN
-- ----------
--   mysql -u <user> -p <database_name> < mysql_schema.sql
-- Or paste into MySQL Workbench / DBeaver and execute.
--
-- Requires MySQL 8.0.13+ for UUID() in DEFAULT, JSON type, and functional indexes.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';


-- ============================================================================
-- 1. AUTH_USERS  (replaces Supabase auth.users)
-- ============================================================================
-- In the original schema, public.users references auth.users(id).
-- If you use an external auth provider (Firebase, Auth0, custom JWT),
-- replace this table and adjust the FK in `users` accordingly.

CREATE TABLE IF NOT EXISTS auth_users (
  id           CHAR(36)      NOT NULL DEFAULT (UUID()),
  email        VARCHAR(320)  NOT NULL,
  created_at   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 2. SETTINGS TABLES (no FK dependencies — created first)
-- ============================================================================

-- 2a. settings_grades
CREATE TABLE IF NOT EXISTS settings_grades (
  id         CHAR(36)     NOT NULL DEFAULT (UUID()),
  name       VARCHAR(100) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME(6)  DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_grades_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2b. settings_designations
CREATE TABLE IF NOT EXISTS settings_designations (
  id         CHAR(36)     NOT NULL DEFAULT (UUID()),
  grade_id   CHAR(36)     DEFAULT NULL,
  name       VARCHAR(255) NOT NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME(6)  DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_designations_grade_name (grade_id, name),
  CONSTRAINT fk_desig_grade FOREIGN KEY (grade_id)
    REFERENCES settings_grades (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2c. settings_certifications
CREATE TABLE IF NOT EXISTS settings_certifications (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  name             VARCHAR(255) NOT NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  is_haptiq_demand TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_certs_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2d. settings_languages
CREATE TABLE IF NOT EXISTS settings_languages (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  name             VARCHAR(255) NOT NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  is_haptiq_demand TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_langs_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2e. settings_frameworks
CREATE TABLE IF NOT EXISTS settings_frameworks (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  name             VARCHAR(255) NOT NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  is_haptiq_demand TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_fwks_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2f. settings_tools
CREATE TABLE IF NOT EXISTS settings_tools (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  name             VARCHAR(255) NOT NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  is_haptiq_demand TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_tools_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2g. settings_databases
CREATE TABLE IF NOT EXISTS settings_databases (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  name             VARCHAR(255) NOT NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  is_haptiq_demand TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_dbs_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2h. settings_environments
CREATE TABLE IF NOT EXISTS settings_environments (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  name             VARCHAR(255) NOT NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  is_haptiq_demand TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_envs_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2i. settings_skill_ratings
CREATE TABLE IF NOT EXISTS settings_skill_ratings (
  id         CHAR(36)     NOT NULL DEFAULT (UUID()),
  sort_order SMALLINT     NOT NULL,
  label      VARCHAR(255) NOT NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_ratings_label (label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 3. CORE TABLES
-- ============================================================================

-- 3a. users  (mirrors auth_users with profile fields)
CREATE TABLE IF NOT EXISTS users (
  id              CHAR(36)     NOT NULL,
  email           VARCHAR(320) NOT NULL,
  full_name       VARCHAR(255) NOT NULL DEFAULT '',
  employee_number VARCHAR(50)  DEFAULT NULL,
  designation     VARCHAR(255) DEFAULT NULL,
  grade           VARCHAR(50)  DEFAULT NULL,
  role            ENUM('employee','manager','tmg','management','admin')
                               NOT NULL DEFAULT 'employee',
  manager_id      CHAR(36)     DEFAULT NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT fk_users_auth    FOREIGN KEY (id)
    REFERENCES auth_users (id) ON DELETE CASCADE,
  CONSTRAINT fk_users_manager FOREIGN KEY (manager_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3b-sso. sso_config  (DB-driven SSO feature flags; mirrors Supabase sso_config table)
--   In MySQL, RLS is replaced by application-layer access control.
--   Admin-only writes; any user (including unauthenticated) can read.
CREATE TABLE IF NOT EXISTS sso_config (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  provider    VARCHAR(50)  NOT NULL,
  enabled     TINYINT(1)   NOT NULL DEFAULT 0,
  client_id   TEXT         DEFAULT NULL,
  updated_by  CHAR(36)     DEFAULT NULL,
  updated_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                           ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_config_provider (provider),
  CONSTRAINT fk_sso_config_updated_by FOREIGN KEY (updated_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the Google provider row (disabled by default)
INSERT IGNORE INTO sso_config (provider, enabled, client_id)
  VALUES ('google', 0, NULL);


-- 3c. review_cycles
CREATE TABLE IF NOT EXISTS review_cycles (
  id                CHAR(36)     NOT NULL DEFAULT (UUID()),
  name              VARCHAR(255) NOT NULL,
  cycle_type        ENUM('mid_year','full_year','custom') NOT NULL DEFAULT 'custom',
  status            ENUM('draft','active','closed','suspended') NOT NULL DEFAULT 'draft',
  employee_deadline DATETIME(6)  DEFAULT NULL,
  manager_deadline  DATETIME(6)  DEFAULT NULL,
  triggered_at      DATETIME(6)  DEFAULT NULL,
  closed_at         DATETIME(6)  DEFAULT NULL,
  suspended_at      DATETIME(6)  DEFAULT NULL,
  suspension_reason TEXT         DEFAULT NULL,
  suspended_by      CHAR(36)     DEFAULT NULL,
  created_by        CHAR(36)     DEFAULT NULL,
  notes             TEXT         DEFAULT '',
  created_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                 ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_cycles_created_by   FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_cycles_suspended_by FOREIGN KEY (suspended_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3c. skill_forms
CREATE TABLE IF NOT EXISTS skill_forms (
  id                           CHAR(36)      NOT NULL DEFAULT (UUID()),
  employee_id                  CHAR(36)      NOT NULL,
  manager_id                   CHAR(36)      DEFAULT NULL,
  cycle_id                     CHAR(36)      DEFAULT NULL,
  status                       ENUM('draft','pending_review','returned','approved')
                                             NOT NULL DEFAULT 'draft',
  total_exp                    DECIMAL(4,1)  DEFAULT NULL,
  relevant_exp                 DECIMAL(4,1)  DEFAULT NULL,
  haptiq_exp                   DECIMAL(4,1)  DEFAULT NULL,
  current_project              TEXT          DEFAULT NULL,
  tools                        TEXT          DEFAULT NULL,
  databases                    TEXT          DEFAULT NULL,
  tools_manager_comment        TEXT          DEFAULT NULL,
  databases_manager_comment    TEXT          DEFAULT NULL,
  environments                 TEXT          DEFAULT '',
  environments_manager_comment TEXT          DEFAULT '',
  certifications               JSON          DEFAULT NULL,
  upskilling_plan              TEXT          DEFAULT NULL,
  manager_expectation_plan     TEXT          DEFAULT NULL,
  employee_name                VARCHAR(255)  DEFAULT NULL,
  employee_email               VARCHAR(320)  DEFAULT NULL,
  employee_number              VARCHAR(50)   DEFAULT NULL,
  designation                  VARCHAR(255)  DEFAULT NULL,
  grade                        VARCHAR(50)   DEFAULT NULL,
  submitted_at                 DATETIME(6)   DEFAULT NULL,
  approved_at                  DATETIME(6)   DEFAULT NULL,
  manager_review_date          DATETIME(6)   DEFAULT NULL,
  reminders_sent               INT           NOT NULL DEFAULT 0,
  created_at                   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at                   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                                             ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_sf_employee FOREIGN KEY (employee_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sf_manager  FOREIGN KEY (manager_id)
    REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_sf_cycle    FOREIGN KEY (cycle_id)
    REFERENCES review_cycles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3d. skill_items
CREATE TABLE IF NOT EXISTS skill_items (
  id              CHAR(36)     NOT NULL DEFAULT (UUID()),
  form_id         CHAR(36)     NOT NULL,
  category        ENUM('language','framework','environment') NOT NULL,
  name            VARCHAR(255) NOT NULL,
  employee_rating SMALLINT     DEFAULT NULL,
  manager_rating  SMALLINT     DEFAULT NULL,
  manager_comment TEXT         NOT NULL DEFAULT '',
  sort_order      SMALLINT     NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_si_form FOREIGN KEY (form_id)
    REFERENCES skill_forms (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3e. skill_form_versions  (immutable approval snapshots — append only)
CREATE TABLE IF NOT EXISTS skill_form_versions (
  id          CHAR(36)    NOT NULL DEFAULT (UUID()),
  cycle_id    CHAR(36)    NOT NULL,
  form_id     CHAR(36)    DEFAULT NULL,
  employee_id CHAR(36)    NOT NULL,
  snapshot    JSON        NOT NULL,
  approved_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  approved_by CHAR(36)    DEFAULT NULL,
  created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_version_employee_cycle (employee_id, cycle_id),
  CONSTRAINT fk_sfv_cycle    FOREIGN KEY (cycle_id)
    REFERENCES review_cycles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_sfv_form     FOREIGN KEY (form_id)
    REFERENCES skill_forms (id) ON DELETE SET NULL,
  CONSTRAINT fk_sfv_employee FOREIGN KEY (employee_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sfv_approver FOREIGN KEY (approved_by)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 3f. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id    CHAR(36)     NOT NULL,
  type       VARCHAR(100) NOT NULL,
  message    TEXT         NOT NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  form_id    CHAR(36)     DEFAULT NULL,
  created_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_form FOREIGN KEY (form_id)
    REFERENCES skill_forms (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX idx_users_manager_id               ON users                (manager_id);
CREATE INDEX idx_users_role                     ON users                (role);
CREATE INDEX idx_skill_forms_employee_id        ON skill_forms          (employee_id);
CREATE INDEX idx_skill_forms_manager_id         ON skill_forms          (manager_id);
CREATE INDEX idx_skill_forms_status             ON skill_forms          (status);
CREATE INDEX idx_skill_forms_cycle_id           ON skill_forms          (cycle_id);
CREATE INDEX idx_skill_items_form_id            ON skill_items          (form_id);
CREATE INDEX idx_skill_items_form_category      ON skill_items          (form_id, category);
CREATE INDEX idx_notifications_user_id          ON notifications        (user_id);
CREATE INDEX idx_notifications_is_read          ON notifications        (is_read);
CREATE INDEX idx_settings_designations_grade_id ON settings_designations (grade_id);
CREATE INDEX idx_sfv_cycle_id                   ON skill_form_versions  (cycle_id);
CREATE INDEX idx_sfv_employee_id                ON skill_form_versions  (employee_id);
CREATE INDEX idx_review_cycles_status           ON review_cycles        (status);
CREATE INDEX idx_sso_config_provider             ON sso_config           (provider);


-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

DELIMITER $$

-- 5a. Auto-create user profile when auth_users is inserted
--     (mirrors Supabase handle_new_user() trigger)
CREATE TRIGGER trg_handle_new_auth_user
AFTER INSERT ON auth_users
FOR EACH ROW
BEGIN
  INSERT IGNORE INTO users (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, SUBSTRING_INDEX(NEW.email, '@', 1), 'employee');
END$$


-- 5b. Enforce at most one active cycle at a time
--     (replaces PostgreSQL partial unique index WHERE status = 'active')
CREATE TRIGGER trg_one_active_cycle_insert
BEFORE INSERT ON review_cycles
FOR EACH ROW
BEGIN
  IF NEW.status = 'active' THEN
    IF (SELECT COUNT(*) FROM review_cycles WHERE status = 'active') > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only one review cycle can be active at a time.';
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_one_active_cycle_update
BEFORE UPDATE ON review_cycles
FOR EACH ROW
BEGIN
  IF NEW.status = 'active' AND OLD.status <> 'active' THEN
    IF (SELECT COUNT(*) FROM review_cycles
        WHERE status = 'active' AND id <> NEW.id) > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only one review cycle can be active at a time.';
    END IF;
  END IF;
END$$


-- 5c. Auto-snapshot on skill_form approval
--     NOTE: This trigger was REMOVED as part of the architecture refactor
--     (migration: 20260609000001_drop_db_business_logic).
--     Approval snapshot creation is now handled entirely by the `approve-form`
--     Edge Function, which runs with service-role credentials and inserts into
--     skill_form_versions after setting status = 'approved' on skill_forms.
--     If you port this schema to a standalone MySQL deployment (without Edge
--     Functions), re-add this trigger and the approve_form() stored procedure
--     below to maintain snapshot integrity.

DELIMITER ;


-- ============================================================================
-- 6. SEED DATA — Settings Tables
-- ============================================================================

-- Skill Ratings
INSERT IGNORE INTO settings_skill_ratings (id, sort_order, label) VALUES
  (UUID(), 1, '1 — Only Training / Certification'),
  (UUID(), 2, '2 — Basic Work Knowledge'),
  (UUID(), 3, '3 — Intermediate'),
  (UUID(), 4, '4 — Proficient'),
  (UUID(), 5, '5 — Expert');

-- Certifications
INSERT IGNORE INTO settings_certifications (id, name) VALUES
  (UUID(), 'AWS Certified Solutions Architect'),
  (UUID(), 'AWS Certified Developer'),
  (UUID(), 'AWS Certified DevOps Engineer'),
  (UUID(), 'Google Cloud Professional Cloud Architect'),
  (UUID(), 'Google Cloud Associate Cloud Engineer'),
  (UUID(), 'Microsoft Azure Administrator (AZ-104)'),
  (UUID(), 'Microsoft Azure Developer (AZ-204)'),
  (UUID(), 'Certified Kubernetes Administrator (CKA)'),
  (UUID(), 'Certified Kubernetes Application Developer (CKAD)'),
  (UUID(), 'HashiCorp Certified Terraform Associate'),
  (UUID(), 'PMP - Project Management Professional'),
  (UUID(), 'Scrum Master Certification (CSM)'),
  (UUID(), 'Oracle Certified Java Programmer'),
  (UUID(), 'CompTIA Security+'),
  (UUID(), 'Certified Ethical Hacker (CEH)');

-- Languages
INSERT IGNORE INTO settings_languages (id, name) VALUES
  (UUID(),'JavaScript'),(UUID(),'TypeScript'),(UUID(),'Python'),(UUID(),'Java'),
  (UUID(),'C#'),(UUID(),'C++'),(UUID(),'Go'),(UUID(),'Rust'),(UUID(),'Kotlin'),
  (UUID(),'Swift'),(UUID(),'PHP'),(UUID(),'Ruby'),(UUID(),'Scala'),(UUID(),'R'),
  (UUID(),'Dart'),(UUID(),'SQL'),(UUID(),'Shell / Bash');

-- Frameworks
INSERT IGNORE INTO settings_frameworks (id, name) VALUES
  (UUID(),'React'),(UUID(),'Angular'),(UUID(),'Vue.js'),(UUID(),'Next.js'),
  (UUID(),'Nuxt.js'),(UUID(),'Node.js'),(UUID(),'Express.js'),(UUID(),'NestJS'),
  (UUID(),'Spring Boot'),(UUID(),'Django'),(UUID(),'FastAPI'),(UUID(),'Flask'),
  (UUID(),'.NET / ASP.NET Core'),(UUID(),'Laravel'),(UUID(),'Ruby on Rails'),
  (UUID(),'Flutter'),(UUID(),'React Native'),(UUID(),'GraphQL'),(UUID(),'gRPC');

-- Tools
INSERT IGNORE INTO settings_tools (id, name) VALUES
  (UUID(),'Docker'),(UUID(),'Kubernetes'),(UUID(),'Jenkins'),(UUID(),'GitHub Actions'),
  (UUID(),'GitLab CI/CD'),(UUID(),'Terraform'),(UUID(),'Ansible'),(UUID(),'Helm'),
  (UUID(),'Jira'),(UUID(),'Confluence'),(UUID(),'Postman'),(UUID(),'VS Code'),
  (UUID(),'IntelliJ IDEA'),(UUID(),'SonarQube'),(UUID(),'Grafana'),(UUID(),'Prometheus'),
  (UUID(),'Elasticsearch / ELK Stack'),(UUID(),'Apache Kafka'),(UUID(),'RabbitMQ'),
  (UUID(),'Nginx');

-- Databases
INSERT IGNORE INTO settings_databases (id, name) VALUES
  (UUID(),'PostgreSQL'),(UUID(),'MySQL'),(UUID(),'Microsoft SQL Server'),
  (UUID(),'Oracle DB'),(UUID(),'MongoDB'),(UUID(),'Redis'),(UUID(),'Cassandra'),
  (UUID(),'DynamoDB'),(UUID(),'Firebase Firestore'),(UUID(),'Supabase'),
  (UUID(),'SQLite'),(UUID(),'MariaDB'),(UUID(),'Elasticsearch'),(UUID(),'Neo4j'),
  (UUID(),'ClickHouse');

-- Environments
INSERT IGNORE INTO settings_environments (id, name) VALUES
  (UUID(),'AWS'),(UUID(),'Azure'),(UUID(),'GCP'),(UUID(),'AWS S3'),(UUID(),'S3'),
  (UUID(),'ECR'),(UUID(),'ECS'),(UUID(),'CDN'),(UUID(),'Kubernetes'),(UUID(),'Docker'),
  (UUID(),'Firebase'),(UUID(),'Apache'),(UUID(),'Nginx'),(UUID(),'Load Balancers'),
  (UUID(),'Auto-scaling groups'),(UUID(),'Stage / Staging'),(UUID(),'Drupal'),
  (UUID(),'WordPress'),(UUID(),'Webflow'),(UUID(),'Shopify'),(UUID(),'Meta/Facebook'),
  (UUID(),'Android'),(UUID(),'Android Studio'),(UUID(),'iOS'),(UUID(),'CMS'),
  (UUID(),'AWS Secrets Manager'),(UUID(),'Vault');


-- ============================================================================
-- 8. SEED DATA — Grades & Designations
-- ============================================================================

-- Grades
INSERT IGNORE INTO settings_grades (id, name, sort_order) VALUES
  (UUID(),'IC01', 1),(UUID(),'IC02', 2),(UUID(),'IC03', 3),(UUID(),'IC04', 4),
  (UUID(),'IC05', 5),(UUID(),'IC06', 6),(UUID(),'IC07', 7),(UUID(),'IC08', 8),
  (UUID(),'IC09', 9),(UUID(),'IC10',10),(UUID(),'IC11',11),(UUID(),'IC12',12),
  (UUID(),'MGMT05',13),(UUID(),'MGMT06',14),(UUID(),'MGMT07',15),(UUID(),'MGMT08',16),
  (UUID(),'MGMT09',17),(UUID(),'MGMT10',18),(UUID(),'MGMT11',19),(UUID(),'MGMT12',20),
  (UUID(),'MGMT13',21),(UUID(),'MGMT14',22),(UUID(),'MGMT15',23);

-- Designations (uses JOIN to resolve grade_id by name — avoids hardcoded UUIDs)
INSERT IGNORE INTO settings_designations (id, grade_id, name)
SELECT UUID(), g.id, d.name
FROM settings_grades g
JOIN (
  SELECT 'IC01' AS grade, 'Admin'                            AS name UNION ALL
  SELECT 'IC01','Assistant Data Engineer'                            UNION ALL
  SELECT 'IC01','Assistant Data Analyst'                             UNION ALL
  SELECT 'IC01','Assistant Devops Engineer'                          UNION ALL
  SELECT 'IC01','Assistant Software Engineer'                        UNION ALL
  SELECT 'IC01','Assistant UX/UI Designer'                           UNION ALL
  SELECT 'IC01','Junior Sales Director'                              UNION ALL
  SELECT 'IC01','Junior RevOps Associate'                            UNION ALL
  SELECT 'IC01','QA Tester'                                          UNION ALL
  SELECT 'IC01','Support Staff'                                      UNION ALL
  SELECT 'IC02','Admin'                                              UNION ALL
  SELECT 'IC02','Associate / Intern'                                 UNION ALL
  SELECT 'IC02','Associate AI Engineer'                              UNION ALL
  SELECT 'IC02','Associate Data Engineer'                            UNION ALL
  SELECT 'IC02','Associate Data Analyst'                             UNION ALL
  SELECT 'IC02','Associate QA Analyst'                               UNION ALL
  SELECT 'IC02','Associate Software Devops'                          UNION ALL
  SELECT 'IC02','Associate Software Engineer'                        UNION ALL
  SELECT 'IC02','Associate UX/UI Designer'                           UNION ALL
  SELECT 'IC02','Jr Accountant'                                      UNION ALL
  SELECT 'IC02','Jr Associate'                                       UNION ALL
  SELECT 'IC02','Junior Sales Director'                              UNION ALL
  SELECT 'IC02','RevOps Associate'                                   UNION ALL
  SELECT 'IC03','Software Engineer'                                  UNION ALL
  SELECT 'IC03','Accountant'                                         UNION ALL
  SELECT 'IC03','Admin'                                              UNION ALL
  SELECT 'IC03','AI Engineer'                                        UNION ALL
  SELECT 'IC03','Data Engineer'                                      UNION ALL
  SELECT 'IC03','Data Analyst'                                       UNION ALL
  SELECT 'IC03','Data AI Research Scientist'                         UNION ALL
  SELECT 'IC03','Devops Engineer'                                    UNION ALL
  SELECT 'IC03','Release Engineer'                                   UNION ALL
  SELECT 'IC03','HR Ops Coordinator'                                 UNION ALL
  SELECT 'IC03','Associate Talent Acquisition Specialist'            UNION ALL
  SELECT 'IC03','QA Analyst'                                         UNION ALL
  SELECT 'IC03','Sales Director'                                     UNION ALL
  SELECT 'IC03','RevOps Associate'                                   UNION ALL
  SELECT 'IC03','UX/UI / Graphic Designer'                           UNION ALL
  SELECT 'IC04','Admin II'                                           UNION ALL
  SELECT 'IC04','Resourcing Specialist'                              UNION ALL
  SELECT 'IC04','AI Engineer II'                                     UNION ALL
  SELECT 'IC04','Data Engineer II'                                   UNION ALL
  SELECT 'IC04','Data Analyst II'                                    UNION ALL
  SELECT 'IC04','Devops Engineer II'                                 UNION ALL
  SELECT 'IC04','HR Ops Admin'                                       UNION ALL
  SELECT 'IC04','Talent Acquisition Specialist'                      UNION ALL
  SELECT 'IC04','HRBP'                                               UNION ALL
  SELECT 'IC04','QA Engineer'                                        UNION ALL
  SELECT 'IC04','Sales Director'                                     UNION ALL
  SELECT 'IC04','RevOps Manager'                                     UNION ALL
  SELECT 'IC04','Senior Accountant'                                  UNION ALL
  SELECT 'IC04','Software Engineer II'                               UNION ALL
  SELECT 'IC04','UX/UI / Graphic Designer II'                        UNION ALL
  SELECT 'IC05','Admin II'                                           UNION ALL
  SELECT 'IC05','Resourcing Specialist'                              UNION ALL
  SELECT 'IC05','AI Engineer III'                                    UNION ALL
  SELECT 'IC05','Data Engineer III'                                  UNION ALL
  SELECT 'IC05','Data Analyst III'                                   UNION ALL
  SELECT 'IC05','Devops Engineer III'                                UNION ALL
  SELECT 'IC05','HR Ops Admin'                                       UNION ALL
  SELECT 'IC05','Talent Acquisition Specialist II'                   UNION ALL
  SELECT 'IC05','HRBP II'                                            UNION ALL
  SELECT 'IC05','QA Engineer II'                                     UNION ALL
  SELECT 'IC05','Sales Director'                                     UNION ALL
  SELECT 'IC05','RevOps Manager'                                     UNION ALL
  SELECT 'IC05','Senior Accountant II'                               UNION ALL
  SELECT 'IC05','Software Engineer III'                              UNION ALL
  SELECT 'IC05','UX/UI / Graphic Designer III'                       UNION ALL
  SELECT 'IC06','Senior Admin'                                       UNION ALL
  SELECT 'IC06','Senior Resourcing Specialist'                       UNION ALL
  SELECT 'IC06','Senior AI Engineer'                                 UNION ALL
  SELECT 'IC06','Senior Assistant Controller'                        UNION ALL
  SELECT 'IC06','Senior Data Engineer'                               UNION ALL
  SELECT 'IC06','Senior Data Analyst'                                UNION ALL
  SELECT 'IC06','Senior Devops Engineer'                             UNION ALL
  SELECT 'IC06','Senior HR Ops Admin'                                UNION ALL
  SELECT 'IC06','Senior Talent Acquisition Specialist'               UNION ALL
  SELECT 'IC06','Senior HRBP'                                        UNION ALL
  SELECT 'IC06','Senior QA Engineer'                                 UNION ALL
  SELECT 'IC06','Senior Sales Director'                              UNION ALL
  SELECT 'IC06','Senior RevOps Manager'                              UNION ALL
  SELECT 'IC06','Senior Software Engineer'                           UNION ALL
  SELECT 'IC06','Senior UX/UI'                                       UNION ALL
  SELECT 'IC06','Senior Graphic Designer'                            UNION ALL
  SELECT 'IC07','AI Architect'                                       UNION ALL
  SELECT 'IC07','Data Warehouse Architect'                           UNION ALL
  SELECT 'IC07','Data Architect'                                     UNION ALL
  SELECT 'IC07','Devops Architect'                                   UNION ALL
  SELECT 'IC07','Senior HR Ops Admin II'                             UNION ALL
  SELECT 'IC07','Senior Talent Acquisition Specialist II'            UNION ALL
  SELECT 'IC07','HRBP II'                                            UNION ALL
  SELECT 'IC07','Senior II'                                          UNION ALL
  SELECT 'IC07','Senior Admin II'                                    UNION ALL
  SELECT 'IC07','Senior Resourcing Specialist'                       UNION ALL
  SELECT 'IC07','Senior Assistant Controller II'                     UNION ALL
  SELECT 'IC07','Senior Sales Director II'                           UNION ALL
  SELECT 'IC07','Senior QA Engineer II'                              UNION ALL
  SELECT 'IC07','Senior Graphic Designer II'                         UNION ALL
  SELECT 'IC07','Senior UX/UI II'                                    UNION ALL
  SELECT 'IC07','Software Architect'                                 UNION ALL
  SELECT 'IC07','Solution Designer'                                  UNION ALL
  SELECT 'IC08','Site Reliability Engineer I'                        UNION ALL
  SELECT 'IC08','Staff'                                              UNION ALL
  SELECT 'IC08','Staff AI Engineer'                                  UNION ALL
  SELECT 'IC08','Staff Controller'                                   UNION ALL
  SELECT 'IC08','Staff Data Engineer I'                              UNION ALL
  SELECT 'IC08','Staff Data Analyst I'                               UNION ALL
  SELECT 'IC08','Staff HR Ops Admin'                                 UNION ALL
  SELECT 'IC08','Staff Talent Acquisition Specialist'                UNION ALL
  SELECT 'IC08','Staff HRBP'                                         UNION ALL
  SELECT 'IC08','Staff QA Engineer'                                  UNION ALL
  SELECT 'IC08','Staff Software Engineer I'                          UNION ALL
  SELECT 'IC08','Staff Solution Designer'                            UNION ALL
  SELECT 'IC08','Staff UX/UI I'                                      UNION ALL
  SELECT 'IC08','Staff Graphic Designer I'                           UNION ALL
  SELECT 'IC09','Site Reliability Engineer II'                       UNION ALL
  SELECT 'IC09','Staff AI Engineer II'                               UNION ALL
  SELECT 'IC09','Staff Data Engineer/Analyst II'                     UNION ALL
  SELECT 'IC09','Staff II'                                           UNION ALL
  SELECT 'IC09','Staff QA Engineer II'                               UNION ALL
  SELECT 'IC09','Staff Software Engineer II'                         UNION ALL
  SELECT 'IC09','Solutions Architect'                                UNION ALL
  SELECT 'IC09','Staff Solutions Architect'                          UNION ALL
  SELECT 'IC09','Staff UX/UI II'                                     UNION ALL
  SELECT 'IC09','Staff Graphic Designer II'                          UNION ALL
  SELECT 'IC10','Principal'                                          UNION ALL
  SELECT 'IC10','Principal AI Engineer'                              UNION ALL
  SELECT 'IC10','Principal Data Engineer I'                          UNION ALL
  SELECT 'IC10','Principal Data Analyst I'                           UNION ALL
  SELECT 'IC10','Principal Devops Engineer I'                        UNION ALL
  SELECT 'IC10','Principal QA Engineer'                              UNION ALL
  SELECT 'IC10','Principal Software Engineer'                        UNION ALL
  SELECT 'IC10','Principal Software Engineer I'                      UNION ALL
  SELECT 'IC10','Principal UX/UI I'                                  UNION ALL
  SELECT 'IC10','Principal Graphic Engineer I'                       UNION ALL
  SELECT 'IC11','Principal AI Engineer II'                           UNION ALL
  SELECT 'IC11','Principal Data Engineer II'                         UNION ALL
  SELECT 'IC11','Principal Data Analyst II'                          UNION ALL
  SELECT 'IC11','Principal Devops Engineer II'                       UNION ALL
  SELECT 'IC11','Principal II'                                       UNION ALL
  SELECT 'IC11','Principal QA Engineer II'                           UNION ALL
  SELECT 'IC11','Principal Software Engineer II'                     UNION ALL
  SELECT 'IC11','Principal UX/UI'                                    UNION ALL
  SELECT 'IC11','Graphic Engineer II'                                UNION ALL
  SELECT 'IC12','AI Fellow Engineer'                                 UNION ALL
  SELECT 'IC12','Data and AI Fellow'                                 UNION ALL
  SELECT 'IC12','Devops Fellow'                                      UNION ALL
  SELECT 'IC12','Engineering Fellow'                                 UNION ALL
  SELECT 'IC12','Fellow'                                             UNION ALL
  SELECT 'IC12','Fellow QA Engineer'                                 UNION ALL
  SELECT 'IC12','UX/UI Fellow'                                       UNION ALL
  SELECT 'IC12','Graphic Designer Fellow'                            UNION ALL
  SELECT 'MGMT05','Associate Lead'                                   UNION ALL
  SELECT 'MGMT05','Associate Lead, AI Engineering'                   UNION ALL
  SELECT 'MGMT05','Associate Lead, Data Engineering'                 UNION ALL
  SELECT 'MGMT05','Associate Lead, Design'                           UNION ALL
  SELECT 'MGMT05','Associate Lead, Devops'                           UNION ALL
  SELECT 'MGMT05','Associate Lead, Marketing Management'             UNION ALL
  SELECT 'MGMT05','Associate Lead, Marketing Technology'             UNION ALL
  SELECT 'MGMT05','Associate Lead, Marketing Analysis'               UNION ALL
  SELECT 'MGMT05','Digital Analytics'                                UNION ALL
  SELECT 'MGMT05','Associate Lead, QA'                               UNION ALL
  SELECT 'MGMT05','Associate Lead, Software Engineering'             UNION ALL
  SELECT 'MGMT05','Associate Lead, BA'                               UNION ALL
  SELECT 'MGMT06','Lead'                                             UNION ALL
  SELECT 'MGMT06','Team Lead'                                        UNION ALL
  SELECT 'MGMT06','Team Lead, AI Engineering'                        UNION ALL
  SELECT 'MGMT06','Team Lead, Data Engineering'                      UNION ALL
  SELECT 'MGMT06','Team Lead, Design'                                UNION ALL
  SELECT 'MGMT06','Team Lead, Devops'                                UNION ALL
  SELECT 'MGMT06','Team Lead, Marketing Management'                  UNION ALL
  SELECT 'MGMT06','Team Lead, Marketing Technology'                  UNION ALL
  SELECT 'MGMT06','Team Lead, Marketing Analysis'                    UNION ALL
  SELECT 'MGMT06','Digital Analytics'                                UNION ALL
  SELECT 'MGMT06','Team Lead, QA'                                    UNION ALL
  SELECT 'MGMT06','Team Lead, Software Engineering'                  UNION ALL
  SELECT 'MGMT06','Team Lead, BA'                                    UNION ALL
  SELECT 'MGMT06','Lead Admin'                                       UNION ALL
  SELECT 'MGMT06','Resourcing Specialist Lead'                       UNION ALL
  SELECT 'MGMT07','Manager'                                          UNION ALL
  SELECT 'MGMT07','Manager UX/UI Design'                             UNION ALL
  SELECT 'MGMT07','Manager, AI Engineering'                          UNION ALL
  SELECT 'MGMT07','Manager, Data Engineering'                        UNION ALL
  SELECT 'MGMT07','Manager, Devops'                                  UNION ALL
  SELECT 'MGMT07','Manager, Marketing Management'                    UNION ALL
  SELECT 'MGMT07','Manager, Marketing Technology'                    UNION ALL
  SELECT 'MGMT07','Manager, Marketing Analysis'                      UNION ALL
  SELECT 'MGMT07','Digital Analytics'                                UNION ALL
  SELECT 'MGMT07','Manager, QA'                                      UNION ALL
  SELECT 'MGMT07','Technical Manager'                                UNION ALL
  SELECT 'MGMT07','Manager, BA'                                      UNION ALL
  SELECT 'MGMT07','Manager Admin'                                    UNION ALL
  SELECT 'MGMT07','Resourcing Specialist Manager'                    UNION ALL
  SELECT 'MGMT08','Senior Manager'                                   UNION ALL
  SELECT 'MGMT08','Senior Manager, AI Engineering'                   UNION ALL
  SELECT 'MGMT08','Senior Manager, Data Engineering'                 UNION ALL
  SELECT 'MGMT08','Senior Manager, Design'                           UNION ALL
  SELECT 'MGMT08','Senior Manager, Devops'                           UNION ALL
  SELECT 'MGMT08','Senior Manager, QA'                               UNION ALL
  SELECT 'MGMT08','Senior Marketing Manager'                         UNION ALL
  SELECT 'MGMT08','Senior Manager, Marketing Technology'             UNION ALL
  SELECT 'MGMT08','Marketing Analysis'                               UNION ALL
  SELECT 'MGMT08','Digital Analytics'                                UNION ALL
  SELECT 'MGMT08','Senior Technical Manager'                         UNION ALL
  SELECT 'MGMT08','Senior Manager, BA'                               UNION ALL
  SELECT 'MGMT09','Deputy / Associate Director'                      UNION ALL
  SELECT 'MGMT09','Deputy / Associate Director of AI Engineering'    UNION ALL
  SELECT 'MGMT09','Deputy / Associate Director of Data Engineering'  UNION ALL
  SELECT 'MGMT09','Deputy / Associate Director of Design'            UNION ALL
  SELECT 'MGMT09','Deputy / Associate Director of Devops'            UNION ALL
  SELECT 'MGMT09','Deputy / Associate Director of Engineering'       UNION ALL
  SELECT 'MGMT09','Deputy / Associate Director of Marketing Technology' UNION ALL
  SELECT 'MGMT09','Digital Analytics'                                UNION ALL
  SELECT 'MGMT09','Deputy / Associate Director of QA'                UNION ALL
  SELECT 'MGMT09','Deputy / Associate Director, BA'                  UNION ALL
  SELECT 'MGMT10','Director'                                         UNION ALL
  SELECT 'MGMT10','Director of AI Engineering'                       UNION ALL
  SELECT 'MGMT10','Director of Data Engineering'                     UNION ALL
  SELECT 'MGMT10','Director of Design'                               UNION ALL
  SELECT 'MGMT10','Director of Devops'                               UNION ALL
  SELECT 'MGMT10','Director of Engineering'                          UNION ALL
  SELECT 'MGMT10','Director of Marketing Technology'                 UNION ALL
  SELECT 'MGMT10','Director of QA'                                   UNION ALL
  SELECT 'MGMT10','Director, BA'                                     UNION ALL
  SELECT 'MGMT11','Senior Director'                                  UNION ALL
  SELECT 'MGMT11','Senior Director of AI Engineering'                UNION ALL
  SELECT 'MGMT11','Senior Director of Data Engineering'              UNION ALL
  SELECT 'MGMT11','Senior Director of Design'                        UNION ALL
  SELECT 'MGMT11','Senior Director of Devops'                        UNION ALL
  SELECT 'MGMT11','Senior Director of Engineering'                   UNION ALL
  SELECT 'MGMT11','Senior Director of Marketing Technology'          UNION ALL
  SELECT 'MGMT11','Senior Director of QA'                            UNION ALL
  SELECT 'MGMT11','Senior Director, BA'                              UNION ALL
  SELECT 'MGMT12','VP of AI Engineering I'                           UNION ALL
  SELECT 'MGMT12','VP of Data and AI Engineering I'                  UNION ALL
  SELECT 'MGMT12','Deputy Head of Data'                              UNION ALL
  SELECT 'MGMT12','VP of Devops I'                                   UNION ALL
  SELECT 'MGMT12','Deputy Head of Devops'                            UNION ALL
  SELECT 'MGMT12','VP of Engineering I'                              UNION ALL
  SELECT 'MGMT12','Deputy Head of Engineering'                       UNION ALL
  SELECT 'MGMT12','Deputy Head of Marketing Technology'              UNION ALL
  SELECT 'MGMT12','VP of QA I'                                       UNION ALL
  SELECT 'MGMT12','Deputy Head of QA'                                UNION ALL
  SELECT 'MGMT12','VP of UX I'                                       UNION ALL
  SELECT 'MGMT12','Deputy Head of Design'                            UNION ALL
  SELECT 'MGMT13','VP of AI Engineering II'                          UNION ALL
  SELECT 'MGMT13','VP of Data and AI Engineering II'                 UNION ALL
  SELECT 'MGMT13','Head of Data'                                     UNION ALL
  SELECT 'MGMT13','VP of Devops II'                                  UNION ALL
  SELECT 'MGMT13','Head of Devops'                                   UNION ALL
  SELECT 'MGMT13','VP of Engineering II'                             UNION ALL
  SELECT 'MGMT13','Head of Engineering'                              UNION ALL
  SELECT 'MGMT13','VP of Marketing Technology II'                    UNION ALL
  SELECT 'MGMT13','Head of Marketing Technology'                     UNION ALL
  SELECT 'MGMT13','VP of QA II'                                      UNION ALL
  SELECT 'MGMT13','Head of QA'                                       UNION ALL
  SELECT 'MGMT13','VP of UX II'                                      UNION ALL
  SELECT 'MGMT13','Head of Design'                                   UNION ALL
  SELECT 'MGMT14','Chief AI Officer'                                 UNION ALL
  SELECT 'MGMT14','Chief Data Officer'                               UNION ALL
  SELECT 'MGMT14','Chief Quality Officer'                            UNION ALL
  SELECT 'MGMT14','Chief Reliability Officer'                        UNION ALL
  SELECT 'MGMT14','Chief Usability Officer'                          UNION ALL
  SELECT 'MGMT14','CMO'                                              UNION ALL
  SELECT 'MGMT14','CTO'                                              UNION ALL
  SELECT 'MGMT14','SVP'                                              UNION ALL
  SELECT 'MGMT14','GM'                                               UNION ALL
  SELECT 'MGMT14','CXO'                                              UNION ALL
  SELECT 'MGMT15','CEO'
) AS d ON g.name = d.grade;


-- ============================================================================
-- 9. RE-ENABLE FOREIGN KEY CHECKS
-- ============================================================================

SET foreign_key_checks = 1;


-- ============================================================================
-- END OF MYSQL SCHEMA
-- ============================================================================
--
-- MIGRATION NOTES FOR RUNNING THIS APP AGAINST MYSQL
-- ---------------------------------------------------
-- This frontend uses @supabase/supabase-js which provides a REST API,
-- JWT auth, and Row Level Security out of the box. To wire up MySQL you need:
--
--   1. REST API layer  — Node.js + Express + mysql2 (or Prisma / TypeORM)
--   2. Authentication  — JWT middleware + bcrypt password hashing in auth_users
--   3. Access control  — replace RLS with API-level middleware role checks
--   4. Edge Functions  — replace supabase/functions/ with Express routes
--                        (activate-cycle, suspend-cycle, approve-form,
--                         return-form, admin-create-user, admin-reset-password)
--
-- The MySQL schema above is a 100% faithful data model translation.
--
-- ============================================================================
-- STANDALONE MYSQL — EQUIVALENT STORED PROCEDURES
-- (uncomment and run these if you are NOT using Supabase Edge Functions)
-- ============================================================================
--
-- DELIMITER $$
--
-- -- Activate a cycle: mark it active and reset all forms to draft
-- CREATE PROCEDURE activate_cycle(IN p_cycle_id CHAR(36))
-- BEGIN
--   UPDATE review_cycles
--   SET status = 'active', triggered_at = CURRENT_TIMESTAMP(6)
--   WHERE id = p_cycle_id AND status = 'draft';
--
--   UPDATE skill_forms
--   SET cycle_id = p_cycle_id, status = 'draft',
--       submitted_at = NULL, approved_at = NULL,
--       manager_review_date = NULL, updated_at = CURRENT_TIMESTAMP(6);
-- END$$
--
--
-- -- Suspend a cycle: mark it suspended and purge non-approved forms/items
-- CREATE PROCEDURE suspend_cycle(
--   IN p_cycle_id CHAR(36),
--   IN p_reason   TEXT,
--   IN p_user_id  CHAR(36)
-- )
-- BEGIN
--   UPDATE review_cycles
--   SET status = 'suspended', suspended_at = CURRENT_TIMESTAMP(6),
--       suspension_reason = p_reason, suspended_by = p_user_id
--   WHERE id = p_cycle_id AND status = 'active';
--
--   DELETE si FROM skill_items si
--   INNER JOIN skill_forms sf ON si.form_id = sf.id
--   WHERE sf.cycle_id = p_cycle_id AND sf.status <> 'approved';
--
--   DELETE FROM skill_forms
--   WHERE cycle_id = p_cycle_id AND status <> 'approved';
-- END$$
--
--
-- -- Approve a form: set status, create immutable snapshot
-- -- (skill_items must be saved before calling this procedure)
-- CREATE PROCEDURE approve_form(
--   IN p_form_id    CHAR(36),
--   IN p_cycle_id   CHAR(36),
--   IN p_employee_id CHAR(36),
--   IN p_approved_by CHAR(36)
-- )
-- BEGIN
--   DECLARE v_exists INT DEFAULT 0;
--   UPDATE skill_forms
--   SET status = 'approved', approved_at = CURRENT_TIMESTAMP(6)
--   WHERE id = p_form_id;
--
--   SELECT COUNT(*) INTO v_exists FROM skill_form_versions
--   WHERE employee_id = p_employee_id AND cycle_id = p_cycle_id;
--
--   IF v_exists = 0 THEN
--     INSERT INTO skill_form_versions
--       (id, cycle_id, form_id, employee_id, snapshot, approved_at, approved_by, created_at)
--     SELECT
--       UUID(), p_cycle_id, p_form_id, p_employee_id,
--       JSON_OBJECT(
--         'id', sf.id, 'employee_id', sf.employee_id, 'cycle_id', sf.cycle_id,
--         'status', 'approved', 'employee_name', sf.employee_name,
--         'grade', sf.grade, 'designation', sf.designation,
--         'total_exp', sf.total_exp, 'relevant_exp', sf.relevant_exp,
--         'haptiq_exp', sf.haptiq_exp, 'current_project', sf.current_project,
--         'tools', sf.tools, 'databases', sf.databases,
--         'certifications', sf.certifications,
--         'upskilling_plan', sf.upskilling_plan,
--         'manager_expectation_plan', sf.manager_expectation_plan,
--         'tools_manager_comment', sf.tools_manager_comment,
--         'databases_manager_comment', sf.databases_manager_comment,
--         'environments_manager_comment', sf.environments_manager_comment,
--         'submitted_at', sf.submitted_at, 'approved_at', sf.approved_at
--       ),
--       CURRENT_TIMESTAMP(6), p_approved_by, CURRENT_TIMESTAMP(6)
--     FROM skill_forms sf WHERE sf.id = p_form_id;
--   END IF;
-- END$$
--
-- DELIMITER ;
-- ============================================================================
