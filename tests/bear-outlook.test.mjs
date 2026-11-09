// Bear in Outlook: what the add-in sends (and doesn't), which attachments it reads, the manifest,
// and the headers that let only the add-in's pages sit inside Outlook.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureText,readableAttachments,mimeOf,base64ToBytes,givenKey,outlookManifest,OUTLOOK_FILE_TYPES,OUTLOOK_LIMITS} from '../lib/bear/outlook/item.ts';
import {MAX_FILE_BYTES,supportedImageMimes,supportedDocumentMimes} from '../lib/bear/services/capture.ts';
import {contentSecurityPolicy} from '../lib/content-security-policy.ts';
import {extractResponsibilities} from '../lib/bear/engine/extract.ts';

test('the capture text: subject, sender, sent date, then the body; tidy and bounded',()=>{
 const t=captureText({subject:'  Year 5 camp  ',from:'Oak Hill PS <office@oakhill.edu.au>',received:'2026-11-03T22:10:00.000Z',body:'Hi families,\r\n\r\n\r\n\r\nPayment of $180 is due 12 November. Thanks'});
 assert.equal(t,'Subject: Year 5 camp\nFrom: Oak Hill PS <office@oakhill.edu.au>\n\nHi families,\n\nPayment of $180 is due 12 November. Thanks');
 assert.ok(captureText({subject:'x',body:'y'.repeat(50000)}).length<=OUTLOOK_LIMITS.maxTextChars);
 assert.equal(captureText({}),'');
});
test('long reply chains keep the newest message',()=>{
 const body='Please return the permission form by Friday. '.repeat(100)+'\nOn Mon, 2 Nov 2026 at 9:00 am, Jo <jo@x.com> wrote:\n'+'Old news about something else. '.repeat(50);
 const t=captureText({subject:'Re: camp',body});assert.ok(t.includes('permission form'));assert.ok(!t.includes('Old news'));
});
test('what the add-in sends goes through the same pipeline, and the sent date is never read as a due date',async()=>{
 const {MemoryBackend}=await import('../lib/bear/store/memory.ts');const {ensureProfile,saveProfile}=await import('../lib/bear/services/profile.ts');
 const {createCapture}=await import('../lib/bear/services/capture.ts');const {maybeAutoSetup}=await import('../lib/bear/services/auto-setup.ts');
 const s=new MemoryBackend().for('12121212-1212-4121-8121-121212121212');await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family','home','money'],onboardingComplete:true});
 const text=captureText({subject:'Year 5 camp',from:'Oak Hill PS <office@oakhill.edu.au>',received:'2026-11-03T22:10:00.000Z',body:'Year 5 camp is on 18 November. Payment of $180 is due 12 November. Please return the permission form by 10 November.'});
 assert.ok(!text.includes('2026-11-03'));
 const {extraction}=await createCapture(s,null,{method:'email',text,referenceYear:2026});const a=await maybeAutoSetup(s,extraction,new Date('2026-11-09T09:00:00+11:00'));
 assert.ok(a?.task);assert.notEqual(a.task.dueAt,'2026-11-03');
 const r=extractResponsibilities(text,{today:'2026-11-09',sourceId:'s'}).responsibilities;assert.deepEqual(r.map(x=>x.dueDate).sort(),['2026-11-10','2026-11-12']);
});
test('attachments: PDFs and real pictures only; not signatures, logos, cloud links or anything too big',()=>{
 const list=[
  {id:'1',name:'Camp form.pdf',contentType:'application/pdf',size:200000},
  {id:'2',name:'logo.png',contentType:'image/png',size:4000,isInline:false},
  {id:'3',name:'signature.jpg',contentType:'image/jpeg',size:90000,isInline:true},
  {id:'4',name:'Photo.HEIC',contentType:'application/octet-stream',size:900000},
  {id:'5',name:'notes.docx',contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:30000},
  {id:'6',name:'huge.pdf',contentType:'application/pdf',size:OUTLOOK_LIMITS.maxAttachmentBytes+1},
  {id:'7',name:'Shared.pdf',contentType:'application/pdf',size:5000,attachmentType:'cloud'},
  {id:'8',name:'invite.ics',contentType:'text/calendar',size:2000},
 ];
 assert.deepEqual(readableAttachments(list).map(a=>a.id),['1','4']);
 assert.equal(mimeOf({name:'Photo.HEIC',contentType:'application/octet-stream'}),'image/heic');
 assert.equal(readableAttachments(Array.from({length:9},(_,i)=>({id:String(i),name:i+'.pdf',contentType:'application/pdf',size:1000}))).length,OUTLOOK_LIMITS.maxAttachments);
});
test('the add-in’s file rules stay in step with the capture service',()=>{
 assert.deepEqual([...OUTLOOK_FILE_TYPES].sort(),[...supportedImageMimes,...supportedDocumentMimes].sort());assert.equal(OUTLOOK_LIMITS.maxAttachmentBytes,MAX_FILE_BYTES);
});
test('helpers: base64 decoding and the per-email “given” key never holds content',()=>{
 assert.deepEqual([...base64ToBytes('SGk=')],[72,105]);assert.equal(givenKey(null),null);assert.ok(givenKey('AAMkAD'+'x'.repeat(200)).length<=20+80);
});
test('the manifest: this deployment’s URLs, read-only, a Give to Bear button on desktop and mobile',()=>{
 const xml=outlookManifest('https://preview.example.app/');
 assert.match(xml,/^<\?xml version="1.0"/);assert.match(xml,/xsi:type="MailApp"/);
 assert.match(xml,/<Permissions>ReadItem<\/Permissions>/,'reads the open email only: no ReadWriteMailbox');
 assert.ok(!/ReadWriteMailbox|ReadWriteItem/.test(xml));
 assert.match(xml,/<bt:Url id="paneUrl" DefaultValue="https:\/\/preview\.example\.app\/bear\/outlook"\/>/);
 assert.match(xml,/<AppDomain>https:\/\/preview\.example\.app<\/AppDomain>/);
 assert.match(xml,/MessageReadCommandSurface/);assert.match(xml,/<SupportsPinning>true<\/SupportsPinning>/);assert.match(xml,/MobileMessageReadCommandSurface/);assert.match(xml,/DefaultValue="Give to Bear"/);
 for(const n of [16,32,64,80,128]){assert.ok(xml.includes(`/outlook/icon-${n}.png`));assert.ok(readFileSync(new URL(`../public/outlook/icon-${n}.png`,import.meta.url)).length>100);}
 // Balanced tags (a cheap well-formedness check; Outlook rejects a broken manifest outright).
 const opens=(xml.match(/<[A-Za-z][^>]*[^/]>/g)||[]).filter(t=>!t.startsWith('<?')).length,closes=(xml.match(/<\/[A-Za-z]/g)||[]).length;assert.equal(opens,closes);
 assert.match(outlookManifest('https://a.b',{preview:true}),/<DisplayName DefaultValue="Load Bear \(preview\)"\/>/);assert.match(xml,/<DisplayName DefaultValue="Load Bear"\/>/);
 assert.match(outlookManifest('https://a.b',{id:'11111111-2222-4333-8444-555555555555'}),/<Id>11111111-2222-4333-8444-555555555555<\/Id>/);
});
test('the boot script starts Office.js first and keeps Next.js’s history working when Office.js nulls it',async()=>{
 const {OFFICE_BOOT,OFFICE_JS}=await import('../lib/bear/outlook/boot.ts');assert.ok(OFFICE_BOOT.includes(OFFICE_JS));
 const added=[];function P(){}P.prototype.pushState=function(){return 'push';};P.prototype.replaceState=function(){return 'replace';};const h=new P();
 const doc={getElementById:()=>null,createElement:()=>({}),head:{appendChild:(s)=>added.push(s)}};
 new Function('window','document',OFFICE_BOOT)({history:h},doc);
 h.pushState=null;h.replaceState=null;assert.equal(h.replaceState(),'replace');assert.equal(h.pushState(),'push');
 h.pushState=()=>'wrapped';assert.equal(h.pushState(),'wrapped','real functions (Next.js wrapping) still accepted');
 assert.equal(added.length,1);assert.equal(added[0].id,'office-js');assert.equal(added[0].src,OFFICE_JS);
});
test('only the add-in’s pages may sit inside Outlook; everything else still can’t be framed',()=>{
 const normal=contentSecurityPolicy({supabaseUrl:'https://p.supabase.co'});assert.ok(normal.includes("frame-ancestors 'none'"));assert.ok(!normal.includes('appsforoffice'));
 const ol=contentSecurityPolicy({supabaseUrl:'https://p.supabase.co',outlook:true});
 assert.match(ol,/frame-ancestors https:\/\/outlook\.office\.com .*https:\/\/outlook\.live\.com/);assert.ok(ol.includes('script-src \'self\' \'unsafe-inline\' https://appsforoffice.microsoft.com'));
 assert.ok(!ol.includes("frame-ancestors 'none'"));
 // Office.js can't start inside Outlook without MicrosoftAjax.js (this was the real-Outlook “couldn't start” error).
 for(const o of ['https://ajax.aspnetcdn.com','https://officeapis.public.onecdn.static.microsoft'])assert.match(ol,new RegExp("script-src[^;]*"+o.replace(/\./g,'\\.')));
 assert.match(ol,/frame-ancestors[^;]*https:\/\/\*\.microsoft /,'outlook.cloud.microsoft');assert.ok(!ol.includes('unsafe-eval'));assert.ok(!/frame-ancestors[^;]*\*(?!\.)/.test(ol),'no bare wildcard');
 const cfg=readFileSync(new URL('../next.config.ts',import.meta.url),'utf8');assert.match(cfg,/'\/bear\/outlook','\/bear\/outlook\/:path\*'/);
});
