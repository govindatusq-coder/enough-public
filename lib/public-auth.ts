export function safeReturn(value:string|null){return value&&value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')&&!/[\r\n]/.test(value)?value:'/#moves';}
// Same-origin check for cookie-authenticated writes. The Origin header must match the origin the
// browser addressed: either the URL Next.js reconstructed, or the Host header (with the forwarded
// protocol) when a proxy or loopback alias makes those differ. A cross-site page cannot forge either.
export function sameOrigin(req:Request){
 const origin=req.headers.get('origin');if(!origin)return false;
 if(origin===new URL(req.url).origin)return true;
 const host=req.headers.get('x-forwarded-host')||req.headers.get('host');if(!host||/[\s\/@]/.test(host))return false;
 const proto=(req.headers.get('x-forwarded-proto')||new URL(req.url).protocol.replace(':','')).split(',')[0].trim();
 return origin===`${proto}://${host}`;
}
// Native ENOUGH apps send the Supabase access token as a bearer header. Browsers never attach that
// header automatically, so bearer requests carry no CSRF risk and need no Origin check.
export function bearerToken(req:Request){const match=/^Bearer ([A-Za-z0-9._~+/=-]{20,4096})$/.exec(req.headers.get('authorization')||'');return match?match[1]:null;}
export function trustedWrite(req:Request){return bearerToken(req)!==null||sameOrigin(req);}
