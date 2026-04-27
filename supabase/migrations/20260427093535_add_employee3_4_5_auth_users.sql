/*
  # Add Employee 3, 4, 5 auth users and profiles

  Creates auth.users entries and matching public.users profiles for
  Employee Three, Four, and Five with password emp@123.
*/

DO $$
DECLARE
  emp3_id uuid := gen_random_uuid();
  emp4_id uuid := gen_random_uuid();
  emp5_id uuid := gen_random_uuid();
BEGIN

  -- Employee Three
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'employee3@haptiq.com') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      emp3_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'employee3@haptiq.com',
      crypt('emp@123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Employee Three","role":"employee"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), emp3_id, emp3_id::text, 'email',
      jsonb_build_object('sub', emp3_id::text, 'email', 'employee3@haptiq.com'),
      now(), now(), now()
    );

    UPDATE public.users SET
      employee_number = 'EMP003',
      designation     = 'Software Engineer',
      grade           = 'L3'
    WHERE id = emp3_id;
  END IF;

  -- Employee Four
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'employee4@haptiq.com') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      emp4_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'employee4@haptiq.com',
      crypt('emp@123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Employee Four","role":"employee"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), emp4_id, emp4_id::text, 'email',
      jsonb_build_object('sub', emp4_id::text, 'email', 'employee4@haptiq.com'),
      now(), now(), now()
    );

    UPDATE public.users SET
      employee_number = 'EMP004',
      designation     = 'Senior Software Engineer',
      grade           = 'L4'
    WHERE id = emp4_id;
  END IF;

  -- Employee Five
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'employee5@haptiq.com') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      emp5_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'employee5@haptiq.com',
      crypt('emp@123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Employee Five","role":"employee"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), emp5_id, emp5_id::text, 'email',
      jsonb_build_object('sub', emp5_id::text, 'email', 'employee5@haptiq.com'),
      now(), now(), now()
    );

    UPDATE public.users SET
      employee_number = 'EMP005',
      designation     = 'Senior Software Engineer',
      grade           = 'L4'
    WHERE id = emp5_id;
  END IF;

END $$;
