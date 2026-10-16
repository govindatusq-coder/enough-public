// Cross-tenant isolation tests against a real Supabase project (COMPLIANCE_REVIEW D4).
// Skipped unless these are set:
//   RIGHTO_SUPABASE_URL, RIGHTO_SUPABASE_ANON_KEY, RIGHTO_SUPABASE_SERVICE_ROLE_KEY (test project only, never a phone build)
// Run: RIGHTO_SUPABASE_URL=... RIGHTO_SUPABASE_ANON_KEY=... RIGHTO_SUPABASE_SERVICE_ROLE_KEY=... node --test tests/backend/*.test.ts
// Creates throw-away users and deletes them afterwards. Temporarily switches off the psychologist MFA requirement
// for the duration of the run, then restores it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.RIGHTO_SUPABASE_URL ?? '';
const ANON = process.env.RIGHTO_SUPABASE_ANON_KEY ?? '';
const SERVICE = process.env.RIGHTO_SUPABASE_SERVICE_ROLE_KEY ?? '';
const configured = !!(URL && ANON && SERVICE);

const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

type Actor = { id: string; sb: SupabaseClient; email: string };
const actors: Actor[] = [];

async function makeUser(role: 'client' | 'psych', name: string): Promise<Actor> {
  const email = `righto-test-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + 'A1!';
  const { data: created, error: cErr } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr || !created.user) throw cErr ?? new Error('no user');
  const sb = anon();
  const { error: sErr } = await sb.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  const { error: pErr } = await sb.from('righto_profiles').insert({ user_id: created.user.id, role, display_name: name, consent_version: 'test', consent_at: new Date().toISOString() });
  if (pErr) throw pErr;
  if (role === 'psych') {
    const { error } = await sb.from('righto_psychologists').insert({ user_id: created.user.id, practice: 'Test Practice', ahpra: 'PSY0000000000' });
    if (error) throw error;
  }
  const a = { id: created.user.id, sb, email };
  actors.push(a);
  return a;
}

let psychA: Actor, psychB: Actor, clientC: Actor, clientD: Actor;
let taskId = '';

before(async () => {
  if (!configured) return;
  await admin().from('righto_settings').update({ value: false }).eq('key', 'require_psych_mfa');
  [psychA, psychB, clientC, clientD] = await Promise.all([makeUser('psych', 'Dr A'), makeUser('psych', 'Dr B'), makeUser('client', 'Client C'), makeUser('client', 'Client D')]);
});

after(async () => {
  if (!configured) return;
  const a = admin();
  for (const x of actors) await a.auth.admin.deleteUser(x.id).catch(() => undefined);
  await a.from('righto_settings').update({ value: true }).eq('key', 'require_psych_mfa');
});

const skip = !configured ? 'RIGHTO_SUPABASE_* env not set' : false;

test('invite links a client to the psychologist who minted it, once', { skip }, async () => {
  const { data: inv, error } = await psychA.sb.rpc('righto_create_invite');
  assert.ifError(error);
  const code = (Array.isArray(inv) ? inv[0] : inv).code as string;
  assert.match(code, /^[A-Z2-9]{10}$/);
  const { data: preview } = await clientC.sb.rpc('righto_preview_invite', { p_code: code });
  assert.equal((Array.isArray(preview) ? preview[0] : preview).display_name, 'Dr A');
  const { error: rErr } = await clientC.sb.rpc('righto_redeem_invite', { p_code: code });
  assert.ifError(rErr);
  const { error: again } = await clientD.sb.rpc('righto_redeem_invite', { p_code: code });
  assert.ok(again, 'a used invite must not be redeemable again');
  const { data: bad } = await clientD.sb.rpc('righto_preview_invite', { p_code: 'NOTACODE12' });
  assert.equal((Array.isArray(bad) ? bad.length : bad ? 1 : 0), 0);
});

test('a psychologist can assign only to their linked clients', { skip }, async () => {
  const row = { client_id: clientC.id, psych_id: psychA.id, title: 'Ten-minute walk', why: 'Light and movement in the afternoon dip.', mins: 10 };
  const { data, error } = await psychA.sb.from('righto_tasks').insert(row).select('id').single();
  assert.ifError(error);
  taskId = data!.id;
  const { error: bErr } = await psychB.sb.from('righto_tasks').insert({ ...row, psych_id: psychB.id });
  assert.ok(bErr, 'Dr B is not linked to Client C');
  const { error: spoof } = await psychB.sb.from('righto_tasks').insert({ ...row, psych_id: psychA.id });
  assert.ok(spoof, 'cannot insert on behalf of another psychologist');
});

test('a client sees only their own tasks and can change only the planning fields', { skip }, async () => {
  const { data: mine } = await clientC.sb.from('righto_tasks').select('id');
  assert.deepEqual(mine?.map((t) => t.id), [taskId]);
  const { data: theirs } = await clientD.sb.from('righto_tasks').select('id');
  assert.equal(theirs?.length, 0);
  const { error: planErr } = await clientC.sb.from('righto_tasks').update({ status: 'planned', kind: 'commitment', plan: { routine: 'lunch', how: 'walk for 10 minutes', where: 'around the block', prep: '' }, shared: false }).eq('id', taskId);
  assert.ifError(planErr);
  const { data: tampered, error: tErr } = await clientC.sb.from('righto_tasks').update({ title: 'Something else entirely' }).eq('id', taskId).select('title');
  assert.ok(tErr || !tampered?.length, 'the clinician’s words cannot be edited by the client');
});

test('psychologists read a record only through the logged function, and only what is shared', { skip }, async () => {
  const { data: direct } = await psychA.sb.from('righto_tasks').select('id');
  assert.equal(direct?.length ?? 0, 0, 'no direct SELECT for psychologists');
  const { data: rec, error } = await psychA.sb.rpc('righto_client_record', { p_client: clientC.id });
  assert.ifError(error);
  const tasks = (rec as { tasks: { id: string; plan: unknown; shared: boolean }[] }).tasks;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].plan, null, 'an unshared plan is hidden');
  const { error: bErr } = await psychB.sb.rpc('righto_client_record', { p_client: clientC.id });
  assert.ok(bErr, 'Dr B cannot read Client C');
  const { data: log } = await clientC.sb.from('righto_access_log').select('psych_id, action');
  assert.ok(log?.some((l) => l.psych_id === psychA.id && l.action === 'view_record'), 'the view was logged and the client can see it');
  assert.ok(log?.some((l) => l.psych_id === psychA.id && l.action === 'assign_task'));
});

test('check-ins reach the psychologist only when shared, and never another psychologist', { skip }, async () => {
  const { error: e1 } = await clientC.sb.from('righto_checkins').insert({ task_id: taskId, client_id: clientC.id, outcome: 'done', helped: 'Trainers under the desk.', shared: true });
  assert.ifError(e1);
  const { error: e2 } = await clientC.sb.from('righto_checkins').insert({ task_id: taskId, client_id: clientC.id, outcome: 'missed', helped: 'Private note.', shared: false });
  assert.ifError(e2);
  const { error: forged } = await clientD.sb.from('righto_checkins').insert({ task_id: taskId, client_id: clientD.id, outcome: 'done' });
  assert.ok(forged, 'cannot check in on someone else’s task');
  const { data: rec } = await psychA.sb.rpc('righto_client_record', { p_client: clientC.id });
  const checkins = (rec as { checkins: { helped: string }[] }).checkins;
  assert.equal(checkins.length, 1);
  assert.equal(checkins[0].helped, 'Trainers under the desk.');
  const { data: direct } = await psychB.sb.from('righto_checkins').select('id');
  assert.equal(direct?.length ?? 0, 0);
});

test('ending the link stops new access immediately', { skip }, async () => {
  const { data: link } = await clientC.sb.rpc('righto_my_psychologist');
  const linkId = (Array.isArray(link) ? link[0] : link).link_id as string;
  const { error } = await clientC.sb.rpc('righto_end_link', { p_link: linkId });
  assert.ifError(error);
  const { error: afterErr } = await psychA.sb.rpc('righto_client_record', { p_client: clientC.id });
  assert.ok(afterErr, 'no access after the client ends sharing');
  const { error: assignErr } = await psychA.sb.from('righto_tasks').insert({ client_id: clientC.id, psych_id: psychA.id, title: 'x', why: 'y' });
  assert.ok(assignErr, 'no new homework after the link ends');
});

test('MFA is enforced for psychologists when the setting is on', { skip }, async () => {
  await admin().from('righto_settings').update({ value: true }).eq('key', 'require_psych_mfa');
  try {
    const { error } = await psychA.sb.rpc('righto_my_clients');
    assert.ok(error && /Multi-factor/i.test(error.message), 'an aal1 psychologist session is refused');
  } finally {
    await admin().from('righto_settings').update({ value: false }).eq('key', 'require_psych_mfa');
  }
});
