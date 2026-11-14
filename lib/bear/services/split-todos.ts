// "Call mum, buy milk and book the dentist" is three things, not one. This splits a short typed or spoken input into its
// separate to-dos using fixed rules (no model): a new to-do starts where a new action starts. Anything that does not start
// with an action ("eggs and bread") stays with the to-do before it, so a shopping list remains one list.
// Long text, pasted messages and school notices are never split here: they have their own readers.
const VERBS=new Set(('call ring phone text email message msg buy get grab pick drop book rebook schedule reschedule organise organize arrange plan pay renew cancel return send post mail order reorder fix clean wash vacuum pack unpack sign fill complete submit lodge check find ask tell remind make cook prepare take bring collect register enrol enroll apply update change transfer print write read finish start sort tidy mow water feed walk visit see meet confirm reply respond follow chase look research compare download upload set put move replace repair service donate sell wrap bake do speak talk contact invite rsvp return review file claim top sew iron fold hang charge measure label photocopy scan backup back refill restock swap exchange deliver hire quote decide choose pickup dropoff declutter defrost assemble install test try learn practise practice study revise edit draft proofread upload').split(' '));
const LEAD=/^(?:(?:and|then|also|plus|next|after that|afterwards|finally|lastly|oh|ok|okay|so|first|firstly|second|secondly|third|thirdly)\b[\s,]*)*(?:(?:i|we)\s+(?:also\s+)?(?:need|have|want|ought|should|must|gotta|got)\s*(?:to\s+)?|(?:i|we)(?:'|’)?ve\s+got\s+to\s+|(?:please\s+)?remind\s+me\s+to\s+|don(?:'|’)?t\s+(?:let\s+me\s+)?forget\s+to\s+|remember\s+to\s+|need\s+to\s+|have\s+to\s+|got\s+to\s+|gotta\s+|please\s+|also\s+|to\s+)*/i;
const NOT_A_LIST=/\b(?:subject:|from:|dear\b|hi (?:parents|families|all|everyone)|regards|permission|excursion|incursion|camp\b|newsletter|invoice|account number|bpay|biller code|unsubscribe)\b/i;
const strip=(s:string)=>s.replace(/^[\s\-–—•*·>]+/,'').replace(/^\(?\d{1,2}[.):]\s*/,'').replace(LEAD,'').trim();
const firstWord=(s:string)=>(/^[a-z’']+/i.exec(s)?.[0]||'').toLowerCase().replace(/[’']/g,'');
const actionLed=(s:string)=>VERBS.has(firstWord(strip(s)));
const tidy=(s:string)=>{const t=strip(s).replace(/[\s,;.]+$/,'').trim();return t?t.charAt(0).toUpperCase()+t.slice(1):t;};
export function splitTodos(text:string,max=10):string[]{
 const whole=[text];const src=text.trim();
 if(src.length<8||src.length>700||NOT_A_LIST.test(src))return whole;
 // 1. Hard breaks: new lines, numbered or bulleted items, sentence ends, semicolons.
 const hard=src.replace(/\s+(?=\(?\d{1,2}[.)]\s+\S)/g,'\n').split(/\n+/).map(l=>l.replace(/^[\s\-–—•*·>]+/,'').replace(/^\(?\d{1,2}[.):]\s*/,''))
  .flatMap(l=>l.split(/;\s*|(?<=[a-z0-9)’'"])[.!?]\s+(?=\S)/i)).map(s=>s.trim()).filter(Boolean);
 // 2. Soft breaks inside each piece: commas and "and / then / also", but only where a new action starts.
 const parts:string[]=[];
 for(const piece of hard){
  const bits=piece.split(/\s*,\s*(?:and\s+|then\s+|also\s+)?|\s+(?:and\s+then|and\s+also|and|then|also|plus)\s+/i).map(s=>s.trim()).filter(Boolean);
  let current='';let rebuilt=piece;
  const out:string[]=[];
  // Walk the original piece so the words between actions are kept exactly as written.
  let cursor=0;const starts:number[]=[];
  for(const b of bits){const at=rebuilt.indexOf(b,cursor);if(at<0){starts.length=0;break;}starts.push(at);cursor=at+b.length;}
  if(!starts.length){parts.push(piece);continue;}
  for(let i=0;i<bits.length;i++){
   const seg=rebuilt.slice(starts[i],i+1<bits.length?starts[i+1]:rebuilt.length);
   if(i===0||actionLed(bits[i])){if(current)out.push(current);current=seg;}else current+=seg;
  }
  if(current)out.push(current);
  parts.push(...out.map(s=>s.replace(/[\s,]+(?:and\s+then|and\s+also|and|then|also|plus)?[\s,]*$/i,'')));
 }
 // 3. Only a real list of actions is split: every part must start with an action, and there must be at least two.
 const cleaned=parts.map(tidy).filter(Boolean);
 if(cleaned.length<2||cleaned.length>max||!parts.every(actionLed))return whole;
 if(cleaned.some(c=>c.length<4))return whole;
 return cleaned;
}
