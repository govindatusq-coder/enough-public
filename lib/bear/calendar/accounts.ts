import type {Owned} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {decrypt,encrypt} from './crypto.ts';
export interface ConnectedAccount extends Owned{provider:'microsoft';scopes:string[];encrypted:string;expiresAt:string;connectedAt:string}
export interface Tokens{accessToken:string;refreshToken:string|null;expiresAt:string}
// What is stored is ONE encrypted blob of both tokens. Nothing else about the account (no name, no email address).
export async function saveTokens(store:BearStore,t:Tokens,keyB64:string,scopes:string[],now=new Date()):Promise<void>{
 const encrypted=encrypt(JSON.stringify({a:t.accessToken,r:t.refreshToken}),keyB64,store.userId);
 const existing=(await store.list('connected_accounts',{where:[{column:'provider',value:'microsoft'}],limit:1}))[0];
 if(existing)await store.update('connected_accounts',existing.id,{encrypted,expiresAt:t.expiresAt,scopes});
 else await store.insert('connected_accounts',stamp<ConnectedAccount>(store.userId,{provider:'microsoft',scopes,encrypted,expiresAt:t.expiresAt,connectedAt:now.toISOString()}));
}
export async function loadTokens(store:BearStore,keyB64:string):Promise<Tokens|null>{
 const row=(await store.list('connected_accounts',{where:[{column:'provider',value:'microsoft'}],limit:1}))[0];if(!row)return null;
 try{const j=JSON.parse(decrypt(row.encrypted,keyB64,store.userId)) as {a:string;r:string|null};return {accessToken:j.a,refreshToken:j.r,expiresAt:row.expiresAt};}catch{return null;}
}
export async function isConnected(store:BearStore):Promise<boolean>{return (await store.list('connected_accounts',{where:[{column:'provider',value:'microsoft'}],limit:1})).length>0;}
export async function disconnect(store:BearStore):Promise<void>{for(const r of await store.list('connected_accounts',{where:[{column:'provider',value:'microsoft'}]}))await store.remove('connected_accounts',r.id);}
