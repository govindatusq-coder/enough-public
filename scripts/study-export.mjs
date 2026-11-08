// Researcher export for the Load Bear study. Runs locally with the service role; never exposed as an API.
// Usage (from the repo root, with the variables set in your shell, not committed):
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… BEAR_STUDY_SECRET=… BEAR_STUDY_ID=loadbear-pilot-1 \
//   node scripts/study-export.mjs
// Writes study-export/<date>/participants.csv, responses.csv and export.json (gitignored). Keep the
// study secret safe: it is what makes participant codes stable and non-reversible.
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {SupabaseStore} from '../lib/bear/store/supabase.ts';
import {buildStudyExport,toCSV} from '../lib/bear/study/export.ts';
const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,BEAR_STUDY_SECRET:secret,BEAR_STUDY_ID:studyId='loadbear-pilot-1'}=process.env;
if(!url||!key||!secret){console.error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and BEAR_STUDY_SECRET.');process.exit(1);}
const admin=createClient(url,key,{auth:{persistSession:false}});
const {data,error}=await admin.from('bear_profiles').select('user_id,body');if(error){console.error('Could not read profiles.');process.exit(1);}
const users=(data||[]).filter(r=>r.body?.research?.consent&&r.body.research.studyId===studyId).map(r=>r.user_id);
const today=new Date().toISOString().slice(0,10);
const out=await buildStudyExport(users.map(u=>new SupabaseStore(u,admin)),{secret,studyId,today});
const dir=resolve('study-export',today);mkdirSync(dir,{recursive:true});
writeFileSync(resolve(dir,'participants.csv'),toCSV(out.participants));writeFileSync(resolve(dir,'responses.csv'),toCSV(out.responses.map(({answers,...r})=>({...r,...answers}))));
writeFileSync(resolve(dir,'export.json'),JSON.stringify({studyId,exportedOn:today,...out},null,1));
console.log(`Exported ${out.participants.length} participants and ${out.responses.length} responses to ${dir}`);
