'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Plus} from 'lucide-react';
import {useReckon} from '@/lib/reckon/store';
import {greeting} from '@/lib/reckon/labels';
import {themeTitle, factText} from '@/lib/reckon/model';
import {ReckonWordmark} from '@/components/reckon/mark';
import {Card, Eyebrow} from '@/components/reckon/ui';
import {ReflectionFlow} from '@/components/reckon/reflection-flow';

export default function HomePage() {
  const {state, ready} = useReckon();
  const [now] = useState(() => Date.now());
  const [reflecting, setReflecting] = useState<string | null>(null);
  if (!ready) return <header className="rk-header"><ReckonWordmark /></header>;

  const confirmed = state.items.filter(i => i.takeaway && !i.archived);
  const unfinished = state.items.filter(i => !i.takeaway && !i.archived);
  const dayIndex = Math.floor(now / 86_400_000);

  // Something worth carrying: a principle, a FEEL/BECOME/REMEMBER takeaway, rotated daily.
  const principles = state.facts.filter(f => f.section === 'principles' && (f.status === 'user_confirmed' || f.status === 'user_modified'));
  const carryPool = [...principles.map(factText), ...confirmed.filter(i => ['FEEL', 'BECOME', 'REMEMBER', 'THINK'].includes(i.route?.function ?? '')).map(i => i.takeaway!.text)];
  const carry = carryPool.length ? carryPool[dayIndex % carryPool.length] : confirmed[dayIndex % Math.max(1, confirmed.length)]?.takeaway?.text;

  // Something you're trying: due check-in first, else any active experiment.
  const active = state.experiments.filter(e => e.status === 'trying' || e.status === 'working' || e.status === 'generalising');
  const due = active.find(e => e.id === reflecting) ?? active.find(e => e.nextCheckIn && new Date(e.nextCheckIn).getTime() <= now);
  const trying = due ?? active[0];

  // Reckon noticed something: an undecided theme, or an invitation to look.
  const proposed = state.themes.find(t => t.status === 'proposed');
  const canThread = confirmed.length >= 3;

  return (
    <>
      <header className="rk-header"><ReckonWordmark /><Link href="/reckon/lab" className="rk-chip" aria-label="Reckon Lab" style={{opacity: .55}}>Lab</Link></header>
      <div className="rk-greeting"><h1>{greeting(new Date(now))}</h1><p>{confirmed.length === 0 ? 'Reckon remembers the things you don\'t want to lose.' : `${confirmed.length} idea${confirmed.length === 1 ? '' : 's'} kept, your way.`}</p></div>

      <div className="rk-stack">
        {state.queue.length > 0 && (
          <Card tone="plain"><Eyebrow>Waiting for you</Eyebrow><p className="rk-big">{state.queue.length} saved link{state.queue.length === 1 ? '' : 's'}</p><div className="rk-choices"><Link className="rk-btn primary block" href={`/reckon/add?q=${state.queue[0].id}`}>Go through them</Link></div></Card>
        )}
        {trying && (
          <Card tone="navy">
            <Eyebrow>{due ? 'Did this come up?' : "Something you're trying"}</Eyebrow>
            <p className="rk-big">{trying.try}</p>
            <p className="rk-muted" style={{marginTop: 8}}>When {trying.when.replace(/^when\s+/i, '').replace(/\.$/, '')}.</p>
            {due ? <ReflectionFlow key={trying.id} experiment={trying} inline onStart={() => setReflecting(trying.id)} onDone={() => setReflecting(null)} /> : <div className="rk-choices"><Link className="rk-btn champagne block" href={`/reckon/trying/${trying.id}`}>Open</Link></div>}
          </Card>
        )}
        {carry && (
          <Card><Eyebrow>Something worth carrying today</Eyebrow><p className="rk-quote">{carry}</p></Card>
        )}
        {proposed ? (
          <Card><Eyebrow>Reckon noticed something</Eyebrow><p className="rk-big">Several things you&apos;ve saved seem to circle around {themeTitle(proposed)}.</p><div className="rk-choices"><Link className="rk-btn primary block" href="/reckon/thread">Have a look</Link></div></Card>
        ) : canThread && !trying ? (
          <Card tone="flat"><Eyebrow>When you&apos;re ready</Eyebrow><p className="rk-muted">You&apos;ve kept enough for Reckon to look for a thread between them.</p><div className="rk-choices"><Link className="rk-btn secondary block" href="/reckon/thread">Find the thread</Link></div></Card>
        ) : null}
        {unfinished.length > 0 && !state.queue.length && (
          <Card tone="flat"><p className="rk-muted">{unfinished.length} thing{unfinished.length === 1 ? '' : 's'} kept without a takeaway yet. <Link href="/reckon/library?filter=unfinished" style={{textDecoration: 'underline'}}>Finish when you like.</Link></p></Card>
        )}
        {confirmed.length === 0 && state.queue.length === 0 && !unfinished.length && (
          <Card><Eyebrow>Start here</Eyebrow><p className="rk-big">Bring one idea out of your feed.</p><p className="rk-muted" style={{marginTop: 8}}>Paste a Reel, a link, or a thought. Reckon will ask what caught you, then keep it your way.</p></Card>
        )}
      </div>

      <div className="rk-add"><Link href="/reckon/add" className="rk-btn primary"><Plus size={20} /> Add to Reckon</Link></div>
    </>
  );
}
