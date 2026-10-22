'use client';
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useReckon} from '@/lib/reckon/store';
import {findCandidateClusters, novelClusters} from '@/lib/reckon/threads';
import {proposeTheme, respondToTheme, themeTitle, logAi} from '@/lib/reckon/model';
import {api} from '@/lib/reckon/client';
import {seedState} from '@/lib/reckon/seed';
import type {Theme} from '@/lib/reckon/types';
import {Card, Eyebrow, PageHeader, Thinking} from '@/components/reckon/ui';

export default function ThreadPage() {
  const {state, ready, update, status} = useReckon();
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'looking' | 'show' | 'nothing'>('idle');
  const [queue, setQueue] = useState<Theme[]>([]);
  const [modify, setModify] = useState(false);
  const [wording, setWording] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const ran = useRef(false);

  const confirmed = state.items.filter(i => i.takeaway && !i.archived);
  const pending = state.themes.filter(t => t.status === 'proposed');

  /* Callers set phase to 'looking' first; the effect relies on the derived phase instead. */
  const look = async () => {
    const candidates = novelClusters(findCandidateClusters(confirmed), state.themes).slice(0, 2);
    const proposals: Theme[] = [];
    for (const c of candidates) {
      const items = confirmed.filter(i => c.itemIds.includes(i.id));
      try {
        const r = await api.theme(items, c.sharedFacets);
        update(s => logAi(s, {fn: 'theme', provider: r.meta.provider, model: r.meta.model, ms: r.meta.ms, ok: !r.meta.error, error: r.meta.error, inputTokens: r.meta.inputTokens, outputTokens: r.meta.outputTokens}));
        if (!r.output.isMeaningful) continue;
        const evidence = r.output.evidence.filter(e => c.itemIds.includes(e.itemId)).map(e => ({itemId: e.itemId, weight: 1, why: e.why}));
        if (evidence.length < 2) continue;
        const res = update(s => {
          const p = proposeTheme(s, {title: r.output.title, description: r.output.description, confidence: r.output.confidence, evidence, sharedFacets: c.sharedFacets, provenance: {kind: r.meta.provider === 'anthropic' ? 'ai' : 'system', at: new Date().toISOString(), detail: r.meta.model ?? 'facet clustering (no AI key)'}});
          proposals.push(p.theme);
          return p.state;
        });
        void res;
      } catch (err) { setNote(err instanceof Error ? err.message : 'Reckon could not finish looking.'); }
    }
    const all = [...pending, ...proposals.filter(p => !pending.some(x => x.id === p.id))];
    setQueue(all);
    setPhase(all.length ? 'show' : 'nothing');
  };

  useEffect(() => {
    if (!ready || ran.current) return;
    ran.current = true;
    // Deferred so the lookup runs as a callback rather than synchronously inside the effect.
    if (!pending.length && confirmed.length >= 2) setTimeout(() => void look(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;
  // Before any lookup has run, undecided themes from earlier are shown directly.
  const effectivePhase = phase === 'idle' ? (pending.length ? 'show' : confirmed.length >= 2 ? 'looking' : 'nothing') : phase;
  const shown = phase === 'idle' ? pending : queue;
  const theme = shown[0];

  const answer = (response: 'yes' | 'a_little' | 'not_really', text?: string) => {
    if (!theme) return;
    update(s => respondToTheme(s, theme.id, response, text));
    setModify(false); setWording('');
    const rest = shown.slice(1);
    setQueue(rest);
    if (!rest.length) setPhase('nothing');
  };

  return (
    <>
      <PageHeader back="/reckon/library" />
      <h1 className="rk-h1">Find the thread</h1>
      <p className="rk-lead">Reckon looks across what you&apos;ve kept, in your words, for something deeper than a topic.</p>

      {effectivePhase === 'looking' && <Card><Thinking label="Looking across what you've kept…" /><Gather labels={confirmed.slice(0, 7).map(i => i.takeaway!.text)} /></Card>}

      {effectivePhase === 'show' && theme && (
        <Card className="rk-morph" key={theme.id}>
          <Gather labels={theme.evidence.map(e => state.items.find(i => i.id === e.itemId)?.takeaway?.text ?? '')} settled />
          <Eyebrow>Reckon noticed something</Eyebrow>
          <p style={{fontSize: 17, lineHeight: 1.55, whiteSpace: 'pre-wrap'}}>{theme.description}</p>
          <details style={{marginTop: 12}}><summary className="rk-muted rk-small" style={{cursor: 'pointer'}}>The {theme.evidence.length} things behind this</summary>
            <ul style={{margin: '8px 0 0 18px', padding: 0}} className="rk-small">{theme.evidence.map(e => <li key={e.itemId} style={{marginBottom: 6}}>{state.items.find(i => i.id === e.itemId)?.takeaway?.text}{e.why ? <span className="rk-muted"> — {e.why}</span> : null}</li>)}</ul>
          </details>
          {!modify ? (
            <div className="rk-choices">
              <div className="rk-choices row" style={{marginTop: 0}}>
                <button className="rk-btn primary" onClick={() => answer('yes')}>Yes</button>
                <button className="rk-btn secondary" onClick={() => answer('a_little')}>A little</button>
                <button className="rk-btn secondary" onClick={() => answer('not_really')}>Not really</button>
              </div>
              <button className="rk-btn champagne block" onClick={() => { update(s => respondToTheme(s, theme.id, 'yes')); router.push(`/reckon/chat?theme=${theme.id}`); }}>Tell me more</button>
              <button className="rk-btn ghost block" onClick={() => { setWording(themeTitle(theme)); setModify(true); }}>I&apos;d put it differently</button>
            </div>
          ) : (
            <div className="rk-field"><label htmlFor="w">In your words</label><input id="w" className="rk-input" value={wording} onChange={e => setWording(e.target.value)} />
              <div className="rk-choices row"><button className="rk-btn secondary" onClick={() => setModify(false)}>Back</button><button className="rk-btn primary" disabled={!wording.trim()} onClick={() => answer('yes', wording)}>That&apos;s it</button></div></div>
          )}
        </Card>
      )}

      {effectivePhase === 'nothing' && (
        <Card>
          <Eyebrow>Nothing to add yet</Eyebrow>
          {confirmed.length < 3 ? <p className="rk-muted">Reckon needs a few more things kept in your words before it can honestly see a thread. Three or four is usually enough.</p>
            : <p className="rk-muted">Nothing strong enough stood out this time{state.themes.length ? ', beyond what you have already answered' : ''}. That is fine; threads appear when they appear.</p>}
          {note && <p className="rk-error">{note}</p>}
          <div className="rk-choices">
            {confirmed.length >= 2 && <button className="rk-btn secondary block" onClick={() => { setPhase('looking'); setNote(null); void look(); }}>Look again</button>}
            {status.devTools && <button className="rk-btn ghost block" onClick={() => { update(s => seedState(s)); setPhase('looking'); setNote(null); setTimeout(() => void look(), 50); }}>Load seed Reckons (dev)</button>}
            <Link className="rk-btn ghost block" href="/reckon/me">See what Reckon has learned</Link>
          </div>
        </Card>
      )}
    </>
  );
}

/** Related Reckons visually gather toward a shared centre. */
function Gather({labels, settled = false}: {labels: string[]; settled?: boolean}) {
  const n = Math.min(labels.length, 6);
  return (
    <div className="rk-gather" aria-hidden="true">
      {labels.slice(0, n).map((l, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r = settled ? 48 : 70;
        const style = {'--x': `${Math.cos(angle) * r * 1.6}px`, '--y': `${Math.sin(angle) * r * 0.7}px`, '--rot': `${(i % 2 ? 1 : -1) * (3 + i)}deg`, '--d': `${i * 0.08}s`} as React.CSSProperties;
        return <div key={i} className="pebble" style={style}>{l.length > 48 ? l.slice(0, 46) + '…' : l}</div>;
      })}
    </div>
  );
}
