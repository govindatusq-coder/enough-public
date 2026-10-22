'use client';
import {useState} from 'react';
import type {Experiment, Barrier, Helped} from '@/lib/reckon/types';
import {useReckon} from '@/lib/reckon/store';
import {recordReflection, setExperimentStatus, logAi} from '@/lib/reckon/model';
import {nextStep, barriersFor, barrierById, type ReflectionDraft} from '@/lib/reckon/reflection';
import {api} from '@/lib/reckon/client';
import {Thinking} from './ui';

/**
 * Did this come up? → Did you remember? → Did you try it? → Did it help?
 * Minimal, one question at a time. Failure is never collapsed into "didn't comply".
 */
export function ReflectionFlow({experiment, inline = false, onDone, onStart}: {experiment: Experiment; inline?: boolean; onDone?: () => void; onStart?: () => void}) {
  const {update, state} = useReckon();
  const [d, setD] = useState<ReflectionDraft>({});
  const [barrierStep, setBarrierStep] = useState<'remembered' | 'tried' | 'helped' | null>(null);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<{message: string; suggestion: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const step = nextStep(d);

  const finish = async (draft: ReflectionDraft) => {
    setBusy(true);
    const saved = update(s => recordReflection(s, {experimentId: experiment.id, opportunity: !!draft.opportunity, remembered: draft.remembered, tried: draft.tried, helped: draft.helped, barrier: draft.barrier, note: note.trim() || undefined}).state);
    setSaved(true);
    const reflection = saved.reflections[saved.reflections.length - 1];
    try {
      const r = await api.reflection(saved, experiment.id, reflection.id);
      update(s => logAi(s, {fn: 'reflection', provider: r.meta.provider, model: r.meta.model, ms: r.meta.ms, ok: !r.meta.error, error: r.meta.error}));
      setResult(r.output);
    } catch { setResult({message: 'Noted. Thank you for the honesty.', suggestion: 'none'}); }
    finally { setBusy(false); }
  };

  const set = (patch: ReflectionDraft) => {
    if (Object.keys(d).length === 0) onStart?.();
    const next = {...d, ...patch};
    setD(next);
    const s = nextStep(next);
    if (s === 'barrier') setBarrierStep(next.remembered === false ? 'remembered' : next.tried === false ? 'tried' : 'helped');
    else if (s === 'done') void finish(next);
  };

  const btn = inline ? 'rk-btn champagne' : 'rk-btn secondary';

  if (saved) return (
    <div className="rk-fade" style={{marginTop: 14}}>
      {busy && !result ? <Thinking label="Thinking about that…" /> : null}
      {result && <>
        <p style={{fontSize: 16, lineHeight: 1.55}}>{result.message}</p>
        {result.suggestion === 'consolidate' && <div className="rk-choices row"><button className={btn} onClick={() => { update(s => setExperimentStatus(s, experiment.id, 'integrated')); onDone?.(); }}>Yes, it&apos;s mine now</button><button className="rk-btn ghost" onClick={() => onDone?.()}>Not yet</button></div>}
        {result.suggestion === 'retire' && <div className="rk-choices row"><button className={btn} onClick={() => { update(s => setExperimentStatus(s, experiment.id, 'retired')); onDone?.(); }}>Let this one go</button><button className="rk-btn ghost" onClick={() => onDone?.()}>Keep trying</button></div>}
        {['adjust_cue', 'smaller_step', 'translate'].includes(result.suggestion) && <p className="rk-muted rk-small" style={{marginTop: 8}}>You can change the cue or the step on the experiment page.</p>}
        {!['consolidate', 'retire'].includes(result.suggestion) && onDone && <div className="rk-choices"><button className="rk-btn ghost" onClick={onDone}>Done</button></div>}
      </>}
      {state.experiments.find(e => e.id === experiment.id)?.status === 'integrated' && <p className="rk-quote" style={{marginTop: 10}}>You&apos;ve got this. I&apos;ll stop reminding you.</p>}
    </div>
  );

  if (step === 'opportunity') return <Q q="Did this come up?"><button className={btn} onClick={() => set({opportunity: true})}>Yes</button><button className="rk-btn ghost" onClick={() => set({opportunity: false})}>No</button></Q>;
  if (step === 'remembered') return <Q q="Did you remember what you wanted to try?"><button className={btn} onClick={() => set({remembered: true})}>Yes</button><button className="rk-btn ghost" onClick={() => set({remembered: false})}>No</button></Q>;
  if (step === 'tried') return <Q q="Did you try it?"><button className={btn} onClick={() => set({tried: true})}>Yes</button><button className="rk-btn ghost" onClick={() => set({tried: false})}>No</button></Q>;
  if (step === 'helped') return <Q q="Did it help?">{(['yes', 'somewhat', 'no'] as Helped[]).map(h => <button key={h} className={h === 'yes' ? btn : 'rk-btn ghost'} onClick={() => set({helped: h})}>{h === 'yes' ? 'Yes' : h === 'somewhat' ? 'Somewhat' : 'No'}</button>)}</Q>;
  if (step === 'barrier' && barrierStep) return (
    <div className="rk-fade">
      <p style={{marginTop: 14, fontSize: 17}}>{barrierStep === 'remembered' ? 'No judgement. What got in the way?' : barrierStep === 'tried' ? 'What got in the way?' : 'What do you think happened?'}</p>
      <div className="rk-choices">{barriersFor(barrierStep).map(b => <button key={b} className="rk-choice" onClick={() => set({barrier: b as Barrier})}><span><strong>{barrierById(b).label}</strong></span></button>)}</div>
      <div className="rk-field"><input className="rk-input" placeholder="Anything else? (optional)" value={note} onChange={e => setNote(e.target.value)} /></div>
    </div>
  );
  return null;
}

function Q({q, children}: {q: string; children: React.ReactNode}) {
  return <div className="rk-fade"><p style={{marginTop: 14, fontSize: 17}}>{q}</p><div className="rk-choices row" style={{marginTop: 10}}>{children}</div></div>;
}
