'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {Sparkles, Mic, MicOff, PenLine, Bookmark, Link2, Type, ImageUp, Check} from 'lucide-react';
import type {Source, ReckonItem, RouteFunction, CaptureMode} from '@/lib/reckon/types';
import {detectSource, looksLikeUrl} from '@/lib/reckon/platform';
import {useReckon} from '@/lib/reckon/store';
import {addSource, addItem, confirmTakeaway, setDistilled, setRoute, setSemantic, manualRecord, failedRecord, updateItem, dequeueUrl, logAi} from '@/lib/reckon/model';
import {api} from '@/lib/reckon/client';
import {ROUTE_LABELS, ROUTE_ORDER} from '@/lib/reckon/labels';
import {Card, Eyebrow, Thinking, Ripple} from './ui';
import {SourceCard} from './source-card';
import {useSpeech} from './voice';

type Step = 'input' | 'adding' | 'caught' | 'tell' | 'proposal' | 'route' | 'done';
type Mode = 'link' | 'text' | 'upload';

export function AddFlow({initialUrl, queueId}: {initialUrl?: string; queueId?: string}) {
  const {state, update, status} = useReckon();
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialUrl ? 'adding' : 'input');
  const [mode, setMode] = useState<Mode>('link');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [item, setItem] = useState<ReckonItem | null>(null);
  const [proposal, setProposal] = useState<{text: string; basis: 'source_content' | 'user_input' | 'both'; fromUser?: string} | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [routeSuggestion, setRouteSuggestion] = useState<{primary: RouteFunction; alternatives: RouteFunction[]} | null>(null);
  const [chosenRoute, setChosenRoute] = useState<RouteFunction | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tellText, setTellText] = useState('');
  const started = useRef(false);
  const speech = useSpeech(text => setTellText(text));

  const log = useCallback((fn: string, meta: {provider: 'anthropic' | 'fallback'; model?: string; ms: number; error?: string; inputTokens?: number; outputTokens?: number}) => {
    update(s => logAi(s, {fn, provider: meta.provider, model: meta.model, ms: meta.ms, ok: !meta.error, error: meta.error, inputTokens: meta.inputTokens, outputTokens: meta.outputTokens}));
  }, [update]);

  /* ---- Step: adding (link ingestion) ---- */
  const ingest = useCallback(async (url: string) => {
    setStep('adding'); setError(null);
    const detected = detectSource(url);
    if (!detected) { setError("That doesn't look like a link Reckon can open."); setStep('input'); return; }
    try {
      const res = await api.ingest(url);
      const created = update(s => {
        const a = addSource(s, {platform: res.detected.platform, type: res.detected.type, url: res.detected.url, canonicalUrl: res.detected.canonicalUrl, externalId: res.detected.externalId, retrieval: res.record, title: res.content.title, caption: res.content.caption, transcript: res.content.transcript, thumbnailUrl: res.content.thumbnailUrl, author: res.content.author, embedUrl: res.content.embedUrl});
        const b = addItem(a.state, a.source.id, 'kept');
        let next = b.state;
        if (queueId) next = dequeueUrl(next, queueId);
        setSource(a.source); setItem(b.item);
        return next;
      });
      void created;
      setStep('caught');
    } catch (err) {
      // The server could not be reached or crashed. Capture must not fail: keep the link with an
      // honest failed record (visible in the Lab) and go straight to "What caught you?".
      const message = err instanceof Error ? err.message : String(err);
      update(s => {
        const a = addSource(s, {platform: detected.platform, type: detected.type, url: detected.url, canonicalUrl: detected.canonicalUrl, externalId: detected.externalId, embedUrl: detected.embedUrl, retrieval: failedRecord(`Ingestion API unavailable: ${message}`)});
        const b = addItem(a.state, a.source.id, 'kept');
        let next = b.state;
        if (queueId) next = dequeueUrl(next, queueId);
        setSource(a.source); setItem(b.item);
        return next;
      });
      setStep('caught');
    }
  }, [update, queueId]);

  useEffect(() => {
    if (initialUrl && !started.current) { started.current = true; void ingest(initialUrl); }
  }, [initialUrl, ingest]);

  const addManual = () => {
    const text = draft.trim();
    if (!text) return;
    if (looksLikeUrl(text)) { void ingest(text); return; }
    update(s => {
      const a = addSource(s, {platform: 'manual', type: text.length > 400 ? 'transcript' : text.length < 140 ? 'quote' : 'thought', manualText: text, retrieval: manualRecord('manual')});
      const b = addItem(a.state, a.source.id, 'kept');
      setSource(a.source); setItem(b.item);
      return b.state;
    });
    setStep('caught');
  };

  const addUpload = async (file: File) => {
    setError(null); setBusy('Reading image…');
    try {
      const dataUrl = await downscale(file);
      update(s => {
        const a = addSource(s, {platform: 'upload', type: 'image', imageDataUrl: dataUrl, retrieval: {...manualRecord('upload'), contentAvailableToAi: status.ai, notes: [status.ai ? 'Image available to the model.' : 'No AI key configured: the image cannot be read, so you describe it.']}});
        const b = addItem(a.state, a.source.id, 'kept');
        setSource(a.source); setItem(b.item);
        return b.state;
      });
      setStep('caught');
    } catch { setError('That image could not be read.'); }
    finally { setBusy(null); }
  };

  /* ---- Step: caught → proposal ---- */
  const reckonIt = async () => {
    if (!source || !item) return;
    setBusy('Reading it…');
    try {
      const r = await api.distil(source);
      log('distil', r.meta);
      if (!r.output.enoughContent || !r.output.insight) { setError("I couldn't get enough from this to say anything honest. What caught you about it?"); setBusy(null); return; }
      update(s => setDistilled(s, item.id, {text: r.output.insight, basis: r.output.basis, confidence: r.output.confidence, provenance: {kind: r.meta.provider === 'anthropic' ? 'ai' : 'system', at: new Date().toISOString(), detail: r.meta.provider === 'anthropic' ? r.meta.model : 'quoted from the source (no AI key)'}}));
      setProposal({text: r.output.insight, basis: r.output.basis});
      setStep('proposal');
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); }
    finally { setBusy(null); }
  };

  const submitTell = async (mode: CaptureMode) => {
    if (!source || !item) return;
    const words = tellText.trim();
    if (!words) return;
    if (speech.listening) speech.stop();
    setBusy('Listening…');
    try {
      update(s => updateItem(s, item.id, {userNote: words, captureMode: mode}));
      const r = await api.takeaway(words, source);
      log('takeaway', r.meta);
      const text = r.output.insight || words;
      update(s => setDistilled(s, item.id, {text, basis: 'user_input', confidence: r.output.confidence, provenance: {kind: r.meta.provider === 'anthropic' ? 'ai' : 'system', at: new Date().toISOString(), detail: r.meta.provider === 'anthropic' ? r.meta.model : 'shaped from your words (no AI key)'}}));
      setProposal({text, basis: 'user_input', fromUser: words});
      setStep('proposal');
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); }
    finally { setBusy(null); }
  };

  const justKeep = () => { setStep('done'); };

  /* ---- Step: proposal → route ---- */
  const confirm = async (text: string) => {
    if (!item) return;
    const clean = text.trim(); if (!clean) return;
    update(s => confirmTakeaway(s, item.id, clean, proposal?.text));
    setEditing(false);
    setStep('route'); setBusy('Thinking about what this is for…');
    try {
      const r = await api.route(clean, item.userNote ?? proposal?.fromUser);
      log('route', r.meta);
      setRouteSuggestion({primary: r.output.primary, alternatives: r.output.alternatives});
      setChosenRoute(r.output.primary);
      update(s => setRoute(s, item.id, r.output.primary, 'ai', r.output.alternatives, r.meta.model ?? 'fallback'));
    } catch { setRouteSuggestion({primary: 'DO', alternatives: ['THINK']}); setChosenRoute('DO'); }
    finally { setBusy(null); }
  };

  const chooseRoute = async (fn: RouteFunction) => {
    if (!item) return;
    setChosenRoute(fn);
    const takeaway = state.items.find(i => i.id === item.id)?.takeaway?.text ?? '';
    update(s => setRoute(s, item.id, fn, 'user', routeSuggestion?.alternatives ?? []));
    setStep('done');
    // Semantic features are extracted in the background for Find the Thread.
    api.features(takeaway, item.userNote, fn).then(r => {
      log('features', r.meta);
      update(s => setSemantic(s, item.id, {...r.output, provenance: {kind: r.meta.provider === 'anthropic' ? 'ai' : 'system', at: new Date().toISOString(), detail: r.meta.model ?? 'keyword facets (no AI key)'}}));
    }).catch(() => {});
  };

  const queueNext = state.queue[0];
  const confirmedCount = state.items.filter(i => i.takeaway).length;

  /* ---------------------------------------------------------------- */
  if (step === 'input') return (
    <Card>
      <div className="rk-tabs" role="tablist">
        {([['link', 'Paste a link', Link2], ['text', 'Add manually', Type], ['upload', 'Upload', ImageUp]] as const).map(([m, label, Icon]) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}><Icon size={14} style={{display: 'inline', marginRight: 6, verticalAlign: '-2px'}} />{label}</button>
        ))}
      </div>
      {mode === 'link' && <>
        <p className="rk-muted">Instagram, TikTok, YouTube or any page.</p>
        <div className="rk-field"><input className="rk-input" inputMode="url" autoComplete="off" placeholder="https://www.instagram.com/reel/…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void ingest(draft); }} /></div>
        <div className="rk-choices"><button className="rk-btn primary block" disabled={!draft.trim()} onClick={() => void ingest(draft)}>Add to Reckon</button></div>
      </>}
      {mode === 'text' && <>
        <p className="rk-muted">A quote, a thought, a transcript. Anything you want to keep.</p>
        <div className="rk-field"><textarea className="rk-textarea" placeholder="Paste or type…" value={draft} onChange={e => setDraft(e.target.value)} /></div>
        <div className="rk-choices"><button className="rk-btn primary block" disabled={!draft.trim()} onClick={addManual}>Add to Reckon</button></div>
      </>}
      {mode === 'upload' && <>
        <p className="rk-muted">A screenshot or photo. {status.ai ? 'Reckon will read what it can see.' : "Without an AI key Reckon can't read images, so you'll describe what caught you."}</p>
        <div className="rk-field"><input className="rk-input" type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) void addUpload(f); }} /></div>
        {busy && <Thinking label={busy} />}
      </>}
      {error && <p className="rk-error">{error}</p>}
      {queueNext && <>
        <div className="rk-divider" />
        <p className="rk-muted">{state.queue.length} saved link{state.queue.length === 1 ? '' : 's'} waiting.</p>
        <div className="rk-choices"><Link className="rk-btn secondary block" href={`/reckon/add?q=${queueNext.id}`}>Go through them</Link></div>
      </>}
    </Card>
  );

  if (step === 'adding') return <Card><Thinking label="Adding to Reckon…" /><p className="rk-muted" style={{marginTop: 10}}>Seeing what the source will share.</p></Card>;

  if (!source || !item) return null;
  const retrieved = source.retrieval.contentAvailableToAi;
  const unavailable = source.platform !== 'manual' && source.platform !== 'upload' && !retrieved;

  if (step === 'caught') return (
    <div className="rk-stack rk-fade">
      <Card>
        <Eyebrow>What caught you?</Eyebrow>
        <SourceCard source={source} />
        {unavailable && <p className="rk-muted" style={{marginTop: 14}}>I couldn&apos;t reliably read this {source.type === 'reel' || source.type === 'post' ? 'Reel' : source.type}. What caught you about it?</p>}
        {!unavailable && <h2 className="rk-h2" style={{marginTop: 16}}>What did you want to keep from this?</h2>}
        {error && <p className="rk-error">{error}</p>}
        <div className="rk-choices">
          {retrieved && <button className="rk-choice" onClick={() => void reckonIt()} disabled={!!busy}><Sparkles className="ico" /><span><strong>Reckon it for me</strong><span className="sub">I&apos;ll propose a takeaway from what was shared</span></span></button>}
          <button className="rk-choice" onClick={() => { setStep('tell'); if (speech.supported) speech.start(); }}><Mic className="ico" /><span><strong>Tell Reckon</strong><span className="sub">{speech.supported ? 'Say it out loud' : 'Voice needs Safari or Chrome; you can type instead'}</span></span></button>
          <button className="rk-choice" onClick={() => setStep('tell')}><PenLine className="ico" /><span><strong>Write it</strong><span className="sub">A few words is plenty</span></span></button>
          <button className="rk-choice" onClick={justKeep}><Bookmark className="ico" /><span><strong>Just keep it</strong><span className="sub">Come back to it later</span></span></button>
        </div>
        {busy && <div style={{marginTop: 14}}><Thinking label={busy} /></div>}
      </Card>
    </div>
  );

  if (step === 'tell') return (
    <Card className="rk-fade">
      <Eyebrow>What caught you?</Eyebrow>
      <SourceCard source={source} compact />
      <div className="rk-field" style={{marginTop: 16}}>
        <label htmlFor="tell">In your words</label>
        <textarea id="tell" className="rk-textarea" placeholder={speech.listening ? 'Listening…' : 'What did you want to keep?'} value={tellText} onChange={e => setTellText(e.target.value)} autoFocus />
      </div>
      {speech.error && <p className="rk-error">{speech.error}</p>}
      <div className="rk-row" style={{marginTop: 14, justifyContent: 'space-between'}}>
        {speech.supported ? <button className={`rk-iconbtn ${speech.listening ? 'live' : 'soft'}`} aria-label={speech.listening ? 'Stop listening' : 'Speak'} onClick={() => speech.listening ? speech.stop() : speech.start()}>{speech.listening ? <MicOff /> : <Mic />}</button> : <span />}
        <button className="rk-btn primary" disabled={!tellText.trim() || !!busy} onClick={() => void submitTell(speech.listening || speech.supported && tellText && !tellText.includes('\n') ? 'told' : 'written')}>That&apos;s it</button>
      </div>
      {busy && <div style={{marginTop: 14}}><Thinking label={busy} /></div>}
      <button className="rk-btn ghost" style={{marginTop: 8}} onClick={() => setStep('caught')}>Back</button>
    </Card>
  );

  if (step === 'proposal' && proposal) return (
    <Card className="rk-morph">
      <Eyebrow>What I think you wanted to keep</Eyebrow>
      {!editing ? <>
        <p className="rk-big">{proposal.text}</p>
        <p className="rk-muted" style={{marginTop: 14}}>Is that what caught you?</p>
        <div className="rk-choices">
          <button className="rk-btn primary block" onClick={() => void confirm(proposal.text)}><Check size={18} /> Exactly</button>
          <div className="rk-choices row" style={{marginTop: 0}}>
            <button className="rk-btn secondary" onClick={() => { setEditText(proposal.text); setEditing(true); }}>Not quite</button>
            <button className="rk-btn secondary" onClick={() => { setEditText(''); setEditing(true); }}>Something else</button>
          </div>
        </div>
      </> : <>
        <div className="rk-field"><label htmlFor="edit">Put it your way</label><textarea id="edit" className="rk-textarea" value={editText} onChange={e => setEditText(e.target.value)} autoFocus /></div>
        <div className="rk-choices row"><button className="rk-btn secondary" onClick={() => setEditing(false)}>Back</button><button className="rk-btn primary" disabled={!editText.trim()} onClick={() => void confirm(editText)}>Keep this</button></div>
      </>}
    </Card>
  );

  if (step === 'route') return (
    <Card className="rk-fade">
      <Eyebrow>Kept</Eyebrow>
      <p className="rk-quote">{state.items.find(i => i.id === item.id)?.takeaway?.text}</p>
      <div className="rk-divider" />
      <h2 className="rk-h2">What would you like this idea to do for you?</h2>
      {busy ? <div style={{marginTop: 14}}><Thinking label={busy} /></div> : (
        <div className="rk-choices">
          {orderRoutes(routeSuggestion).map(fn => (
            <button key={fn} className="rk-choice" aria-pressed={chosenRoute === fn} onClick={() => void chooseRoute(fn)}>
              <span className="dot" /><span><strong>{ROUTE_LABELS[fn].label}</strong><span className="sub">{ROUTE_LABELS[fn].hint}{routeSuggestion?.primary === fn ? ' · suggested' : ''}</span></span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );

  if (step === 'done') {
    const current = state.items.find(i => i.id === item.id);
    return (
      <Card className="rk-fade">
        <Ripple />
        <Eyebrow>{current?.takeaway ? 'Kept, your way' : 'Kept for later'}</Eyebrow>
        <p className="rk-big">{current?.takeaway?.text ?? "It's in My Reckons. You can say what caught you whenever you like."}</p>
        {current?.route && <p className="rk-muted" style={{marginTop: 10}}>{ROUTE_LABELS[current.route.function].label}</p>}
        <div className="rk-choices" style={{marginTop: 22}}>
          {queueNext && <button className="rk-btn primary block" onClick={() => router.push(`/reckon/add?q=${queueNext.id}`)}>Next saved link ({state.queue.length} left)</button>}
          {!queueNext && confirmedCount >= 3 && <Link className="rk-btn primary block" href="/reckon/thread">Find the thread</Link>}
          <button className="rk-btn secondary block" onClick={() => { setStep('input'); setDraft(''); setSource(null); setItem(null); setProposal(null); setTellText(''); setError(null); }}>Add another</button>
          <Link className="rk-btn ghost block" href="/reckon">Home</Link>
        </div>
      </Card>
    );
  }
  return null;
}

function orderRoutes(s: {primary: RouteFunction; alternatives: RouteFunction[]} | null): RouteFunction[] {
  if (!s) return ROUTE_ORDER;
  const head = [s.primary, ...s.alternatives.filter(a => a !== s.primary)];
  return [...head, ...ROUTE_ORDER.filter(r => !head.includes(r))];
}

async function downscale(file: File, max = 900): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}
