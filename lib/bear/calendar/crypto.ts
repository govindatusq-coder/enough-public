import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
// Tokens are encrypted before they reach the database: AES-256-GCM, a fresh random IV each time, and the owner's user id as
// authenticated data, so a ciphertext copied to another person's row won't decrypt. The key lives in BEAR_TOKEN_KEY
// (32 random bytes, base64). If the key is wrong or missing, decrypt fails: it never returns garbage.
const key=(k:string)=>{const b=Buffer.from(k,'base64');if(b.length!==32)throw new Error('bad_token_key');return b;};
export function encrypt(plain:string,keyB64:string,userId:string):string{
 const iv=randomBytes(12);const c=createCipheriv('aes-256-gcm',key(keyB64),iv);c.setAAD(Buffer.from(userId));
 const body=Buffer.concat([c.update(plain,'utf8'),c.final()]);return ['v1',iv.toString('base64url'),c.getAuthTag().toString('base64url'),body.toString('base64url')].join('.');
}
export function decrypt(blob:string,keyB64:string,userId:string):string{
 const [v,iv,tag,body]=blob.split('.');if(v!=='v1'||!iv||!tag||!body)throw new Error('bad_ciphertext');
 const d=createDecipheriv('aes-256-gcm',key(keyB64),Buffer.from(iv,'base64url'));d.setAAD(Buffer.from(userId));d.setAuthTag(Buffer.from(tag,'base64url'));
 return Buffer.concat([d.update(Buffer.from(body,'base64url')),d.final()]).toString('utf8');
}
