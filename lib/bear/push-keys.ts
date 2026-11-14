// Keys the server needs for push, derived from a secret it already holds, so push works without anyone creating and
// pasting extra keys. Derivation is one-way (HKDF): the derived keys reveal nothing about the secret they came from.
// If explicit keys are configured (BEAR_VAPID_*), those are used instead.
import {createECDH,createHash,hkdfSync} from 'node:crypto';
const b64u=(b:Buffer)=>b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function derive(secret:string,label:string,bytes=32){return Buffer.from(hkdfSync('sha256',secret,'load-bear/v1',label,bytes));}
// A stable secret already present on the server. The order never changes, so the derived keys stay the same.
export function serverSecret(env:Record<string,string|undefined>=process.env){const s=env.BEAR_SERVER_SECRET||env.ANTHROPIC_API_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'';return s.length>=20?s:null;}
export function derivedVapid(secret:string){
 for(let i=0;i<8;i++){try{const ecdh=createECDH('prime256v1');const priv=derive(secret,'vapid-private-'+i);ecdh.setPrivateKey(priv);return {publicKey:b64u(ecdh.getPublicKey()),privateKey:b64u(priv)};}catch{/* not a valid key (astronomically unlikely): try the next */}}
 throw new Error('could not derive push keys');
}
// The delivery account's sign-in. The address carries a fingerprint of the secret, so a changed secret gets a fresh account
// instead of being locked out of the old one.
export function outboxIdentity(secret:string,host:string){const fp=createHash('sha256').update(derive(secret,'outbox-fp')).digest('hex').slice(0,10);return {email:`bear-outbox-${fp}@${host}`,password:b64u(derive(secret,'outbox-password',32))};}
export function uuidFor(secret:string,label:string){const h=createHash('sha256').update(derive(secret,'uuid')).update(label).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
