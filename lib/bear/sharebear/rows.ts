// Where delegations are kept. Production: rows of the server's own delivery account (the same private table and account
// reminders and Share Bear links already use), endpoint "sb:<id>". Only the server can read them; it shows a delegation
// only to its owner, and to a recipient only through the token. Locally and in tests: memory.
import type {Delegation} from './core.ts';

export interface DelegationRows{
 get(id:string):Promise<Delegation|null>;
 byTokenHash(hash:string):Promise<Delegation|null>;
 byOwner(ownerId:string):Promise<Delegation[]>;
 byProviderMessage(providerId:string):Promise<Delegation|null>;
 active():Promise<Delegation[]>;
 insert(d:Delegation):Promise<void>;
 // Compare-and-set on the revision: written (as rev+1) only if the stored copy is still at `d.rev`, so two taps or two
 // provider callbacks at once can't both win. Returns whether it was written.
 write(d:Delegation):Promise<boolean>;
 remove(id:string):Promise<void>;
}
const g=globalThis as unknown as {__bearDelegations?:Map<string,Delegation>};
export function memoryDelegations():DelegationRows{
 const m=(g.__bearDelegations??=new Map());const c=<T,>(v:T)=>structuredClone(v);
 return {
  async get(id){const d=m.get(id);return d?c(d):null;},
  async byTokenHash(h){const d=[...m.values()].find(x=>x.tokenHashes.includes(h));return d?c(d):null;},
  async byOwner(o){return [...m.values()].filter(x=>x.ownerId===o).map(c);},
  async byProviderMessage(p){const d=[...m.values()].find(x=>x.messages.some((y:{providerId:string|null})=>y.providerId===p));return d?c(d):null;},
  async active(){return [...m.values()].filter(x=>['SENT','ACCEPTED'].includes(x.status)).map(c);},
  async insert(d){if(m.has(d.id))throw new Error('duplicate');m.set(d.id,c(d));},
  async write(d){const cur=m.get(d.id);if(!cur||cur.rev!==d.rev)return false;m.set(d.id,c({...d,rev:d.rev+1}));return true;},
  async remove(id){m.delete(id);},
 };
}
