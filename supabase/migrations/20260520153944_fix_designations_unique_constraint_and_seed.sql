/*
  # Fix settings_designations unique constraint and seed all data

  ## Problem
  settings_designations had a UNIQUE constraint on (name) alone, but the same
  designation name legitimately appears under multiple grades (e.g. "Admin" exists
  in IC01, IC02, IC03). The correct unique key is (grade_id, name).

  ## Changes
  1. Drop the existing name-only unique constraint
  2. Add (grade_id, name) composite unique constraint
  3. Add grade_id column if missing, sort_order to grades if missing
  4. Clear and re-seed all grades + designations from the Employee Title spreadsheet
*/

-- Add sort_order to grades if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings_grades' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE settings_grades ADD COLUMN sort_order int NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add grade_id FK to designations if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings_designations' AND column_name = 'grade_id'
  ) THEN
    ALTER TABLE settings_designations ADD COLUMN grade_id uuid REFERENCES settings_grades(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop old unique constraint on name alone (if exists)
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'settings_designations'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 1;
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE settings_designations DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

-- Add composite unique constraint (grade_id, name) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'settings_designations'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 2
  ) THEN
    ALTER TABLE settings_designations ADD CONSTRAINT settings_designations_grade_id_name_key UNIQUE (grade_id, name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_settings_designations_grade_id ON settings_designations(grade_id);

-- Clear and re-seed
DELETE FROM settings_designations;
DELETE FROM settings_grades;

INSERT INTO settings_grades (name, sort_order) VALUES
  ('IC01',    1),('IC02',    2),('IC03',    3),('IC04',    4),('IC05',    5),
  ('IC06',    6),('IC07',    7),('IC08',    8),('IC09',    9),('IC10',   10),
  ('IC11',   11),('IC12',   12),
  ('MGMT05', 13),('MGMT06', 14),('MGMT07', 15),('MGMT08', 16),('MGMT09', 17),
  ('MGMT10', 18),('MGMT11', 19),('MGMT12', 20),('MGMT13', 21),('MGMT14', 22),
  ('MGMT15', 23);

DO $$
DECLARE gid uuid;
BEGIN

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC01';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Admin'),(gid, 'Assistant Data Engineer'),(gid, 'Assistant Data Analyst'),
    (gid, 'Assistant Devops Engineer'),(gid, 'Assistant Software Engineer'),
    (gid, 'Assistant UX/UI Designer'),(gid, 'Junior Sales Director'),
    (gid, 'Junior RevOps Associate'),(gid, 'QA Tester'),(gid, 'Support Staff');

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC02';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Admin'),(gid, 'Associate / Intern'),(gid, 'Associate AI Engineer'),
    (gid, 'Associate Data Engineer'),(gid, 'Associate Data Analyst'),
    (gid, 'Associate QA Analyst'),(gid, 'Associate Software Devops'),
    (gid, 'Associate Software Engineer'),(gid, 'Associate UX/UI Designer'),
    (gid, 'Jr Accountant'),(gid, 'Jr Associate'),(gid, 'Junior Sales Director'),
    (gid, 'RevOps Associate');

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC03';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Software Engineer'),(gid, 'Accountant'),(gid, 'Admin'),
    (gid, 'AI Engineer'),(gid, 'Data Engineer'),(gid, 'Data Analyst'),
    (gid, 'Data AI Research Scientist'),(gid, 'Devops Engineer'),(gid, 'Release Engineer'),
    (gid, 'HR Ops Coordinator'),(gid, 'Associate Talent Acquisition Specialist'),
    (gid, 'QA Analyst'),(gid, 'Sales Director'),(gid, 'RevOps Associate'),
    (gid, 'UX/UI / Graphic Designer');

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC04';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Admin II'),(gid, 'Resourcing Specialist'),(gid, 'AI Engineer II'),
    (gid, 'Data Engineer II'),(gid, 'Data Analyst II'),(gid, 'Devops Engineer II'),
    (gid, 'HR Ops Admin'),(gid, 'Talent Acquisition Specialist'),(gid, 'HRBP'),
    (gid, 'QA Engineer'),(gid, 'Sales Director'),(gid, 'RevOps Manager'),
    (gid, 'Senior Accountant'),(gid, 'Software Engineer II'),(gid, 'UX/UI / Graphic Designer II');

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC05';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Admin II'),(gid, 'Resourcing Specialist'),(gid, 'AI Engineer III'),
    (gid, 'Data Engineer III'),(gid, 'Data Analyst III'),(gid, 'Devops Engineer III'),
    (gid, 'HR Ops Admin'),(gid, 'Talent Acquisition Specialist II'),(gid, 'HRBP II'),
    (gid, 'QA Engineer II'),(gid, 'Sales Director'),(gid, 'RevOps Manager'),
    (gid, 'Senior Accountant II'),(gid, 'Software Engineer III'),(gid, 'UX/UI / Graphic Designer III');

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC06';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Senior Admin'),(gid, 'Senior Resourcing Specialist'),(gid, 'Senior AI Engineer'),
    (gid, 'Senior Assistant Controller'),(gid, 'Senior Data Engineer'),(gid, 'Senior Data Analyst'),
    (gid, 'Senior Devops Engineer'),(gid, 'Senior HR Ops Admin'),
    (gid, 'Senior Talent Acquisition Specialist'),(gid, 'Senior HRBP'),
    (gid, 'Senior QA Engineer'),(gid, 'Senior Sales Director'),(gid, 'Senior RevOps Manager'),
    (gid, 'Senior Software Engineer'),(gid, 'Senior UX/UI'),(gid, 'Senior Graphic Designer');

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC07';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'AI Architect'),(gid, 'Data Warehouse Architect'),(gid, 'Data Architect'),
    (gid, 'Devops Architect'),(gid, 'Senior HR Ops Admin II'),
    (gid, 'Senior Talent Acquisition Specialist II'),(gid, 'HRBP II'),(gid, 'Senior II'),
    (gid, 'Senior Admin II'),(gid, 'Senior Resourcing Specialist'),
    (gid, 'Senior Assistant Controller II'),(gid, 'Senior Sales Director II'),
    (gid, 'Senior QA Engineer II'),(gid, 'Senior Graphic Designer II'),
    (gid, 'Senior UX/UI II'),(gid, 'Software Architect'),(gid, 'Solution Designer');

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC08';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Site Reliability Engineer I'),(gid, 'Staff'),(gid, 'Staff AI Engineer'),
    (gid, 'Staff Controller'),(gid, 'Staff Data Engineer I'),(gid, 'Staff Data Analyst I'),
    (gid, 'Staff HR Ops Admin'),(gid, 'Staff Talent Acquisition Specialist'),(gid, 'Staff HRBP'),
    (gid, 'Staff QA Engineer'),(gid, 'Staff Software Engineer I'),(gid, 'Staff Solution Designer'),
    (gid, 'Staff UX/UI I'),(gid, 'Staff Graphic Designer I');

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC09';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Site Reliability Engineer II'),(gid, 'Staff AI Engineer II'),
    (gid, 'Staff Data Engineer/Analyst II'),(gid, 'Staff II'),(gid, 'Staff QA Engineer II'),
    (gid, 'Staff Software Engineer II'),(gid, 'Solutions Architect'),
    (gid, 'Staff Solutions Architect'),(gid, 'Staff UX/UI II'),(gid, 'Staff Graphic Designer II');

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC10';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Principal'),(gid, 'Principal AI Engineer'),(gid, 'Principal Data Engineer I'),
    (gid, 'Principal Data Analyst I'),(gid, 'Principal Devops Engineer I'),
    (gid, 'Principal QA Engineer'),(gid, 'Principal Software Engineer'),
    (gid, 'Principal Software Engineer I'),(gid, 'Principal UX/UI I'),
    (gid, 'Principal Graphic Engineer I');

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC11';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Principal AI Engineer II'),(gid, 'Principal Data Engineer II'),
    (gid, 'Principal Data Analyst II'),(gid, 'Principal Devops Engineer II'),
    (gid, 'Principal II'),(gid, 'Principal QA Engineer II'),
    (gid, 'Principal Software Engineer II'),(gid, 'Principal UX/UI'),(gid, 'Graphic Engineer II');

  SELECT id INTO gid FROM settings_grades WHERE name = 'IC12';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'AI Fellow Engineer'),(gid, 'Data and AI Fellow'),(gid, 'Devops Fellow'),
    (gid, 'Engineering Fellow'),(gid, 'Fellow'),(gid, 'Fellow QA Engineer'),
    (gid, 'UX/UI Fellow'),(gid, 'Graphic Designer Fellow');

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT05';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Associate Lead'),(gid, 'Associate Lead, AI Engineering'),
    (gid, 'Associate Lead, Data Engineering'),(gid, 'Associate Lead, Design'),
    (gid, 'Associate Lead, Devops'),(gid, 'Associate Lead, Marketing Management'),
    (gid, 'Associate Lead, Marketing Technology'),(gid, 'Associate Lead, Marketing Analysis'),
    (gid, 'Digital Analytics'),(gid, 'Associate Lead, QA'),
    (gid, 'Associate Lead, Software Engineering'),(gid, 'Associate Lead, BA');

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT06';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Lead'),(gid, 'Team Lead'),(gid, 'Team Lead, AI Engineering'),
    (gid, 'Team Lead, Data Engineering'),(gid, 'Team Lead, Design'),
    (gid, 'Team Lead, Devops'),(gid, 'Team Lead, Marketing Management'),
    (gid, 'Team Lead, Marketing Technology'),(gid, 'Team Lead, Marketing Analysis'),
    (gid, 'Digital Analytics'),(gid, 'Team Lead, QA'),(gid, 'Team Lead, Software Engineering'),
    (gid, 'Team Lead, BA'),(gid, 'Lead Admin'),(gid, 'Resourcing Specialist Lead');

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT07';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Manager'),(gid, 'Manager UX/UI Design'),(gid, 'Manager, AI Engineering'),
    (gid, 'Manager, Data Engineering'),(gid, 'Manager, Devops'),
    (gid, 'Manager, Marketing Management'),(gid, 'Manager, Marketing Technology'),
    (gid, 'Manager, Marketing Analysis'),(gid, 'Digital Analytics'),(gid, 'Manager, QA'),
    (gid, 'Technical Manager'),(gid, 'Manager, BA'),(gid, 'Manager Admin'),
    (gid, 'Resourcing Specialist Manager');

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT08';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Senior Manager'),(gid, 'Senior Manager, AI Engineering'),
    (gid, 'Senior Manager, Data Engineering'),(gid, 'Senior Manager, Design'),
    (gid, 'Senior Manager, Devops'),(gid, 'Senior Manager, QA'),
    (gid, 'Senior Marketing Manager'),(gid, 'Senior Manager, Marketing Technology'),
    (gid, 'Marketing Analysis'),(gid, 'Digital Analytics'),
    (gid, 'Senior Technical Manager'),(gid, 'Senior Manager, BA');

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT09';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Deputy / Associate Director'),
    (gid, 'Deputy / Associate Director of AI Engineering'),
    (gid, 'Deputy / Associate Director of Data Engineering'),
    (gid, 'Deputy / Associate Director of Design'),
    (gid, 'Deputy / Associate Director of Devops'),
    (gid, 'Deputy / Associate Director of Engineering'),
    (gid, 'Deputy / Associate Director of Marketing Technology'),
    (gid, 'Digital Analytics'),
    (gid, 'Deputy / Associate Director of QA'),
    (gid, 'Deputy / Associate Director, BA');

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT10';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Director'),(gid, 'Director of AI Engineering'),(gid, 'Director of Data Engineering'),
    (gid, 'Director of Design'),(gid, 'Director of Devops'),(gid, 'Director of Engineering'),
    (gid, 'Director of Marketing Technology'),(gid, 'Director of QA'),(gid, 'Director, BA');

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT11';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Senior Director'),(gid, 'Senior Director of AI Engineering'),
    (gid, 'Senior Director of Data Engineering'),(gid, 'Senior Director of Design'),
    (gid, 'Senior Director of Devops'),(gid, 'Senior Director of Engineering'),
    (gid, 'Senior Director of Marketing Technology'),(gid, 'Senior Director of QA'),
    (gid, 'Senior Director, BA');

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT12';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'VP of AI Engineering I'),(gid, 'VP of Data and AI Engineering I'),
    (gid, 'Deputy Head of Data'),(gid, 'VP of Devops I'),(gid, 'Deputy Head of Devops'),
    (gid, 'VP of Engineering I'),(gid, 'Deputy Head of Engineering'),
    (gid, 'Deputy Head of Marketing Technology'),(gid, 'VP of QA I'),(gid, 'Deputy Head of QA'),
    (gid, 'VP of UX I'),(gid, 'Deputy Head of Design');

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT13';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'VP of AI Engineering II'),(gid, 'VP of Data and AI Engineering II'),
    (gid, 'Head of Data'),(gid, 'VP of Devops II'),(gid, 'Head of Devops'),
    (gid, 'VP of Engineering II'),(gid, 'Head of Engineering'),
    (gid, 'VP of Marketing Technology II'),(gid, 'Head of Marketing Technology'),
    (gid, 'VP of QA II'),(gid, 'Head of QA'),(gid, 'VP of UX II'),(gid, 'Head of Design');

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT14';
  INSERT INTO settings_designations (grade_id, name) VALUES
    (gid, 'Chief AI Officer'),(gid, 'Chief Data Officer'),(gid, 'Chief Quality Officer'),
    (gid, 'Chief Reliability Officer'),(gid, 'Chief Usability Officer'),
    (gid, 'CMO'),(gid, 'CTO'),(gid, 'SVP'),(gid, 'GM'),(gid, 'CXO');

  SELECT id INTO gid FROM settings_grades WHERE name = 'MGMT15';
  INSERT INTO settings_designations (grade_id, name) VALUES (gid, 'CEO');

END $$;
