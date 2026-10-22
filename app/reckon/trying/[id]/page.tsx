'use client';
import {use, useState} from 'react';
import Link from 'next/link';
import {useReckon} from '@/lib/reckon/store';
import {setExperimentStatus, updateExperiment, themeTitle} from '@/lib/reckon/model';
import {summariseExperiment} from '@/lib/reckon/learning';
import {EXPERIMENT_STATUS_LABELS} from '@/lib/reckon/labels';
import {classify, barrierById} from '@/lib/reckon/reflection';
import type {ExperimentProposal} from '@/lib/reckon/types';
import {Card, Eyebrow, PageHeader, fmtDate} from '@/components/reckon/ui';
import {ExperimentFields} from '@/components/reckon/experiment-card';
import {ReflectionFlow} from '@/components/reckon/reflection-flow';

export default function TryingPage({params}: {params: Promise<{id: string}>}) {
  const {id} = use(params);
  const {state, ready, update} = useReckon();
  const [reflecting, setReflecting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ExperimentProposal>>({});
  if (!ready) return null;
  const x = state.experiments.find(e => e.id === id);
  if (!x) return <><PageHeader back="/reckon/me" /><p className="rk-empty">That experiment is gone.</p></>;
  const summary = summariseExperiment(x, state.reflections);
  const reflections = state.reflections.filter(r => r.experimentId === x.id).slice().reverse();
  const quiet = x.status === 'integrated' || x.status === 'retired';
  const themes = state.themes.filter(t => x.themeIds.includes(t.id));

  return (
    <>
      <PageHeader back="/reckon/me" />
      <div className="rk-row between" style={{marginBottom: 10}}><span className="rk-chip champagne">{EXPERIMENT_STATUS_LABELS[x.status]}</span><span className="rk-muted rk-small">since {fmtDate(x.createdAt)}</span></div>
      <div className="rk-stack">
        <Card>
          {editing ? <>
            <ExperimentFields x={{...x, ...draft}} editable onChange={p => setDraft(d => ({...d, ...p}))} />
            <div className="rk-choices row"><button className="rk-btn secondary" onClick={() => setEditing(false)}>Cancel</button><button className="rk-btn primary" onClick={() => { update(s => updateExperiment(s, x.id, {...draft, userModified: true})); setEditing(false); setDraft({}); }}>Save</button></div>
          </> : <>
            <ExperimentFields x={x} />
            {!quiet && <div className="rk-row" style={{marginTop: 16}}><button className="rk-btn secondary sm" onClick={() => setEditing(true)}>Adjust</button></div>}
          </>}
        </Card>

        {!quiet && (
          <Card tone="navy">
            <Eyebrow>{reflecting ? 'How did it go?' : 'When it comes up'}</Eyebrow>
            {!reflecting ? <><p className="rk-big">Did this come up?</p><div className="rk-choices"><button className="rk-btn champagne block" onClick={() => setReflecting(true)}>This came up</button></div></>
              : <ReflectionFlow experiment={x} inline onDone={() => setReflecting(false)} />}
          </Card>
        )}

        <Card tone="plain">
          <Eyebrow>So far</Eyebrow>
          <p>{summary.text}</p>
          {summary.consolidationReady && x.status !== 'integrated' && <><p style={{marginTop: 12}}>Does this feel like something you naturally do now?</p><div className="rk-choices row"><button className="rk-btn primary" onClick={() => update(s => setExperimentStatus(s, x.id, 'integrated'))}>Yes</button><button className="rk-btn secondary" onClick={() => update(s => setExperimentStatus(s, x.id, 'generalising'))}>Getting there</button></div></>}
          {x.status === 'integrated' && <p className="rk-quote" style={{marginTop: 12}}>You&apos;ve got this. I&apos;ll stop reminding you.</p>}
          {reflections.length > 0 && <details style={{marginTop: 12}}><summary className="rk-muted rk-small" style={{cursor: 'pointer'}}>{reflections.length} reflection{reflections.length === 1 ? '' : 's'}</summary>
            <ul className="rk-small" style={{margin: '8px 0 0 18px', padding: 0}}>{reflections.map(r => <li key={r.id} style={{marginBottom: 4}}>{fmtDate(r.createdAt)}: {classify(r).replace('_', ' ')}{r.barrier ? ` · ${barrierById(r.barrier).label}` : ''}{r.note ? ` · ${r.note}` : ''}</li>)}</ul></details>}
          {themes.length > 0 && <p className="rk-muted rk-small" style={{marginTop: 12}}>From the thread: {themes.map(themeTitle).join(', ')}</p>}
          {x.conversationId && <Link href={`/reckon/chat?c=${x.conversationId}`} className="rk-muted rk-small" style={{display: 'inline-block', marginTop: 8, textDecoration: 'underline'}}>The conversation it came from</Link>}
          {!quiet && <div className="rk-row" style={{marginTop: 14}}>
            {summary.verdict === 'promising' && x.status === 'trying' && <button className="rk-btn secondary sm" onClick={() => update(s => setExperimentStatus(s, x.id, 'working'))}>Mark as working</button>}
            <button className="rk-btn ghost sm" onClick={() => update(s => setExperimentStatus(s, x.id, 'retired'))}>Let this go</button>
          </div>}
        </Card>
      </div>
    </>
  );
}
