'use client';
import {useState} from 'react';
import {useReckon, STORAGE_KEY} from '@/lib/reckon/store';
import {enqueueUrls, updateExperiment} from '@/lib/reckon/model';
import {seedState, removeSeeds, GOVIND_TEST_BATCH} from '@/lib/reckon/seed';
import {findCandidateClusters, describeFacets} from '@/lib/reckon/threads';
import {summariseExperiment} from '@/lib/reckon/learning';
import {classify} from '@/lib/reckon/reflection';
import {Card, PageHeader} from '@/components/reckon/ui';

type Tab = 'ingestion' | 'ai' | 'os' | 'experiments';

export default function LabPage() {
  const {state, ready, update, reset, status} = useReckon();
  const [tab, setTab] = useState<Tab>('ingestion');
  const [confirmReset, setConfirmReset] = useState(false);
  if (!ready) return null;
  const clusters = findCandidateClusters(state.items.filter(i => i.takeaway));
  const T = (id: string) => state.items.find(i => i.id === id)?.takeaway?.text ?? id;

  return (
    <div className="rk-lab">
      <PageHeader back="/reckon" />
      <h1 className="rk-h1" style={{fontFamily: 'var(--serif)'}}>Reckon Lab</h1>
      <p className="rk-lead">Development view. Everything the product hides from ordinary users.</p>

      <Card tone="plain">
        <table><tbody>
          {status.error && <tr><td>Server</td><td className="bad">{status.error} — Reckon API calls are failing on this deployment</td></tr>}
          <tr><td>AI</td><td className={status.ai ? 'ok' : 'bad'}>{status.ai ? `available · ${status.model}` : 'no ANTHROPIC_API_KEY — deterministic fallbacks in use'}</td></tr>
          <tr><td>Instagram oEmbed token</td><td className={status.instagramOembed ? 'ok' : 'bad'}>{status.instagramOembed ? 'configured' : 'not configured'}</td></tr>
          <tr><td>Storage</td><td>localStorage “{STORAGE_KEY}” · {Math.round(JSON.stringify(state).length / 1024)} KB</td></tr>
          <tr><td>Counts</td><td>{state.sources.length} sources · {state.items.length} items ({state.items.filter(i => i.takeaway).length} confirmed) · {state.themes.length} themes · {state.experiments.length} experiments · {state.reflections.length} reflections · {state.facts.length} facts · {state.queue.length} queued</td></tr>
        </tbody></table>
        <div className="rk-row" style={{marginTop: 12}}>
          <button className="rk-btn secondary sm" onClick={() => update(s => enqueueUrls(s, GOVIND_TEST_BATCH, 'Govind'))}>Load Govind&apos;s test batch</button>
          <button className="rk-btn secondary sm" onClick={() => update(s => seedState(s))}>Load seed Reckons</button>
          <button className="rk-btn secondary sm" onClick={() => update(s => removeSeeds(s))}>Remove seeds</button>
          <button className="rk-btn secondary sm" onClick={() => update(s => s.experiments.reduce((acc, e) => e.nextCheckIn ? updateExperiment(acc, e.id, {nextCheckIn: new Date(Date.now() - 1000).toISOString()}) : acc, s))}>Bring check-ins forward</button>
          <button className="rk-btn secondary sm" onClick={() => { const a = document.createElement('a'); a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(state, null, 2)); a.download = 'reckon-export.json'; a.click(); }}>Export JSON</button>
          {!confirmReset ? <button className="rk-btn ghost sm" onClick={() => setConfirmReset(true)}>Reset all data</button> : <button className="rk-btn champagne sm" onClick={() => { reset(); setConfirmReset(false); }}>Confirm reset</button>}
        </div>
      </Card>

      <div className="rk-tabs" role="tablist" style={{marginTop: 16}}>{(['ingestion', 'ai', 'os', 'experiments'] as Tab[]).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'os' ? 'Personal OS' : t === 'ai' ? 'AI' : t[0].toUpperCase() + t.slice(1)}</button>)}</div>

      {tab === 'ingestion' && <div className="rk-stack">
        {state.queue.length > 0 && <Card tone="flat"><strong>Queue</strong><ul>{state.queue.map(q => <li key={q.id}>{q.url}</li>)}</ul></Card>}
        {[...state.sources].reverse().map(s => (
          <Card key={s.id} tone="plain">
            <div><strong>{s.platform}</strong> {s.type} · <span className={s.retrieval.status === 'retrieved' ? 'ok' : s.retrieval.status === 'not_attempted' ? '' : 'bad'}>{s.retrieval.status}</span> via {s.retrieval.method}</div>
            {s.url && <div style={{wordBreak: 'break-all'}}>{s.url}</div>}
            <table style={{marginTop: 6}}><tbody>
              <tr><td>fields retrieved</td><td>{s.retrieval.fieldsRetrieved.join(', ') || 'none'}</td></tr>
              <tr><td>transcript</td><td>{s.retrieval.transcriptAvailable ? 'yes' : 'no'}</td></tr>
              <tr><td>content available to AI</td><td className={s.retrieval.contentAvailableToAi ? 'ok' : 'bad'}>{s.retrieval.contentAvailableToAi ? 'yes' : 'no'}</td></tr>
              <tr><td>embed</td><td>{s.embedUrl ? 'client-side iframe (not verified server-side)' : 'none'}</td></tr>
              <tr><td>timestamps</td><td>{s.retrieval.startedAt} → {s.retrieval.finishedAt}</td></tr>
              {s.retrieval.error && <tr><td>error</td><td className="bad">{s.retrieval.error}</td></tr>}
            </tbody></table>
            {s.retrieval.notes.length > 0 && <ul>{s.retrieval.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            {s.retrieval.attempts.length > 0 && <details><summary>{s.retrieval.attempts.length} attempt{s.retrieval.attempts.length === 1 ? '' : 's'}</summary>
              <table><thead><tr><th>method</th><th>http</th><th>fields</th><th>outcome</th></tr></thead><tbody>
                {s.retrieval.attempts.map((a, i) => <tr key={i}><td>{a.method}</td><td>{a.httpStatus ?? '—'}</td><td>{a.fields.join(', ') || '—'}</td><td className={a.ok ? 'ok' : 'bad'}>{a.ok ? 'ok' : a.error ?? a.note}{a.ok && a.note ? ` (${a.note})` : ''}{a.finalUrl && a.finalUrl !== a.url ? ` → ${a.finalUrl}` : ''}</td></tr>)}
              </tbody></table></details>}
            {(s.caption || s.title) && <details><summary>retrieved text</summary><pre>{[s.title, s.caption, s.transcript].filter(Boolean).join('\n\n')}</pre></details>}
          </Card>
        ))}
        {!state.sources.length && <p className="rk-empty">No sources yet.</p>}
      </div>}

      {tab === 'ai' && <div className="rk-stack">
        <Card tone="plain"><strong>Candidate clusters (live, structured step before any model call)</strong>
          {clusters.length ? clusters.map((c, i) => <div key={i} style={{marginTop: 8}}>score {c.score.toFixed(2)} · facets: {describeFacets(c.sharedFacets).join('; ') || '—'}<ul>{c.itemIds.map(id => <li key={id}>{T(id)}</li>)}</ul></div>) : <p className="rk-empty">No clusters above threshold.</p>}
        </Card>
        <Card tone="plain"><strong>Themes</strong>
          <table><thead><tr><th>title</th><th>status</th><th>conf.</th><th>items</th><th>provenance</th></tr></thead><tbody>{state.themes.map(t => <tr key={t.id}><td>{t.userWording ? `${t.userWording} (was: ${t.title})` : t.title}</td><td>{t.status}{t.userResponse ? ` · ${t.userResponse}` : ''}</td><td>{t.confidence}</td><td>{t.evidence.length}</td><td>{t.provenance.kind} {t.provenance.detail}</td></tr>)}</tbody></table>
        </Card>
        {[...state.items].reverse().map(i => <Card key={i.id} tone="plain">
          <div><strong>{i.takeaway?.text ?? '(no takeaway)'}</strong> · {i.status} · {i.captureMode}{i.isSeed ? ' · seed' : ''}</div>
          <table style={{marginTop: 6}}><tbody>
            <tr><td>AI reading</td><td>{i.distilled ? `${i.distilled.text} (${i.distilled.basis}, ${i.distilled.confidence}, ${i.distilled.provenance.kind}: ${i.distilled.provenance.detail ?? ''})` : '—'}</td></tr>
            <tr><td>user note</td><td>{i.userNote ?? '—'}</td></tr>
            <tr><td>takeaway</td><td>{i.takeaway ? `${i.takeaway.status}${i.takeaway.originalProposal && i.takeaway.originalProposal !== i.takeaway.text ? ` · edited from “${i.takeaway.originalProposal}”` : ''}` : '—'}</td></tr>
            <tr><td>route</td><td>{i.route ? `${i.route.function} (${i.route.status}; alternatives ${i.route.alternatives.join(', ') || '—'})` : '—'}</td></tr>
            <tr><td>embedding</td><td>{i.embeddingStatus}{i.embeddingStatus === 'features_only' ? ' — provider has no embeddings endpoint; structured facets are compared instead' : ''}</td></tr>
            <tr><td>semantic</td><td>{i.semantic ? <pre style={{margin: 0}}>{JSON.stringify({...i.semantic, provenance: undefined}, null, 1)}</pre> : '—'}</td></tr>
          </tbody></table>
        </Card>)}
        <Card tone="plain"><strong>AI call log</strong>
          <table><thead><tr><th>at</th><th>fn</th><th>provider</th><th>ms</th><th>tokens</th><th>note</th></tr></thead><tbody>{state.aiLog.map(l => <tr key={l.id}><td>{new Date(l.at).toLocaleTimeString()}</td><td>{l.fn}</td><td className={l.provider === 'anthropic' ? 'ok' : ''}>{l.provider}{l.model ? ` ${l.model}` : ''}</td><td>{l.ms}</td><td>{l.inputTokens ?? '—'}/{l.outputTokens ?? '—'}</td><td className={l.ok ? '' : 'bad'}>{l.error ?? ''}</td></tr>)}</tbody></table>
          {!state.aiLog.length && <p className="rk-empty">No calls yet.</p>}
        </Card>
      </div>}

      {tab === 'os' && <div className="rk-stack">
        {(['proposed', 'user_confirmed', 'user_modified', 'rejected'] as const).map(st => <Card key={st} tone="plain"><strong>{st}</strong>
          <table><thead><tr><th>section</th><th>text</th><th>conf.</th><th>evidence</th><th>provenance</th></tr></thead><tbody>
            {state.facts.filter(f => f.status === st).map(f => <tr key={f.id}><td>{f.section}</td><td>{f.userWording ? `${f.userWording} (was: ${f.text})` : f.text}</td><td>{f.confidence}</td><td>{f.evidence.map(e => `${e.kind}:${e.id.slice(0, 10)}`).join(', ')}</td><td>{f.provenance.kind} {f.provenance.detail ?? ''}</td></tr>)}
          </tbody></table>
          {!state.facts.some(f => f.status === st) && <p className="rk-empty">none</p>}
        </Card>)}
      </div>}

      {tab === 'experiments' && <div className="rk-stack">
        {state.experiments.map(e => { const s = summariseExperiment(e, state.reflections); return <Card key={e.id} tone="plain">
          <div><strong>{e.try}</strong> · {e.kind} · {e.status} · {e.provenance.kind}: {e.provenance.detail}</div>
          <table style={{marginTop: 6}}><tbody>
            <tr><td>opportunities</td><td>{s.opportunities}</td></tr><tr><td>retrieval (remembered)</td><td>{s.remembered} · failures {s.retrievalFailures}</td></tr><tr><td>attempts (tried)</td><td>{s.tried} · failures {s.transferFailures}</td></tr><tr><td>outcomes</td><td>helped {s.helped} · somewhat {s.somewhat} · didn&apos;t {s.didntHelp}</td></tr><tr><td>barriers</td><td>{Object.entries(s.barriers).map(([k, v]) => `${k}×${v}`).join(', ') || '—'}</td></tr><tr><td>verdict</td><td>{s.verdict}</td></tr><tr><td>next check-in</td><td>{e.nextCheckIn ?? '—'}</td></tr>
          </tbody></table>
          <details><summary>reflections</summary><ul>{state.reflections.filter(r => r.experimentId === e.id).map(r => <li key={r.id}>{r.createdAt} · {classify(r)}{r.barrier ? ` · ${r.barrier}` : ''}{r.note ? ` · ${r.note}` : ''}</li>)}</ul></details>
        </Card>; })}
        {!state.experiments.length && <p className="rk-empty">No experiments yet.</p>}
      </div>}
    </div>
  );
}
