-- ============================================================================
-- HAPTIQ SKILLSYNC — MYSQL DATA DUMP
-- ============================================================================
--
-- Live data exported from Supabase on 2026-06-09
-- Compatible with: supabase/mysql_schema.sql (architecture refactor applied)
--
-- HOW TO RUN
-- ----------
-- 1. First apply the schema:
--      mysql -u <user> -p <db> < supabase/mysql_schema.sql
-- 2. Then load this data:
--      mysql -u <user> -p <db> < supabase/mysql_data_dump.sql
--
-- ARCHITECTURE NOTE
-- -----------------
-- As of 2026-06-09 all business logic (cycle activation, suspension, form
-- approval/return, snapshot creation) runs in Supabase Edge Functions, not
-- in stored procedures or DB triggers. The mysql_schema.sql no longer
-- contains activate_cycle_reset_forms(), suspend_cycle(), or the
-- trg_skill_form_approval_snapshot trigger. If you deploy against MySQL
-- without Edge Functions, uncomment the STANDALONE MYSQL section at the
-- bottom of mysql_schema.sql.
--
-- NOTE: auth_users rows are provided as placeholder records so that the
-- foreign key constraint from users.id → auth_users.id is satisfied.
-- In production, these rows would be created by your auth system (JWT /
-- password hash etc.). Passwords are NOT stored here — wire up your own
-- bcrypt/argon2 hashing before going live.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';


-- ============================================================================
-- 1. auth_users  (placeholder rows — replace with real auth records)
-- ============================================================================

INSERT IGNORE INTO auth_users (id, email, created_at) VALUES
  ('11d05aed-0b7c-406e-9a79-14ac62bffeb0', 'employee2@haptiq.com',  '2026-04-15 09:03:25.865630'),
  ('969fa84f-4aee-421c-879a-8a6c0064f978', 'tmg2@haptiq.com',       '2026-04-15 09:03:25.865630'),
  ('d45064b0-2c91-4c5e-8338-f7ed91ea4f32', 'mgmt@haptiq.com',       '2026-04-15 09:03:25.865630'),
  ('07c59874-0bb4-45e6-96a1-1ef477b68ad4', 'admin@haptiq.com',      '2026-04-15 09:03:25.865630'),
  ('8408d823-3a77-4bb8-8130-d1e4074b3d68', 'employee1@haptiq.com',  '2026-04-15 09:03:25.865630'),
  ('de17e72f-9f38-4db9-a87f-a1e1fd25e6bf', 'tmg1@haptiq.com',       '2026-04-15 09:03:25.865630'),
  ('5710c938-0970-4bea-8627-ba8407502700', 'employee3@haptiq.com',  '2026-04-27 09:35:37.237639'),
  ('e87f9a89-c52d-44e7-a4dd-c581c8d6f53e', 'employee4@haptiq.com',  '2026-04-27 09:35:37.237639'),
  ('c82c7510-b508-400a-9d95-1b1832579bf0', 'employee5@haptiq.com',  '2026-04-27 09:35:37.237639');


-- ============================================================================
-- 2. users
-- ============================================================================

INSERT IGNORE INTO users
  (id, email, full_name, employee_number, designation, grade, role, manager_id, is_active, created_at)
VALUES
  ('11d05aed-0b7c-406e-9a79-14ac62bffeb0','employee2@haptiq.com','Employee Two',  'EMP002','',                    'IC05',   'employee',   '5710c938-0970-4bea-8627-ba8407502700', 1,'2026-04-15 09:03:25.865630'),
  ('969fa84f-4aee-421c-879a-8a6c0064f978','tmg2@haptiq.com',    'TMG Two',       NULL,    NULL,                   NULL,     'tmg',        NULL,                                   1,'2026-04-15 09:03:25.865630'),
  ('d45064b0-2c91-4c5e-8338-f7ed91ea4f32','mgmt@haptiq.com',    'Management User',NULL,   NULL,                   NULL,     'management', NULL,                                   1,'2026-04-15 09:03:25.865630'),
  ('07c59874-0bb4-45e6-96a1-1ef477b68ad4','admin@haptiq.com',   'System Admin',  NULL,    NULL,                   NULL,     'admin',      NULL,                                   1,'2026-04-15 09:03:25.865630'),
  ('8408d823-3a77-4bb8-8130-d1e4074b3d68','employee1@haptiq.com','Employee One',  'EMP001','Director',             'MGMT10', 'employee',   'c82c7510-b508-400a-9d95-1b1832579bf0', 1,'2026-04-15 09:03:25.865630'),
  ('de17e72f-9f38-4db9-a87f-a1e1fd25e6bf','tmg1@haptiq.com',   'TMG One',       NULL,    NULL,                   NULL,     'tmg',        NULL,                                   1,'2026-04-15 09:03:25.865630'),
  ('5710c938-0970-4bea-8627-ba8407502700','employee3@haptiq.com','Employee Three','EMP003','Devops Engineer II',   'IC04',   'employee',   'c82c7510-b508-400a-9d95-1b1832579bf0', 1,'2026-04-27 09:35:37.237639'),
  ('e87f9a89-c52d-44e7-a4dd-c581c8d6f53e','employee4@haptiq.com','Employee Four', 'EMP004','Staff Software Engineer I','IC08','employee',  'c82c7510-b508-400a-9d95-1b1832579bf0', 1,'2026-04-27 09:35:37.237639'),
  ('c82c7510-b508-400a-9d95-1b1832579bf0','employee5@haptiq.com','Employee Five', 'EMP005','Devops Engineer III',  'IC05',   'employee',   'de17e72f-9f38-4db9-a87f-a1e1fd25e6bf', 1,'2026-04-27 09:35:37.237639');


-- ============================================================================
-- 3. settings_skill_ratings
-- ============================================================================

