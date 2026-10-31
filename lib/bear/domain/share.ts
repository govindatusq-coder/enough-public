// Turns what another app shares (title, text, link) into one clean note for Bear. Many apps repeat the
// link inside the text or the title inside the text, so each part is only added if it adds something.
export function sharedText(p:{title?:string|null;text?:string|null;url?:string|null}):string{
 const parts:string[]=[];
 for(const raw of [p.title,p.text,p.url]){
  const v=(raw||'').trim();if(!v)continue;
  if(parts.some(x=>x.includes(v)))continue;
  // A longer part that already contains an earlier one (a title repeated at the start of the text) replaces it.
  for(let i=parts.length-1;i>=0;i--)if(v.includes(parts[i]))parts.splice(i,1);
  parts.push(v);
 }
 return parts.join('\n').slice(0,20000);
}
