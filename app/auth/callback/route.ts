import {NextResponse} from 'next/server';
import {serverClient} from '@/lib/supabase/server';
import {safeReturn} from '@/lib/public-auth';
export async function GET(req:Request){
 const url=new URL(req.url),code=url.searchParams.get('code');
 if(code){const db=await serverClient();const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(safeReturn(url.searchParams.get('next')),url.origin),{headers:{'Cache-Control':'private, no-store'}});}
 // No code: this may be Load Bear's email-confirmation link, whose token arrives in the URL
 // fragment (which never reaches the server). A tiny page reads it, records the confirmation,
 // and says so; anything else goes on to sign-in as before.
 return new NextResponse(CONFIRM_PAGE,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
}
const CONFIRM_PAGE=`<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Load Bear</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FFF7E8;color:#102A43;font:17px/1.5 -apple-system,system-ui,sans-serif;text-align:center;padding:24px}h1{font-size:26px;margin:0 0 8px}a{display:inline-block;margin-top:18px;padding:14px 24px;border-radius:999px;background:#FF5147;color:#fff;font-weight:700;text-decoration:none}</style></head>
<body><main><h1 id="t">One moment…</h1><p id="m"></p><a id="go" href="/bear" hidden>Back to Load Bear</a></main>
<script>(async()=>{const h=new URLSearchParams(location.hash.slice(1));const t=h.get('access_token');
if(!t){location.replace('/signin?error=callback');return;}
history.replaceState(null,'',location.pathname);
try{const r=await fetch('/api/bear/email-verified',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:t})});const j=await r.json();
if(r.ok){document.getElementById('t').textContent='Email confirmed.';document.getElementById('m').textContent='Thanks. You can always get back into your Bear now.';}
else{document.getElementById('t').textContent='That didn’t work.';document.getElementById('m').textContent=j.error||'Send a new link from Settings in Load Bear.';}}
catch{document.getElementById('t').textContent='That didn’t work.';document.getElementById('m').textContent='Check your connection, then try the link again.';}
document.getElementById('go').hidden=false;})();</script></body></html>`;