INSERT IGNORE INTO settings_skill_ratings (id, sort_order, label, is_active, created_at) VALUES
  ('7df35fef-2ba1-451c-8bbc-e9e3eb1201e7', 1, '1 — Only Training / Certification', 1, '2026-05-20 16:51:16.710403'),
  ('09b13e15-dad7-41ce-a08a-fe069c72e5bb', 2, '2 — Basic Work Knowledge',           1, '2026-05-20 16:51:16.710403'),
  ('e5c37f65-1b48-4659-a5b9-2c54ad31fec0', 3, '3 — Intermediate',                   1, '2026-05-20 16:51:16.710403'),
  ('08ed3fe9-b776-4b88-a7cf-201ef1207973', 4, '4 — Proficient',                     1, '2026-05-20 16:51:16.710403'),
  ('ca227ce5-50a2-4a08-849c-598002598421', 5, '5 — Expert',                          1, '2026-05-20 16:51:16.710403');


-- ============================================================================
-- 4. settings_grades
-- ============================================================================

INSERT IGNORE INTO settings_grades (id, name, sort_order, is_active, created_at) VALUES
  ('1a2d6111-c8e4-4bf8-9a3e-5dc0b50d192a','IC01',    1, 1,'2026-05-20 15:39:46.892059'),
  ('895c5257-5fdf-4f4d-862e-17cc8190b41e','IC02',    2, 1,'2026-05-20 15:39:46.892059'),
  ('42a7f313-3bbb-45fc-9acc-554ff1bb7191','IC03',    3, 1,'2026-05-20 15:39:46.892059'),
  ('8b8c46a6-5dca-4a03-8b20-f33e622cae14','IC04',    4, 1,'2026-05-20 15:39:46.892059'),
  ('2f396cf3-011e-4abc-8730-d4a0a94b12a3','IC05',    5, 1,'2026-05-20 15:39:46.892059'),
  ('20527e7b-32cb-4dfb-9a45-3286e6cebb8c','IC06',    6, 1,'2026-05-20 15:39:46.892059'),
  ('d098612f-321e-42b6-9057-8079c9858660','IC07',    7, 1,'2026-05-20 15:39:46.892059'),
  ('4725cb01-1083-402b-894d-9075a28fdf9a','IC08',    8, 1,'2026-05-20 15:39:46.892059'),
  ('b66abe68-9d66-40cc-b9d3-f2f084c64b93','IC09',    9, 1,'2026-05-20 15:39:46.892059'),
  ('45b845da-9abd-48a5-8fe8-aad2d38b6c1f','IC10',   10, 1,'2026-05-20 15:39:46.892059'),
  ('c4da485f-a841-4a27-bd29-b31a6ef6c7ff','IC11',   11, 1,'2026-05-20 15:39:46.892059'),
  ('8e714da4-cac3-497f-8176-840d7d380608','IC12',   12, 1,'2026-05-20 15:39:46.892059'),
  ('800c1d5d-fd27-4e9e-9b50-5766db4f4a9d','MGMT05', 13, 1,'2026-05-20 15:39:46.892059'),
  ('f822c4e8-35c2-4b53-891f-51938d22110f','MGMT06', 14, 1,'2026-05-20 15:39:46.892059'),
  ('2153d44f-fa18-4bf1-935d-92e1484ebb7a','MGMT07', 15, 1,'2026-05-20 15:39:46.892059'),
  ('35da8e80-4278-4b4b-b6f0-cfab95d731d2','MGMT08', 16, 1,'2026-05-20 15:39:46.892059'),
  ('83bf9e93-a5dd-4c43-b18f-24fdfc0cf73c','MGMT09', 17, 1,'2026-05-20 15:39:46.892059'),
  ('3ec89f89-3489-4a0c-872d-d79a84d51981','MGMT10', 18, 1,'2026-05-20 15:39:46.892059'),
  ('6e009221-0e1f-4d1c-b86f-85adfeb9cca4','MGMT11', 19, 1,'2026-05-20 15:39:46.892059'),
  ('bcd4afbb-113b-4d05-8481-24a791dfdf8a','MGMT12', 20, 1,'2026-05-20 15:39:46.892059'),
  ('c975a216-965d-4a0d-8bf0-2229744d2065','MGMT13', 21, 1,'2026-05-20 15:39:46.892059'),
  ('0c0fec63-4ec6-4864-b2df-85d253fe3583','MGMT14', 22, 1,'2026-05-20 15:39:46.892059'),
  ('7f6ac74d-a271-4c06-8999-f9fd25c42137','MGMT15', 23, 1,'2026-05-20 15:39:46.892059');


-- ============================================================================
-- 5. review_cycles
-- ============================================================================

INSERT IGNORE INTO review_cycles
  (id, name, cycle_type, status, employee_deadline, manager_deadline,
   triggered_at, closed_at, suspended_at, suspension_reason, suspended_by,
   created_by, notes, created_at, updated_at)
VALUES
  (
    '1ba1df45-f9f8-41f8-a478-b4f2795ae565',
    'Mid-Yr-2026', 'mid_year', 'closed',
    '2026-06-15 07:29:00.000000', '2026-06-30 07:29:00.000000',
    '2026-05-26 16:24:34.535000', '2026-05-27 13:31:41.305000',
    NULL, NULL, NULL,
    'de17e72f-9f38-4db9-a87f-a1e1fd25e6bf',
    '', '2026-05-26 16:24:24.737249', '2026-05-27 13:31:41.783410'
  ),
  (
    '35ca4812-66fc-4b25-a865-2ef970f00686',
    'Mid Year Cycle 2026', 'mid_year', 'suspended',
    '2026-06-05 12:18:00.000000', '2026-06-15 12:19:00.000000',
    '2026-05-28 08:20:55.408000', NULL,
    '2026-05-28 09:42:03.993715', 'Mistakenly activated',
    'de17e72f-9f38-4db9-a87f-a1e1fd25e6bf',
    'de17e72f-9f38-4db9-a87f-a1e1fd25e6bf',
    '', '2026-05-27 12:19:49.922342', '2026-05-28 09:42:03.993715'
  ),
  (
    'b7f81199-8cb8-4717-a2db-d9f70e2e7778',
    'Yearly Cycle 2026', 'full_year', 'active',
    '2026-12-15 07:29:00.000000', '2026-12-31 07:29:00.000000',
    '2026-05-28 10:05:51.972000', NULL,
    NULL, NULL, NULL,
    'de17e72f-9f38-4db9-a87f-a1e1fd25e6bf',
    '', '2026-05-28 10:05:46.720480', '2026-05-28 10:05:52.177364'
  ),
  (
    'c83d7422-a10c-4cb3-819a-b528a2acd23c',
    'On-Demand 2026', 'custom', 'draft',
    '2026-06-30 11:46:00.000000', '2026-07-31 11:46:00.000000',
    NULL, NULL, NULL, NULL, NULL,
    'de17e72f-9f38-4db9-a87f-a1e1fd25e6bf',
    '', '2026-05-29 11:47:09.876771', '2026-05-29 11:47:09.876771'
  );


