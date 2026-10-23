#!/usr/bin/env node
// Makes the "Secret Key" Supabase needs for the Apple provider, from the
// .p8 key downloaded from Apple Developer. Nothing leaves your computer.
//
//   node scripts/apple-signin-secret.mjs AuthKey_ABC123.p8 TEAMID ABC123 app.enough.movement.signin
//
// Arguments: path to the .p8 file, your Team ID, the Key ID, the Services ID.
// Apple limits the secret to six months; run it again and paste the new value
// into Supabase before it expires.
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const [file, teamId, keyId, clientId] = process.argv.slice(2);
if (!file || !teamId || !keyId || !clientId) {
  console.error('Usage: node scripts/apple-signin-secret.mjs <AuthKey.p8> <TEAM_ID> <KEY_ID> <SERVICES_ID>');
  process.exit(1);
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64({ alg: 'ES256', kid: keyId });
const payload = b64({ iss: teamId, iat: now, exp: now + 180 * 24 * 60 * 60 - 60, aud: 'https://appleid.apple.com', sub: clientId });
const signer = createSign('SHA256');
signer.update(`${header}.${payload}`);
const signature = signer.sign({ key: readFileSync(file, 'utf8'), dsaEncoding: 'ieee-p1363' }).toString('base64url');
console.log(`${header}.${payload}.${signature}`);
console.error(`\nSecret key for Supabase → Authentication → Providers → Apple. Expires ${new Date((now + 180 * 24 * 60 * 60 - 60) * 1000).toDateString()}.`);
