// The name comes from the login (sign-up form, or Google's profile): first name only.
export function firstName(m:Record<string,unknown>|null|undefined):string{const pick=(k:string)=>typeof m?.[k]==='string'?(m[k] as string).trim():'';return (pick('name')||pick('given_name')||pick('full_name')||pick('display_name')).split(/\s+/)[0].slice(0,40);}