-- ============================================================================
-- 6. skill_forms
-- ============================================================================

INSERT IGNORE INTO skill_forms
  (id, employee_id, manager_id, cycle_id, status,
   total_exp, relevant_exp, haptiq_exp, current_project,
   tools, databases, tools_manager_comment, databases_manager_comment,
   environments, environments_manager_comment,
   certifications, upskilling_plan, manager_expectation_plan,
   employee_name, employee_email, employee_number, designation, grade,
   submitted_at, approved_at, manager_review_date, reminders_sent,
   created_at, updated_at)
VALUES
  (
    'ce2e6f8c-abc0-416a-9b68-9bcc53ab776c',
    '8408d823-3a77-4bb8-8130-d1e4074b3d68',
    'c82c7510-b508-400a-9d95-1b1832579bf0',
    'b7f81199-8cb8-4717-a2db-d9f70e2e7778',
    'draft',
    10.0, 9.0, 2.0, 'Unimed',
    'Git, Docker, VS Code, API, Pulumi',
    'PostgreSQL, Redis, MySQL',
    'Start exploring Jenkins. ',
    'good for now',
    '', 'Let''s discuss in person to align more skill',
    '["AWS Cloud Practitioner","Certified Ethical Hacker (CEH)"]',
    'Complete AWS Solutions Architect certification in next 6 months.',
    'There is more expectation on learning new tools and frameworks due to senior role. \nNeed to focus on completing certifications in next 6 months. ',
    'Employee One','employee1@haptiq.com','EMP001','Director','MGMT10',
    NULL, NULL, NULL, 0,
    '2026-05-28 10:04:18.625091', '2026-06-03 13:22:25.388000'
  ),
  (
    'd1d9da54-3eed-40cd-ba1e-414d1d46fcf7',
    '11d05aed-0b7c-406e-9a79-14ac62bffeb0',
    '5710c938-0970-4bea-8627-ba8407502700',
    'b7f81199-8cb8-4717-a2db-d9f70e2e7778',
    'draft',
    0.0, 0.0, 0.0, '',
    '', '', '', '',
    '', '',
    '[]',
    '', '',
    'Employee Two','employee2@haptiq.com','EMP002','','IC05',
    NULL, NULL, NULL, 0,
    '2026-05-28 10:21:21.458233', '2026-05-28 10:21:21.246000'
  );


-- ============================================================================
-- 7. skill_items
-- ============================================================================

INSERT IGNORE INTO skill_items
  (id, form_id, category, name, employee_rating, manager_rating, manager_comment, sort_order)
VALUES
  -- Employee One's current form (ce2e6f8c)
  ('9313b94c-48a4-4517-81d4-db4ad3444b5c','ce2e6f8c-abc0-416a-9b68-9bcc53ab776c','language',   'JavaScript', 3, 4, 'More Efficient',           0),
  ('e8908df0-4903-435b-b186-09fe3d780210','ce2e6f8c-abc0-416a-9b68-9bcc53ab776c','language',   'Python',     4, 4, 'Good',                      1),
  ('cb02b8df-efe4-4033-93a0-1848141dd9d8','ce2e6f8c-abc0-416a-9b68-9bcc53ab776c','language',   'TypeScript', 2, 1, 'Less Knowledge',            2),
  ('88decac9-4968-4a22-9b99-78a78229ed95','ce2e6f8c-abc0-416a-9b68-9bcc53ab776c','language',   'SQL',        3, 2, 'More Polishing required',   3),
  ('78d6e54c-ec53-4562-b691-d3ba025a962a','ce2e6f8c-abc0-416a-9b68-9bcc53ab776c','language',   'Groovy',     4, NULL, '',                        4),
  ('3744244f-98bf-4304-8374-8d4a7b0eaf29','ce2e6f8c-abc0-416a-9b68-9bcc53ab776c','framework',  'React',      3, 3, 'Ok',                        0),
  ('4cc3a88f-98c2-4c8d-8c22-b9ac851fc446','ce2e6f8c-abc0-416a-9b68-9bcc53ab776c','framework',  'Node.js',    2, 1, 'Less',                      1),
  ('a5638f8d-1630-4000-9324-27eec931fdb5','ce2e6f8c-abc0-416a-9b68-9bcc53ab776c','framework',  'FastAPI',    1, 1, 'Correct',                   2),
  ('6f656957-94e4-4730-a479-455957b7b6c2','ce2e6f8c-abc0-416a-9b68-9bcc53ab776c','environment','Android',    3, 3, 'Test',                      0),
  ('947d5153-d33a-4558-a898-87105a401f71','ce2e6f8c-abc0-416a-9b68-9bcc53ab776c','environment','AWS',        4, 4, 'Test',                      1),
  ('5bcb012d-ee45-4747-8b4e-81a96aafa601','ce2e6f8c-abc0-416a-9b68-9bcc53ab776c','environment','Android Studio',3,3,'Test',                     2),
  -- Employee Two's current form (d1d9da54)
  ('0fcbc821-1c26-4e78-9cdb-201d481b6ac8','d1d9da54-3eed-40cd-ba1e-414d1d46fcf7','language',   'JavaScript', NULL, NULL, '',                    0),
  ('65084d11-c78b-4e9e-b784-2159c6ecc75a','d1d9da54-3eed-40cd-ba1e-414d1d46fcf7','language',   'Python',     NULL, NULL, '',                    1),
  ('40315ee4-3f65-422a-9d40-e05da5e06da5','d1d9da54-3eed-40cd-ba1e-414d1d46fcf7','language',   'Java',       NULL, NULL, '',                    2),
  ('e4b42a87-51f6-414e-ae4f-998dfa3643ba','d1d9da54-3eed-40cd-ba1e-414d1d46fcf7','framework',  'React',      NULL, NULL, '',                    0),
  ('ceca9398-d435-4086-84e7-5da83dbdf023','d1d9da54-3eed-40cd-ba1e-414d1d46fcf7','framework',  'Node.js',    NULL, NULL, '',                    1),
  ('ce078514-1eaf-4bfc-862b-010063fb5145','d1d9da54-3eed-40cd-ba1e-414d1d46fcf7','framework',  'Spring Boot',NULL, NULL, '',                    2);


