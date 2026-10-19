-- Righto · demo psychologist for testing the invite flow without a second phone.
-- Creates (or refreshes) the account drpillai@righto.demo / Righto-demo-2026! with a profile, a psychologist record and
-- one invite code DRPILLAI22 valid for 30 days. Run in the Supabase SQL editor. Safe to run again: it replaces the
-- previous invite. Delete the account from Authentication → Users when you no longer want it.
do $$
declare v_id uuid := '0a5e7a10-5e3c-4c7e-9d2a-1f6b3d9a7e01'; v_code text := 'DRPILLAI22';
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
                          phone_change, phone_change_token, reauthentication_token, is_sso_user)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'drpillai@righto.demo',
          extensions.crypt('Righto-demo-2026!', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Dr Anita Pillai","role":"psych"}'::jsonb,
          now(), now(), '', '', '', '', '', '', '', '', false)
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, 'email',
          jsonb_build_object('sub', v_id::text, 'email', 'drpillai@righto.demo', 'email_verified', true), now(), now(), now())
  on conflict (provider_id, provider) do nothing;

  insert into public.righto_profiles (user_id, role, display_name, consent_version, consent_at)
  values (v_id, 'psych', 'Dr Anita Pillai', '2026-10-15', now())
  on conflict (user_id) do nothing;

  insert into public.righto_psychologists (user_id, title, practice, ahpra, consent_attested_at)
  values (v_id, 'Clinical Psychologist', 'Pillai Psychology, Melbourne', 'PSY0009876543', now())
  on conflict (user_id) do nothing;

  delete from public.righto_invites where code_hash = public.righto_hash_code(v_code);
  insert into public.righto_invites (psych_id, code_hash, expires_at)
  values (v_id, public.righto_hash_code(v_code), now() + interval '30 days');
end $$;
