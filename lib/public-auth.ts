export function safeReturn(value:string|null){return value&&value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')&&!/[\r\n]/.test(value)?value:'/#moves';}
export function sameOrigin(req:Request){return req.headers.get('origin')===new URL(req.url).origin;}