-- ============================================================================
-- 8. skill_form_versions  (approval snapshots — append-only)
-- ============================================================================
-- Snapshot JSON is stored exactly as retrieved from Supabase.
-- In MySQL the JSON column accepts standard JSON strings.

INSERT IGNORE INTO skill_form_versions
  (id, cycle_id, form_id, employee_id, snapshot, approved_at, approved_by, created_at)
VALUES
  (
    '62599809-10fa-4043-9e26-e068ffd17eb3',
    '1ba1df45-f9f8-41f8-a478-b4f2795ae565',
    NULL,
    'c82c7510-b508-400a-9d95-1b1832579bf0',
    '{"id":"35e2714b-f4e6-486a-a106-32d479256f78","grade":"IC05","tools":"AWS Devops, Butter CMS, Dbeaver, Elasticsearch / ELK Stack","status":"approved","cycle_id":"1ba1df45-f9f8-41f8-a478-b4f2795ae565","databases":"OpenSearch, MySQL, Firebase Firestore, Redis","total_exp":8,"haptiq_exp":8,"approved_at":"2026-05-27T13:07:21.436+00:00","designation":"Devops Engineer III","employee_id":"c82c7510-b508-400a-9d95-1b1832579bf0","skill_items":[{"id":"666d4019-1941-4d07-96fd-16dcb5ff95be","name":"DevOps","form_id":"35e2714b-f4e6-486a-a106-32d479256f78","category":"language","sort_order":0,"manager_rating":5,"employee_rating":5,"manager_comment":"Demonstrates strong knowledge and practical expertise in DevOps practices."},{"id":"b8463a86-f644-4f58-8a61-2ff9e484e0c0","name":"Scala","form_id":"35e2714b-f4e6-486a-a106-32d479256f78","category":"language","sort_order":1,"manager_rating":3,"employee_rating":4,"manager_comment":"Shows willingness to learn and improve technical capabilities."},{"id":"016239ba-0095-4e71-84f3-8fa441eb8243","name":"HAML","form_id":"35e2714b-f4e6-486a-a106-32d479256f78","category":"language","sort_order":2,"manager_rating":1,"employee_rating":1,"manager_comment":"Just completed the certification."},{"id":"23da6c47-f7fe-4e2d-bf7a-834092fdbc92","name":"Airflow","form_id":"35e2714b-f4e6-486a-a106-32d479256f78","category":"framework","sort_order":0,"manager_rating":3,"employee_rating":2,"manager_comment":"Demonstrates a good understanding of DevOps practices along with working knowledge of Apache Airflow."},{"id":"1a2537bc-3d21-40d7-ab36-a9ff20ddf468","name":"Flask","form_id":"35e2714b-f4e6-486a-a106-32d479256f78","category":"framework","sort_order":1,"manager_rating":3,"employee_rating":3,"manager_comment":"Can handle a team of juniors."},{"id":"f53eaa94-d893-4be8-90a2-4b2907e3229f","name":"Django","form_id":"35e2714b-f4e6-486a-a106-32d479256f78","category":"framework","sort_order":2,"manager_rating":2,"employee_rating":4,"manager_comment":"Have basic knowledge only, need assistance in handling complex projects."},{"id":"a35f7fb5-02fe-4548-9ac2-1a8dadd99e5d","name":"AWS","form_id":"35e2714b-f4e6-486a-a106-32d479256f78","category":"environment","sort_order":0,"manager_rating":3,"employee_rating":3,"manager_comment":"Very good subjective and practical knowledge."},{"id":"9610ba90-411c-438c-8e7e-d60991338c3a","name":"Azure","form_id":"35e2714b-f4e6-486a-a106-32d479256f78","category":"environment","sort_order":1,"manager_rating":4,"employee_rating":4,"manager_comment":"Demonstrates very strong subject knowledge."}],"relevant_exp":8,"submitted_at":"2026-05-27T13:01:33.592+00:00","employee_name":"Employee Five","certifications":["AWS Certified Developer","AWS Certified Solutions Architect"],"employee_email":"employee5@haptiq.com","reminders_sent":0,"current_project":"DRF","employee_number":"EMP005","upskilling_plan":"Over the next 6 months, I aim to strengthen my expertise in DevOps practices.","manager_review_date":null,"tools_manager_comment":"Able to effectively support deployment, monitoring, and database-related activities.","manager_expectation_plan":"I appreciate the employee\'s initiative in pursuing continuous learning and professional development.","databases_manager_comment":"Shows willingness to learn and adapt to different database technologies.","environments_manager_comment":"Has shown steady growth in technical capabilities and ownership."}',
    '2026-05-27 13:07:22.347000',
    'de17e72f-9f38-4db9-a87f-a1e1fd25e6bf',
    '2026-05-27 13:07:22.412343'
  ),
  (
    '56fab2ca-d42b-4014-9a7a-bd6936b61800',
    '1ba1df45-f9f8-41f8-a478-b4f2795ae565',
    NULL,
    'e87f9a89-c52d-44e7-a4dd-c581c8d6f53e',
    '{"id":"57e22510-414d-420f-8453-6edec421222f","grade":"IC08","tools":"Jenkins, Apache Kafka, API, Butter CMS","status":"approved","cycle_id":"1ba1df45-f9f8-41f8-a478-b4f2795ae565","databases":"MySQL, Microsoft SQL Server, MongoDB, ClickHouse","total_exp":5,"haptiq_exp":1,"approved_at":"2026-05-27T13:10:00+00:00","designation":"Staff Software Engineer I","employee_id":"e87f9a89-c52d-44e7-a4dd-c581c8d6f53e","skill_items":[{"id":"e97de429-d47a-4176-b8ba-191265cc40f0","name":"Flask","form_id":"57e22510-414d-420f-8453-6edec421222f","category":"framework","sort_order":0,"manager_rating":4,"employee_rating":4,"manager_comment":"Delivers consistently high-quality work."},{"id":"45dfde3d-4062-4862-b68b-5f19c1c1b576","name":"GoLang","form_id":"57e22510-414d-420f-8453-6edec421222f","category":"language","sort_order":0,"manager_rating":3,"employee_rating":4,"manager_comment":"The quality of work is acceptable."},{"id":"58f1f4bb-6c36-4ee3-8f11-fde663f39d05","name":"Apache","form_id":"57e22510-414d-420f-8453-6edec421222f","category":"environment","sort_order":0,"manager_rating":2,"employee_rating":2,"manager_comment":"Test"},{"id":"6184a8fb-8910-499a-874c-43d9cab68660","name":"CMS","form_id":"57e22510-414d-420f-8453-6edec421222f","category":"environment","sort_order":1,"manager_rating":4,"employee_rating":4,"manager_comment":"Test"},{"id":"315970cd-10f3-4462-bde3-c0fcc13be654","name":"Go","form_id":"57e22510-414d-420f-8453-6edec421222f","category":"language","sort_order":1,"manager_rating":3,"employee_rating":3,"manager_comment":"Operates entirely independently."},{"id":"613c7aaa-39e7-45c9-92ed-ff4cd83fa6b3","name":"Laravel","form_id":"57e22510-414d-420f-8453-6edec421222f","category":"framework","sort_order":1,"manager_rating":2,"employee_rating":2,"manager_comment":"Performs basic/routine tasks independently."},{"id":"c9b4c2b5-0258-44ee-a192-3dbfbd534806","name":"Spring Boot","form_id":"57e22510-414d-420f-8453-6edec421222f","category":"framework","sort_order":2,"manager_rating":2,"employee_rating":3,"manager_comment":"Needs to pay more attention to the work."},{"id":"3731c9e1-48f4-4f70-9662-afd9228d1e7e","name":"Bash","form_id":"57e22510-414d-420f-8453-6edec421222f","category":"language","sort_order":2,"manager_rating":4,"employee_rating":3,"manager_comment":"Can review the work of others."},{"id":"218a1f3d-a354-48a1-a985-3463855fbdb8","name":"Prefect","form_id":"57e22510-414d-420f-8453-6edec421222f","category":"framework","sort_order":3,"manager_rating":1,"employee_rating":1,"manager_comment":"Actively focused on learning new skills."}],"relevant_exp":5,"submitted_at":"2026-05-27T13:00:58.019+00:00","employee_name":"Employee Four","certifications":["Scrum Master Certification (CSM)","Certified Ethical Hacker (CEH)"],"employee_email":"employee4@haptiq.com","reminders_sent":0,"current_project":"Silvur","employee_number":"EMP004","upskilling_plan":"Over the next 6 months, I aim to strengthen my expertise in Go backend development.","manager_review_date":null,"tools_manager_comment":"Strongly agree with the tools mentioned.","manager_expectation_plan":"The employee has shown a positive approach toward learning and technical growth.","databases_manager_comment":"Has a good foundational understanding of databases.","environments_manager_comment":"Demonstrates good efficiency in work execution."}',
    '2026-05-27 13:10:00.000000',
    NULL,
    '2026-05-28 08:49:15.315836'
  ),
  (
    '8c7358d3-38ae-466f-bfd1-e8cee60d6e82',
    '1ba1df45-f9f8-41f8-a478-b4f2795ae565',
    NULL,
    '8408d823-3a77-4bb8-8130-d1e4074b3d68',
    '{"id":"ce2e6f8c-abc0-416a-9b68-9bcc53ab776c","grade":"MGMT10","tools":"Git, Docker, VS Code, API","status":"approved","cycle_id":"1ba1df45-f9f8-41f8-a478-b4f2795ae565","databases":"PostgreSQL, Redis, MySQL","total_exp":10,"haptiq_exp":2,"approved_at":"2026-05-27T13:10:00+00:00","designation":"Director","employee_id":"8408d823-3a77-4bb8-8130-d1e4074b3d68","skill_items":[{"id":"c80bd0eb-30e4-457b-b6ee-8c9dfefe07eb","name":"JavaScript","category":"language","sort_order":0,"manager_rating":4,"employee_rating":3,"manager_comment":"More Efficient"},{"id":"5fb7c6cc-0ddd-412e-b19f-00ff8a468b37","name":"React","category":"framework","sort_order":0,"manager_rating":3,"employee_rating":3,"manager_comment":"Ok"},{"id":"2708d0bc-251a-48c8-ba1b-e31d6f530e4e","name":"Android","category":"environment","sort_order":0,"manager_rating":3,"employee_rating":3,"manager_comment":"Test"},{"id":"5f845d3a-b69b-49ad-b7b6-bcf3e82de288","name":"AWS","category":"environment","sort_order":1,"manager_rating":4,"employee_rating":4,"manager_comment":"Test"},{"id":"c77f537f-3988-413a-9a1c-9a2d0c71d311","name":"Node.js","category":"framework","sort_order":1,"manager_rating":1,"employee_rating":2,"manager_comment":"Less"},{"id":"5ec58a93-cbeb-4893-920b-ccd6df2f9c7d","name":"Python","category":"language","sort_order":1,"manager_rating":3,"employee_rating":3,"manager_comment":"Good"},{"id":"6d8db1a0-058c-4c33-8805-cbde4a283811","name":"FastAPI","category":"framework","sort_order":2,"manager_rating":1,"employee_rating":1,"manager_comment":"Correct"},{"id":"c2c6903b-6556-48f4-8f9b-4e81b117c3cd","name":"TypeScript","category":"language","sort_order":2,"manager_rating":1,"employee_rating":2,"manager_comment":"Less Knowledge"},{"id":"3c8dd1c2-fbd4-4cc2-b3e5-4f8c3d6e2e35","name":"SQL","category":"language","sort_order":3,"manager_rating":2,"employee_rating":3,"manager_comment":"More Polishing required"}],"relevant_exp":9,"submitted_at":"2026-05-27T12:43:31.163+00:00","employee_name":"Employee One","certifications":["AWS Cloud Practitioner","Certified Ethical Hacker (CEH)"],"employee_email":"employee1@haptiq.com","reminders_sent":0,"current_project":"Unimed","employee_number":"EMP001","upskilling_plan":"Complete AWS Solutions Architect certification in next 6 months.","manager_review_date":null,"tools_manager_comment":"Start exploring Jenkins.","manager_expectation_plan":"There is more expectation on learning new tools and frameworks due to senior role.","databases_manager_comment":"good for now","environments_manager_comment":"Let\'s discuss in person to align more skill"}',
    '2026-05-27 13:10:00.000000',
    NULL,
    '2026-05-28 08:49:15.315836'
  ),
  (
    'f6bea6da-8b6f-4dcc-9168-c059fcac498a',
    '1ba1df45-f9f8-41f8-a478-b4f2795ae565',
    NULL,
    '5710c938-0970-4bea-8627-ba8407502700',
    '{"id":"57a066f9-64ee-4440-ab30-dd04b5642294","grade":"IC04","tools":"GitHub Actions, Docker, Ansible, Android Studio, API","status":"approved","cycle_id":"1ba1df45-f9f8-41f8-a478-b4f2795ae565","databases":"MySQL, DynamoDB, MariaDB","total_exp":8,"haptiq_exp":7,"approved_at":"2026-05-27T13:10:00+00:00","designation":"Devops Engineer II","employee_id":"5710c938-0970-4bea-8627-ba8407502700","skill_items":[{"id":"08afe248-8cf3-4694-961d-7dee8a77ab5f","name":"Ruby","category":"language","sort_order":0,"manager_rating":2,"employee_rating":3,"manager_comment":"Correct"},{"id":"f7dfdfdd-47b0-4ede-823c-5bfa69611696","name":"Ruby on Rails","category":"framework","sort_order":0,"manager_rating":3,"employee_rating":3,"manager_comment":"yes"},{"id":"482210b6-885e-4c1e-9ebf-7972b1778cba","name":"Apache","category":"environment","sort_order":0,"manager_rating":2,"employee_rating":3,"manager_comment":"Test"},{"id":"97929aae-58a3-4c4c-a642-ae89b23b4721","name":"Express.js","category":"framework","sort_order":1,"manager_rating":1,"employee_rating":1,"manager_comment":"good"},{"id":"a15d875b-f69d-443b-8c94-3d43f4c352b4","name":"Java","category":"language","sort_order":1,"manager_rating":2,"employee_rating":2,"manager_comment":"Corrected"},{"id":"1aa07e24-f5c3-485f-85ec-e5e05c6e2b1c","name":"Firebase","category":"environment","sort_order":1,"manager_rating":1,"employee_rating":2,"manager_comment":"Test"},{"id":"ba6171e6-bade-4616-ade0-b8103d477e07","name":"C#","category":"language","sort_order":2,"manager_rating":2,"employee_rating":3,"manager_comment":"Ok"},{"id":"6ab25c75-e783-4691-8954-488be8cdba98","name":"Airflow","category":"framework","sort_order":2,"manager_rating":3,"employee_rating":2,"manager_comment":"correct"},{"id":"eb641c39-a177-4e4a-811c-c451f2fd73c8","name":"Bootstrap","category":"framework","sort_order":3,"manager_rating":3,"employee_rating":4,"manager_comment":"agree"},{"id":"43c8fd97-3014-4f4d-8673-ba8dd7811678","name":"Groovy","category":"language","sort_order":3,"manager_rating":3,"employee_rating":2,"manager_comment":"Goood"},{"id":"3382d938-bfdf-4673-a6a4-95aea9786c06","name":"C++","category":"language","sort_order":4,"manager_rating":3,"employee_rating":1,"manager_comment":"Expert"}],"relevant_exp":7,"submitted_at":"2026-05-27T13:00:05.347+00:00","employee_name":"Employee Three","certifications":["AWS Certified Developer","Certified Kubernetes Administrator (CKA)","Certified Ethical Hacker (CEH)"],"employee_email":"employee3@haptiq.com","reminders_sent":0,"current_project":"Unimed","employee_number":"EMP003","upskilling_plan":"Will be focusing on learning javascript.","manager_review_date":null,"tools_manager_comment":"Test","manager_expectation_plan":"Tested ok","databases_manager_comment":"Test","environments_manager_comment":"Test"}',
    '2026-05-27 13:10:00.000000',
    NULL,
    '2026-05-28 08:49:15.315836'
  ),
  (
    '0ce5c543-7221-41f8-99b3-0e9fd09ef175',
    '1ba1df45-f9f8-41f8-a478-b4f2795ae565',
    NULL,
    '11d05aed-0b7c-406e-9a79-14ac62bffeb0',
    '{"id":"a33abed5-b13a-4c8d-8cd9-91e6e28248e7","grade":"IC03","tools":"Github, GitHub Actions, GitLab CI/CD, GitLab","status":"approved","cycle_id":"1ba1df45-f9f8-41f8-a478-b4f2795ae565","databases":"DynamoDB, MongoDB, Microsoft SQL Server, ClickHouse","total_exp":5,"haptiq_exp":4,"approved_at":"2026-05-27T13:10:00+00:00","designation":"Software Engineer","employee_id":"11d05aed-0b7c-406e-9a79-14ac62bffeb0","skill_items":[{"id":"de2a3456-f561-48ff-9aa6-3e9e46ad9845","name":"React","category":"framework","sort_order":0,"manager_rating":2,"employee_rating":2,"manager_comment":"agee"},{"id":"10fd596b-5b4a-4328-80bf-207593c39207","name":"JavaScript","category":"language","sort_order":0,"manager_rating":3,"employee_rating":3,"manager_comment":"Good knowledge"},{"id":"02dcfa9a-4d20-4390-8867-b0f529867d0d","name":"S3","category":"environment","sort_order":0,"manager_rating":2,"employee_rating":3,"manager_comment":"Test"},{"id":"8b068d93-c700-442d-b57f-ae6ddb27769f","name":"Kubernetes","category":"environment","sort_order":1,"manager_rating":3,"employee_rating":3,"manager_comment":"Test"},{"id":"058434cf-9266-4d17-9a5f-cd853b60c166","name":"Python","category":"language","sort_order":1,"manager_rating":2,"employee_rating":2,"manager_comment":"Need to focus more on complex sprint tickets"},{"id":"ac93383c-a239-4fc8-a72c-fa4d6a70dfc3","name":"Node.js","category":"framework","sort_order":1,"manager_rating":2,"employee_rating":2,"manager_comment":"agree"},{"id":"4e7069d5-9387-4b6f-8b93-c67abfece36e","name":"Spring Boot","category":"framework","sort_order":2,"manager_rating":0,"employee_rating":1,"manager_comment":"I think this need improvement"},{"id":"d1faf964-9405-47ed-ab80-b7c9c860a9c3","name":"Java","category":"language","sort_order":2,"manager_rating":3,"employee_rating":2,"manager_comment":"Good"}],"relevant_exp":4,"submitted_at":"2026-05-27T12:44:27.061+00:00","employee_name":"Employee Two","certifications":["Microsoft Azure Administrator (AZ-104)","Certified Ethical Hacker (CEH)"],"employee_email":"employee2@haptiq.com","reminders_sent":0,"current_project":"DRF","employee_number":"EMP002","upskilling_plan":"Will focus on learning new language: YAML","manager_review_date":null,"tools_manager_comment":"good","manager_expectation_plan":"OK Tested","databases_manager_comment":"good","environments_manager_comment":"Test"}',
    '2026-05-27 13:10:00.000000',
    NULL,
    '2026-05-28 08:49:15.315836'
  ),
  (
    '45ce9c5e-976f-4383-ae70-f3d02b9f1a12',
    '35ca4812-66fc-4b25-a865-2ef970f00686',
    'ce2e6f8c-abc0-416a-9b68-9bcc53ab776c',
    '8408d823-3a77-4bb8-8130-d1e4074b3d68',
    '{"id":"ce2e6f8c-abc0-416a-9b68-9bcc53ab776c","grade":"MGMT10","status":"approved","cycle_id":"35ca4812-66fc-4b25-a865-2ef970f00686","total_exp":10,"haptiq_exp":2,"approved_at":"2026-05-28T09:38:50.199+00:00","designation":"Director","employee_id":"8408d823-3a77-4bb8-8130-d1e4074b3d68","relevant_exp":9,"employee_name":"Employee One","certifications":["AWS Cloud Practitioner","Certified Ethical Hacker (CEH)"],"employee_email":"employee1@haptiq.com","employee_number":"EMP001"}',
    '2026-05-28 09:38:50.199000',
    NULL,
    '2026-05-28 09:38:50.320127'
  );


