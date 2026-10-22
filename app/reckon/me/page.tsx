'use client';
import Link from 'next/link';
import {useReckon} from '@/lib/reckon/store';
import {visibleFacts} from '@/lib/reckon/model';
import {OS_SECTIONS, EXPERIMENT_STATUS_LABELS} from '@/lib/reckon/labels';
import {summariseExperiment} from '@/lib/reckon/learning';
import {Card, Eyebrow, PageHeader} from '@/components/reckon/ui';
import {FactRow} from '@/components/reckon/os-fact';

export default function MePage() {
  const {state, ready} = useReckon();
  if (!ready) return null;
  const experiments = [...state.experiments].sort((a, b) => (a.status === 'integrated' || a.status === 'retired' ? 1 : 0) - (b.status === 'integrated' || b.status === 'retired' ? 1 : 0));
  const anything = state.facts.some(f => f.status !== 'rejected') || experiments.length;
  return (
    <>
      <PageHeader />
      <h1 className="rk-h1">My Reckon</h1>
      <p className="rk-lead">Not a profile. What Reckon has learned with you, with the evidence, and the ability to correct it.</p>

      {!anything && <Card><Eyebrow>Nothing yet</Eyebrow><p className="rk-muted">This fills in as you confirm threads, try things and reflect. Reckon never writes here on its own.</p></Card>}

      <section className="rk-section">
        <h2>Things I&apos;m trying</h2>
        <p className="hint">Experiments, not targets.</p>
        <div className="rk-stack">
          {experiments.map(e => {
            const s = summariseExperiment(e, state.reflections);
            const quiet = e.status === 'integrated' || e.status === 'retired';
            return (
              <Link key={e.id} href={`/reckon/trying/${e.id}`}><Card tone={quiet ? 'flat' : undefined} style={quiet ? {opacity: .7} : undefined}>
                <div className="rk-row between"><span className="rk-chip champagne">{EXPERIMENT_STATUS_LABELS[e.status]}</span><span className="rk-muted rk-small">{s.opportunities ? `${s.tried} of ${s.opportunities} chances` : 'no chances yet'}</span></div>
                <p className="rk-big" style={{marginTop: 10, fontSize: 22}}>{e.try}</p>
                <p className="rk-muted rk-small" style={{marginTop: 6}}>When {e.when.replace(/^when\s+/i, '').replace(/\.$/, '')}.</p>
              </Card></Link>
            );
          })}
          {!experiments.length && <p className="rk-empty">Experiments begin in conversation, usually from a thread.</p>}
        </div>
      </section>

      {OS_SECTIONS.map(sec => {
        const facts = visibleFacts(state, sec.id);
        if (!facts.length && !anything) return null;
        return (
          <section key={sec.id} className="rk-section">
            <h2>{sec.title}</h2>
            <p className="hint">{sec.hint}</p>
            <Card tone="plain">{facts.length ? facts.map(f => <FactRow key={f.id} fact={f} />) : <p className="rk-empty">Nothing here yet.</p>}</Card>
          </section>
        );
      })}

      <p className="rk-muted rk-small" style={{marginTop: 30}}>Reckon is a reflection tool, not therapy, diagnosis or crisis care. Everything here stays on this device unless you talk to Reckon, which sends only the relevant pieces to the model. <Link href="/reckon/lab" style={{textDecoration: 'underline'}}>Open Reckon Lab</Link>.</p>
    </>
  );
}
