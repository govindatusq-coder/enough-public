// One-shot deterministic integration patch for PR #19.
import fs from 'node:fs';
const path='app/page.tsx';
let s=fs.readFileSync(path,'utf8');
const must=(from,to,label)=>{if(!s.includes(from))throw new Error(`Could not find ${label}`);s=s.replace(from,to)};
must('import { EnoughDashboard } from "@/components/discovery";','import { EnoughLifeHome } from "@/components/enough-life-home";','dashboard import');
must('import { groups, currencies, emptyState, completeProfile, localDate, receipt, accept, finish, restore, STORAGE_KEY, type State, type Profile, type Category } from "@/lib/journey";','import { groups, currencies, emptyState, completeProfile, localDate, receipt, accept, finish, keepSwap, restore, STORAGE_KEY, type State, type Profile, type Category } from "@/lib/journey";','journey import');
const start=' {tab==="enough"&&<><EnoughDashboard ';
const end='/><details className="movement-disclosure">';
const a=s.indexOf(start),b=s.indexOf(end,a);
if(a<0||b<0)throw new Error('Could not find My Enough dashboard block');
const replacement=` {tab==="enough"&&<><EnoughLifeHome state={state} onIdea={id=>{navigate('moves');setFilter('Explore');setIndex(id);setDetailOpen(true)}} onBrowse={()=>{setFilter('Explore');navigate('moves')}} onKeep={id=>{if(!isComplete){setModal('setup');return}if(!accountStore.cloud){pendingIdeaId.current=id;setIndex(id);setPending('accept');setModal('account');return}const next=keepSwap(accept({...state,demo:true},id),id);setState({...next,demo:false});setNotice('Kept. Try it when the moment appears.');navigate('moves');setFilter('Planned')}} onQuiet={()=>update(s=>({...s,quietEnough:!s.quietEnough}))}/><details className="movement-disclosure">`;
s=s.slice(0,a)+replacement+s.slice(b+end.length);
must("<button className=\"primary experience-accept\" onClick={()=>act('accept')}>{state.entries.some(e=>e.ideaId===idea.id&&e.status==='accepted')?'View my experience':'Sounds good'}</button>","<button className=\"primary experience-accept\" onClick={()=>act('accept')}>{state.entries.some(e=>e.ideaId===idea.id&&e.status==='accepted')?'View my experience':\"I’ll try this\"}</button>",'accept label');
fs.writeFileSync(path,s);
