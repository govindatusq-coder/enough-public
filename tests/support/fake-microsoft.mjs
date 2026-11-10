// A local stand-in for Microsoft sign-in and Graph events, for tests ONLY. It enforces what the real service enforces
// that matters here: PKCE, the client secret, bearer tokens that expire, and transactionId de-duplication.
// It is not a mock of Load Bear: the real adapter talks to it over real HTTP.
import {createServer} from 'node:http';
import {createHash,randomBytes} from 'node:crypto';
export function startFakeMicrosoft(){
 const state={codes:new Map(),access:new Set(),refresh:new Set(),events:new Map(),byTxn:new Map(),log:[],failNext:null,hangNext:false,expireAccessOnNextCall:false,secret:'test-secret',clientId:'test-client',createCount:0};
 const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x');let body='';for await(const c of req)body+=c;
  const send=(code,obj,h={})=>{res.writeHead(code,{'Content-Type':'application/json',...h});res.end(JSON.stringify(obj));};
  state.log.push(req.method+' '+u.pathname);
  if(u.pathname.endsWith('/oauth2/v2.0/authorize')){
   const q=u.searchParams;if(q.get('client_id')!==state.clientId||q.get('code_challenge_method')!=='S256'||!q.get('code_challenge')||!q.get('state'))return send(400,{error:'invalid_request'});
   const code=randomBytes(8).toString('hex');state.codes.set(code,{challenge:q.get('code_challenge'),redirect:q.get('redirect_uri')});
   res.writeHead(302,{Location:`${q.get('redirect_uri')}?code=${code}&state=${encodeURIComponent(q.get('state'))}`});return res.end();
  }
  if(u.pathname.endsWith('/oauth2/v2.0/token')&&req.method==='POST'){
   const p=new URLSearchParams(body);if(p.get('client_id')!==state.clientId||p.get('client_secret')!==state.secret)return send(401,{error:'invalid_client'});
   const issue=()=>{const a='at-'+randomBytes(6).toString('hex'),r='rt-'+randomBytes(6).toString('hex');state.access.add(a);state.refresh.add(r);return {access_token:a,refresh_token:r,expires_in:3600};};
   if(p.get('grant_type')==='authorization_code'){const c=state.codes.get(p.get('code'));if(!c)return send(400,{error:'invalid_grant'});
    if(createHash('sha256').update(p.get('code_verifier')||'').digest('base64url')!==c.challenge)return send(400,{error:'invalid_grant'});state.codes.delete(p.get('code'));return send(200,issue());}
   if(p.get('grant_type')==='refresh_token'){if(!state.refresh.has(p.get('refresh_token')))return send(400,{error:'invalid_grant'});return send(200,issue());}
   return send(400,{error:'unsupported_grant_type'});
  }
  if(u.pathname.startsWith('/v1.0/me/events')){
   const tok=(req.headers.authorization||'').replace('Bearer ','');
   if(state.expireAccessOnNextCall){state.expireAccessOnNextCall=false;state.access.clear();}
   if(!state.access.has(tok))return send(401,{error:{code:'InvalidAuthenticationToken'}});
   if(req.method==='POST'){
    if(state.hangNext){state.hangNext=false;const j=JSON.parse(body);if(!state.byTxn.has(j.transactionId)){const id='ev-'+(++state.createCount);const ev={...j,id};state.events.set(id,ev);state.byTxn.set(j.transactionId,id);}return;}   // created, but the reply is lost
    if(state.failNext){const s=state.failNext;state.failNext=null;return send(s,{error:{code:'Failure'}});}
    const j=JSON.parse(body);if(state.byTxn.has(j.transactionId))return send(201,state.events.get(state.byTxn.get(j.transactionId)));   // Graph returns the existing event
    const id='ev-'+(++state.createCount);const ev={...j,id};state.events.set(id,ev);state.byTxn.set(j.transactionId,id);return send(201,ev);
   }
   if(req.method==='GET'){const id=decodeURIComponent(u.pathname.split('/').pop());const ev=state.events.get(id);return ev?send(200,{id:ev.id,subject:ev.subject}):send(404,{error:{code:'ErrorItemNotFound'}});}
  }
  send(404,{error:'not_found'});
 });
 return new Promise(r=>server.listen(0,'127.0.0.1',()=>{const base=`http://127.0.0.1:${server.address().port}`;
  r({state,base,authority:base,graphBase:base+'/v1.0',close:()=>new Promise(x=>{server.closeAllConnections?.();server.close(()=>x());})});}));
}
