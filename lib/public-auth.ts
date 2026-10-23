export function safeReturn(value:string|null){return value&&value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')&&!/[\r\n]/.test(value)?value:'/#moves';}
export function sameOrigin(req:Request){return req.headers.get('origin')===new URL(req.url).origin;}
// Native ENOUGH apps send the Supabase access token as a bearer header. Browsers never attach that
// header automatically, so bearer requests carry no CSRF risk and need no Origin check.
export function bearerToken(req:Request){const match=/^Bearer ([A-Za-z0-9._~+/=-]{20,4096})$/.exec(req.headers.get('authorization')||'');return match?match[1]:null;}
export function trustedWrite(req:Request){return bearerToken(req)!==null||sameOrigin(req);}
