'use client';
// Client fetch helpers for /api/bear. Every call reports network failure honestly.
export class ApiError extends Error{readonly status:number;readonly body:Record<string,unknown>;constructor(message:string,status:number,body:Record<string,unknown>={}){super(message);this.status=status;this.body=body;}}
export const OFFLINE_MESSAGE="You're offline. Bear will be here when you're back.";
async function parse(res:Response){let body:Record<string,unknown>={};try{body=await res.json();}catch{/* no body */}
 if(!res.ok)throw new ApiError(typeof body.error==='string'?body.error:res.status===401?'Sign in to give things to Bear.':'Bear hit a snag. Please try again.',res.status,body);return body;}
async function run(input:string,init?:RequestInit){try{return await fetch(input,{credentials:'same-origin',...init});}catch{throw new ApiError(typeof navigator!=='undefined'&&!navigator.onLine?OFFLINE_MESSAGE:'Bear could not reach the server. Check your connection and try again.',0);}}
export async function apiGet<T=Record<string,unknown>>(path:string):Promise<T>{return parse(await run(path,{headers:{Accept:'application/json'}})) as Promise<T>;}
export async function apiSend<T=Record<string,unknown>>(path:string,body:unknown,method='POST'):Promise<T>{return parse(await run(path,{method,headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)})) as Promise<T>;}
export async function apiForm<T=Record<string,unknown>>(path:string,form:FormData):Promise<T>{return parse(await run(path,{method:'POST',body:form,headers:{Accept:'application/json'}})) as Promise<T>;}
