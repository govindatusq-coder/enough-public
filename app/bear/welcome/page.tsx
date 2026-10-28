import Link from 'next/link';
import {HeroVertical} from '@/components/bear/art';
import {Horizon} from '@/components/bear/horizon';
export default function Welcome(){
 return (
  <main id="main" className="bear-screen flow" style={{display:'flex',flexDirection:'column',minHeight:'100dvh',position:'relative',overflow:'hidden'}}>
   <Horizon height={220}/>
   <div style={{position:'relative',zIndex:1,display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',flex:1,justifyContent:'center',gap:18,paddingTop:12}}>
    <HeroVertical/>
    <p className="muted" style={{fontSize:16}}>Give it to Bear. We&rsquo;ll take care of the thinking, planning and follow-up.</p>
   </div>
   <div style={{position:'relative',zIndex:1,display:'grid',gap:12,paddingBottom:8}}>
    <Link href="/bear/signin?mode=create" className="btn coral wide" style={{minHeight:58,fontSize:18}}>Let&rsquo;s begin</Link>
    <Link href="/bear/signin" className="btn quiet wide">Already have a Bear? Sign in</Link>
   </div>
  </main>
 );
}
