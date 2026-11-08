import type {Metadata} from 'next';
import {headers} from 'next/headers';
import {TopBar} from '@/components/bear/ui';
export const metadata:Metadata={title:'Bear in Outlook',robots:{index:false}};
export const dynamic='force-dynamic';
// How to add Load Bear to Outlook. The manifest link is for this deployment, so the preview and the
// live app each install their own add-in.
export default async function OutlookHelp(){
 const h=await headers();const host=h.get('x-forwarded-host')||h.get('host')||'';const proto=/^(localhost|127\.)/.test(host)?'http':'https';
 const manifest=`${proto}://${host}/outlook/manifest.xml`;
 return <main id="main" className="bear-screen flow">
  <TopBar back={{href:'/bear/me',label:'Settings'}}/>
  <h1>Bear in Outlook</h1>
  <p className="muted" style={{marginTop:8}}>Open an email in Outlook, tap <b>Give to Bear</b>, and Bear works out what it asks of you. Bear only sees the email you give it, and only when you tap.</p>
  <section className="section" aria-labelledby="ol-add"><p className="eyebrow" id="ol-add">Add it once</p><div className="card">
   <ol className="small" style={{paddingLeft:20,margin:0,display:'grid',gap:8}}>
    <li>Open Outlook on the web (outlook.office.com or outlook.live.com) on a computer.</li>
    <li>Go to <b>aka.ms/olksideload</b>. It opens <b>Add-ins for Outlook</b>.</li>
    <li>Choose <b>My add-ins</b>, then <b>Add a custom add-in</b> → <b>Add from URL</b>.</li>
    <li>Paste this link, then choose <b>Install</b>:<br/><span style={{fontWeight:700,wordBreak:'break-all'}}>{manifest}</span></li>
   </ol>
   <p className="small muted" style={{marginTop:10}}>It then appears in Outlook on the web, the new Outlook for Windows, Outlook for Mac, and the Outlook app on your phone, on the same account.</p>
  </div></section>
  <section className="section" aria-labelledby="ol-use"><p className="eyebrow" id="ol-use">Use it</p><div className="card">
   <ol className="small" style={{paddingLeft:20,margin:0,display:'grid',gap:8}}>
    <li>Open an email. Choose <b>Give to Bear</b> (in the toolbar, or under <b>Apps</b> or <b>…</b>).</li>
    <li>The first time, sign in with your Load Bear email and password.</li>
    <li>Tap <b>Give this to Bear</b>. Tick any PDFs or photos you want Bear to read too.</li>
   </ol>
   <p className="small muted" style={{marginTop:10}}>Work or school accounts: your IT team may need to allow custom add-ins first.</p>
  </div></section>
 </main>;
}
