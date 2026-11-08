import {randomBytes} from 'node:crypto';

// Per-person forwarding addresses: bear-<token>@<inbound domain>. The token is 128 random bits
// (26 base32 characters), unguessable and unrelated to the person's id or email. It can be revoked
// and replaced at any time; a revoked token simply stops routing.
const ALPHABET='abcdefghijklmnopqrstuvwxyz234567';
export function newToken(){const b=randomBytes(17);let out='';for(let i=0;i<26;i++)out+=ALPHABET[b[i%17]%32];return out;}
export const addressFor=(token:string,domain:string)=>`bear-${token}@${domain.toLowerCase()}`;
const TOKEN=/^[a-z2-7]{26}$/;
// Only an exact bear-<token>@<our domain> routes; display names and case are tolerated, nothing else.
export function tokenFromAddress(address:string,domain:string):string|null{
 const m=/<?([^<>\s]+@[^<>\s]+)>?\s*$/.exec(address.trim());if(!m)return null;
 const [local,host]=m[1].toLowerCase().split('@');if(host!==domain.toLowerCase())return null;
 const t=local.startsWith('bear-')?local.slice(5):'';return TOKEN.test(t)?t:null;
}