-- ============================================================================
-- 9. notifications
-- ============================================================================

INSERT IGNORE INTO notifications (id, user_id, type, message, is_read, form_id, created_at) VALUES
  ('c4b62fb7-c093-4496-b61e-c46ff6bd4f18','8408d823-3a77-4bb8-8130-d1e4074b3d68','form_approved','Your Skill Profile has been approved.',1,NULL,'2026-04-28 06:53:59.625700'),
  ('73f2dfc4-b3fc-4992-af25-d8fefc95bbef','5710c938-0970-4bea-8627-ba8407502700','form_returned','Your Skill Profile was returned for revision. Reason: The data filled is in correct. Please correct and reshare',1,NULL,'2026-04-29 09:39:25.330513'),
  ('b4fd8127-e0f3-42db-a19b-0736c8d0c709','c82c7510-b508-400a-9d95-1b1832579bf0','form_returned','Your Skill Profile was returned for revision. Reason: The self rating is missing\n',0,NULL,'2026-05-19 13:13:52.713520'),
  ('b6aadde8-cdf1-4fd3-a7ed-95e907ac3291','c82c7510-b508-400a-9d95-1b1832579bf0','form_submitted','Employee Three submitted their Skill Profile.',0,NULL,'2026-05-20 09:21:23.453782'),
  ('2e82e68e-5ef9-4ee5-b843-489d464885c3','5710c938-0970-4bea-8627-ba8407502700','form_returned','Your Skill Profile was returned for revision. Reason: Please refill correctly',1,NULL,'2026-05-20 11:21:27.900699'),
  ('c26d3445-9868-4669-adf1-9a1a4a17cb91','c82c7510-b508-400a-9d95-1b1832579bf0','form_submitted','Employee Three submitted their Skill Profile.',0,NULL,'2026-05-20 11:28:01.597490'),
  ('e730f225-29ff-4c29-aa7e-9f7b8612cc35','5710c938-0970-4bea-8627-ba8407502700','form_approved','Your Skill Profile has been approved.',1,NULL,'2026-05-20 11:41:28.959071'),
  ('8f4b69b7-d118-489c-aded-f0f4f844f274','11d05aed-0b7c-406e-9a79-14ac62bffeb0','form_submitted','Employee One submitted their Skill Profile.',1,NULL,'2026-05-22 05:35:36.072725'),
  ('ec219827-31cb-4794-afce-8ce6defe413a','5710c938-0970-4bea-8627-ba8407502700','form_submitted','Employee Two submitted their Skill Profile.',1,NULL,'2026-05-22 08:44:03.932708'),
  ('0b8707c6-c927-4f27-8fa2-28a0da73978e','c82c7510-b508-400a-9d95-1b1832579bf0','form_submitted','Employee Three submitted their Skill Profile.',0,NULL,'2026-05-22 08:44:41.498736'),
  ('d38a60c4-4eef-4069-8b80-e6d1e15d8428','11d05aed-0b7c-406e-9a79-14ac62bffeb0','form_approved','Your Skill Profile has been approved.',1,NULL,'2026-05-22 08:54:31.039331'),
  ('28342ddc-1281-460b-8347-41a6f4afd4bb','5710c938-0970-4bea-8627-ba8407502700','form_approved','Your Skill Profile has been approved.',1,NULL,'2026-05-22 08:56:08.107491'),
  ('0ea16141-2f95-422b-92bd-87388b2ac08d','8408d823-3a77-4bb8-8130-d1e4074b3d68','form_approved','Your Skill Profile has been approved.',0,NULL,'2026-05-25 08:00:44.784883'),
  ('375bf18b-3026-4da9-8950-674e1d261eb3','c82c7510-b508-400a-9d95-1b1832579bf0','form_submitted','Employee Four submitted their Skill Profile.',1,NULL,'2026-05-26 09:08:32.197775'),
  ('29ea7a7d-bed4-449a-9139-e6b2bcc5eb68','e87f9a89-c52d-44e7-a4dd-c581c8d6f53e','form_approved','Your Skill Profile has been approved.',0,NULL,'2026-05-26 09:32:25.445059'),
  ('3635dffe-612c-43b2-85db-0f0ff5b68f72','de17e72f-9f38-4db9-a87f-a1e1fd25e6bf','form_submitted','Employee Five submitted their Skill Profile.',0,NULL,'2026-05-26 10:03:43.213196'),
  ('4a2c57fe-09e4-4043-9ae8-992fa82dd241','c82c7510-b508-400a-9d95-1b1832579bf0','form_approved','Your Skill Profile has been approved.',0,NULL,'2026-05-26 10:24:24.735091'),
  ('67a92a83-a0aa-4f65-8f59-403420d5bfa3','c82c7510-b508-400a-9d95-1b1832579bf0','form_submitted','Employee One submitted their Skill Profile.',0,NULL,'2026-05-27 12:43:33.447434'),
  ('21aaa8d4-2c92-48d3-a257-8422db116f52','5710c938-0970-4bea-8627-ba8407502700','form_submitted','Employee Two submitted their Skill Profile.',0,NULL,'2026-05-27 12:44:29.324834'),
  ('ddba7794-6567-44da-bbc5-da1a133e1afd','c82c7510-b508-400a-9d95-1b1832579bf0','form_submitted','Employee Three submitted their Skill Profile.',0,NULL,'2026-05-27 13:00:07.003559'),
  ('c5a7f5d3-b856-402e-93ea-2fa5fd04493e','c82c7510-b508-400a-9d95-1b1832579bf0','form_submitted','Employee Four submitted their Skill Profile.',0,NULL,'2026-05-27 13:00:59.060406'),
  ('291532ec-a6c2-40ba-b472-6c63b5418a67','de17e72f-9f38-4db9-a87f-a1e1fd25e6bf','form_submitted','Employee Five submitted their Skill Profile.',1,NULL,'2026-05-27 13:01:35.395561'),
  ('bd2e49e5-7623-429d-a800-09e3fb6277cc','e87f9a89-c52d-44e7-a4dd-c581c8d6f53e','form_approved','Your Skill Profile for "Mid-Yr-2026" has been approved.',0,NULL,'2026-05-27 13:03:15.887786'),
  ('919b5dc3-8401-4607-a33c-065d3fe6f8da','5710c938-0970-4bea-8627-ba8407502700','form_approved','Your Skill Profile for "Mid-Yr-2026" has been approved.',0,NULL,'2026-05-27 13:04:56.391727'),
  ('ec249e07-e4c8-4469-8d48-bd8d50d7676d','8408d823-3a77-4bb8-8130-d1e4074b3d68','form_approved','Your Skill Profile for "Mid-Yr-2026" has been approved.',0,NULL,'2026-05-27 13:06:05.823895'),
  ('25b1aa44-e3c1-454b-9721-9ee7ca90addb','c82c7510-b508-400a-9d95-1b1832579bf0','form_approved','Your Skill Profile for "Mid-Yr-2026" has been approved.',0,NULL,'2026-05-27 13:07:22.638242'),
  ('d72257f5-a2cb-46d6-9ec1-7eb3b7b009be','11d05aed-0b7c-406e-9a79-14ac62bffeb0','form_approved','Your Skill Profile for "Mid-Yr-2026" has been approved.',0,NULL,'2026-05-27 13:08:15.735791'),
  ('1e6fd0df-cc5d-42cb-bfc5-ae3fd247e577','c82c7510-b508-400a-9d95-1b1832579bf0','form_submitted','Employee One submitted their Skill Profile.',0,NULL,'2026-05-28 09:19:14.969211'),
  ('4eafb823-363d-425d-a6f1-7adfb4c0ad91','8408d823-3a77-4bb8-8130-d1e4074b3d68','form_approved','Your Skill Profile for "Mid Year Cycle 2026" has been approved.',1,NULL,'2026-05-28 09:38:51.054937');


