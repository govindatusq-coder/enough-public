'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {PersonalOSFact, ReckonState} from '@/lib/reckon/types';
import {useReckon} from '@/lib/reckon/store';
import {respondToFact, factText, themeTitle, logAi} from '@/lib/reckon/model';
import {api} from '@/lib/reckon/client';

export function evidenceLabels(state: ReckonState, f: PersonalOSFact): string[] {
  return f.evidence.map(e => {
    if (e.kind === 'item') return `Reckon: “${state.items.find(i => i.id === e.id)?.takeaway?.text ?? 'deleted'}”`;
    if (e.kind === 'theme') { const t = state.themes.find(t => t.id === e.id); return `Thread: ${t ? themeTitle(t) : 'deleted'}`; }
    if (e.kind === 'experiment') return `Experiment: ${state.experiments.find(x => x.id === e.id)?.try ?? 'deleted'}`;
    if (e.kind === 'conversation') { const c = state.conversations.find(c => c.id === e.id); return `Conversation ${c ? new Date(c.createdAt).toLocaleDateString('en-AU') : ''}`; }
    const r = state.reflections.find(r => r.id === e.id);
    return r ? `Reflection ${new Date(r.createdAt).toLocaleDateString('en-AU')}: ${!r.opportunity ? 'no opportunity' : r.remembered === false ? 'forgot' : r.tried === false ? 'did not try' : `helped: ${r.helped}`}` : 'Reflection';
  });
}

export function FactRow({fact}: {fact: PersonalOSFact}) {
  const {state, update} = useReckon();
  const [why, setWhy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [wording, setWording] = useState(factText(fact));
  const confirmed = fact.status === 'user_confirmed' || fact.status === 'user_modified';

  const explain = async () => {
    if (why) { setWhy(null); return; }
    const evidence = evidenceLabels(state, fact);
    try {
      const r = await api.explain({statement: factText(fact), section: fact.section, status: fact.status, confidence: fact.confidence, evidence});
      update(s => logAi(s, {fn: 'explain', provider: r.meta.provider, model: r.meta.model, ms: r.meta.ms, ok: !r.meta.error, error: r.meta.error}));
      setWhy(r.output.explanation + (evidence.length ? '\n\n' + evidence.map(e => '• ' + e).join('\n') : ''));
    } catch { setWhy(evidence.map(e => '• ' + e).join('\n')); }
  };

  return (
    <div className="rk-fact">
      <div className="rk-row between" style={{alignItems: 'flex-start'}}>
        <p className="text">{factText(fact)}</p>
        <span className={`rk-chip ${confirmed ? 'champagne' : ''}`} title={`Confidence: ${fact.confidence}`}>{confirmed ? 'yours' : 'proposed'} · {fact.confidence}</span>
      </div>
      {editing ? (
        <div className="rk-field"><input className="rk-input" value={wording} onChange={e => setWording(e.target.value)} /><div className="rk-row"><button className="rk-btn secondary sm" onClick={() => setEditing(false)}>Cancel</button><button className="rk-btn primary sm" disabled={!wording.trim()} onClick={() => { update(s => respondToFact(s, fact.id, 'not_quite', wording)); setEditing(false); }}>Keep this</button></div></div>
      ) : (
        <div className="tools">
          {!confirmed && <button className="on" onClick={() => update(s => respondToFact(s, fact.id, 'right'))}>That&apos;s right</button>}
          <button onClick={() => setEditing(true)}>Not quite</button>
          <button onClick={() => update(s => respondToFact(s, fact.id, 'remove'))}>Remove this</button>
          <button onClick={() => void explain()}>Why does Reckon think this?</button>
        </div>
      )}
      {why && <div className="why" style={{whiteSpace: 'pre-wrap'}}>{why}{fact.evidence.some(e => e.kind === 'experiment') && <div style={{marginTop: 8}}>{fact.evidence.filter(e => e.kind === 'experiment').map(e => <Link key={e.id} href={`/reckon/trying/${e.id}`} style={{textDecoration: 'underline', marginRight: 10}}>Open experiment</Link>)}</div>}</div>}
    </div>
  );
}
