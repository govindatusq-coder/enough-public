import type {Metadata} from 'next';
import Link from 'next/link';
import {TopBar} from '@/components/bear/ui';
export const metadata:Metadata={title:'Privacy · Load Bear'};
// Plain-language notice describing what Load Bear actually does today. DRAFT for the owner to have reviewed
// before a public launch (see docs/OWNER_ACTIONS.md): it is not legal advice and has not been legally reviewed.
const support=process.env.NEXT_PUBLIC_BEAR_SUPPORT_EMAIL||null;
export default function BearPrivacy(){
 return <main id="main" className="bear-screen flow">
  <TopBar back={{href:'/bear/me',label:'Settings'}}/>
  <h1>Privacy</h1>
  <p className="muted" style={{marginTop:8}}>What Load Bear keeps, who can see it, and how to delete it. Load Bear is an early version for invited parents.</p>
  <section className="section"><p className="eyebrow">What Bear keeps</p><div className="card"><ul className="small" style={{paddingLeft:20,margin:0,display:'grid',gap:8}}>
   <li>What you give Bear: pasted text, photos, screenshots, PDFs and emails you choose to share, and what Bear reads out of them (dates, amounts, who asked, what is needed).</li>
   <li>The tasks, reminders, notes and answers you set up, and what you mark done.</li>
   <li>Your name, email, and the household details you chose to give.</li>
   <li>For bills: the biller, amount, dates and payment reference. Bear doesn’t ask for card numbers, CVVs or bank passwords.</li>
  </ul></div></section>
  <section className="section"><p className="eyebrow">Who can see it</p><div className="card"><ul className="small" style={{paddingLeft:20,margin:0,display:'grid',gap:8}}>
   <li>Only your signed-in account can open your items and files. Other Load Bear users cannot.</li>
   <li>To read messy notices, what you give Bear may be sent to an AI service (Anthropic) to be read. It is used to read your item, nothing else. If that service is not switched on or is down, Bear uses simpler built-in reading and says so.</li>
   <li>It is stored with our hosting and database providers (Vercel and Supabase). The people who run Load Bear can technically reach the database to keep it running; they don’t read your items for any other purpose.</li>
   <li>Bear never sends, submits, books or pays anything for you. Calendar files and reply drafts are made for you to use yourself.</li>
  </ul></div></section>
  <section className="section"><p className="eyebrow">Your choices</p><div className="card"><p className="small" style={{margin:0}}>In <Link href="/bear/me" style={{textDecoration:'underline'}}>Settings</Link> you can <b>delete everything Bear holds about you</b>: items, files, reminders and answers. It can’t be undone.{support?<> To have your sign-in removed too, or to ask anything, email <a href={`mailto:${support}`} style={{textDecoration:'underline'}}>{support}</a>.</>:<> To have your sign-in removed too, or to ask anything, contact the person who invited you to Load Bear.</>}</p></div></section>
  <section className="section"><p className="eyebrow">Good to know</p><div className="card"><ul className="small" style={{paddingLeft:20,margin:0,display:'grid',gap:8}}>
   <li>Bear can misread things. It shows what it found so you can check it, and asks before anything important changes.</li>
   <li>Don’t give Bear anything you wouldn’t want read by an AI service, such as full medical records.</li>
   <li>Reminders are push notifications and the list on Bear’s main screen. A phone that blocks notifications will not buzz, so check the main screen.</li>
  </ul></div></section>
 </main>;
}