-- ============================================================================
-- 10. SSO CONFIG
-- ============================================================================

INSERT IGNORE INTO sso_config (id, provider, enabled, client_id, updated_by, updated_at) VALUES
  (UUID(), 'google', 0, NULL, NULL, '2026-06-08 11:40:03.000000');


-- ============================================================================
-- 11. RE-ENABLE FOREIGN KEY CHECKS
-- ============================================================================

SET foreign_key_checks = 1;


-- ============================================================================
-- END OF DATA DUMP
-- ============================================================================
--
-- RECORD COUNTS (as of export 2026-06-08)
-- ----------------------------------------
--   auth_users            :  9 rows
--   users                 :  9 rows  (2 TMG, 1 admin, 1 management, 5 employees)
--   review_cycles         :  4 rows  (1 closed, 1 suspended, 1 active, 1 draft)
--   skill_forms           :  2 rows  (active cycle, both draft)
--   skill_items           : 17 rows  (across 2 forms)
--   skill_form_versions   :  6 rows  (5 from Mid-Yr-2026, 1 from suspended cycle)
--   sso_config            :  1 row   (google provider, disabled)
--   notifications         : 29 rows
--   settings_skill_ratings:  5 rows
--   settings_grades       : 23 rows  (IC01-IC12, MGMT05-MGMT15)
--
-- settings_certifications, settings_languages, settings_frameworks,
-- settings_tools, settings_databases, settings_environments, and
-- settings_designations are fully seeded by mysql_schema.sql and contain
-- no user-modified rows, so they are NOT included here to avoid duplicates.
-- If you need to override seed data, add INSERT IGNORE rows below this comment.
-- ============================================================================
