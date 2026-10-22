'use client';
import {useEffect, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowUp, Mic, MicOff} from 'lucide-react';
import type {Conversation, ExperimentProposal} from '@/lib/reckon/types';
import {useReckon} from '@/lib/reckon/store';
import {appendMessage, createExperiment, logAi, themeTitle} from '@/lib/reckon/model';
import {api} from '@/lib/reckon/client';
import {Card, Eyebrow, Thinking} from './ui';
import {ExperimentFields} from './experiment-card';
import {useSpeech} from './voice';

export function ChatView({conversation}: {conversation: Conversation}) {
  const {state, update} = useReckon();
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{msgId: string; proposal: ExperimentProposal} | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const speech = useSpeech(t => setText(t));
  const theme = conversation.themeId ? state.themes.find(t => t.id === conversation.themeId) : undefined;

  const send = async (userMessage: string) => {
    setBusy(true); setError(null);
    const withUser = userMessage ? update(s => appendMessage(s, conversation.id, {role: 'user', content: userMessage, provenance: {kind: 'user', at: new Date().toISOString()}})) : state;
    try {
      const r = await api.chat(withUser, conversation.id, userMessage);
      update(s => {
        const logged = logAi(s, {fn: 'chat', provider: r.meta.provider, model: r.meta.model, ms: r.meta.ms, ok: !r.meta.error, error: r.meta.error, inputTokens: r.meta.inputTokens, outputTokens: r.meta.outputTokens});
        return appendMessage(logged, conversation.id, {role: 'reckon', content: r.output.reply, contextUsed: r.context, proposal: r.output.proposal, safety: r.safety, provenance: {kind: r.meta.provider === 'anthropic' ? 'ai' : 'system', at: new Date().toISOString(), detail: r.meta.model ?? 'scripted (no AI key)'}}, r.output.stage);
      });
    } catch (err) { setError(err instanceof Error ? err.message : 'Reckon could not reply just now.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (conversation.messages.length === 0 && !opened.current) { opened.current = true; void send(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);
  useEffect(() => { endRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'}); }, [conversation.messages.length, busy]);

  const accept = (msgId: string, proposal: ExperimentProposal, modified: boolean) => {
    const ctx = conversation.messages.find(m => m.id === msgId)?.contextUsed;
    const created = update(s => createExperiment(s, proposal, {themeIds: conversation.themeId ? [conversation.themeId] : ctx?.themeIds ?? [], itemIds: ctx?.itemIds ?? (conversation.itemId ? [conversation.itemId] : []), conversationId: conversation.id, userModified: modified, provenance: {kind: 'ai', at: new Date().toISOString(), detail: `proposed in conversation, ${modified ? 'adjusted and ' : ''}accepted by you`}}).state);
    const exp = created.experiments[created.experiments.length - 1];
    update(s => appendMessage(s, conversation.id, {role: 'reckon', content: `It's on your Things I'm trying. I'll ask how it went after the next real opportunity, and nothing more until then.`, provenance: {kind: 'system', at: new Date().toISOString()}}, 'done'));
    setEditing(null);
    router.push(`/reckon/trying/${exp.id}`);
  };

  return (
    <>
      {theme && <p className="rk-muted rk-small" style={{marginBottom: 10}}>About: {themeTitle(theme)}</p>}
      <div className="rk-chat">
        {conversation.messages.map(m => (
          <div key={m.id} className="rk-fade" style={{display: 'contents'}}>
            <div className={`rk-msg ${m.role} ${m.safety ? 'safety' : ''}`}>{m.content}</div>
            {m.proposal && (
              <Card tone="plain" style={{alignSelf: 'stretch'}}>
                <Eyebrow>Something to try</Eyebrow>
                {editing?.msgId === m.id ? <>
                  <ExperimentFields x={editing.proposal} editable onChange={p => setEditing({msgId: m.id, proposal: {...editing.proposal, ...p}})} />
                  <div className="rk-choices row"><button className="rk-btn secondary" onClick={() => setEditing(null)}>Back</button><button className="rk-btn primary" onClick={() => accept(m.id, editing.proposal, true)}>Try this</button></div>
                </> : <>
                  <ExperimentFields x={m.proposal} />
                  {!state.experiments.some(e => e.conversationId === conversation.id) && (
                    <div className="rk-choices">
                      <button className="rk-btn primary block" onClick={() => accept(m.id, m.proposal!, false)}>Try this</button>
                      <div className="rk-choices row" style={{marginTop: 0}}><button className="rk-btn secondary" onClick={() => setEditing({msgId: m.id, proposal: m.proposal!})}>Adjust</button><button className="rk-btn ghost" onClick={() => void send('Not now.')}>Not now</button></div>
                    </div>
                  )}
                </>}
              </Card>
            )}
          </div>
        ))}
        {busy && <div className="rk-msg reckon"><Thinking label="…" /></div>}
        {error && <p className="rk-error">{error}</p>}
        <div ref={endRef} />
      </div>
      <div className="rk-composer">
        {speech.supported && <button className={`rk-iconbtn ${speech.listening ? 'live' : 'soft'}`} aria-label={speech.listening ? 'Stop' : 'Speak'} onClick={() => speech.listening ? speech.stop() : speech.start()}>{speech.listening ? <MicOff /> : <Mic />}</button>}
        <textarea value={text} placeholder={conversation.stage === 'done' ? 'Anything else?' : 'Say what comes to mind…'} rows={1} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim() && !busy) { const t = text.trim(); setText(''); void send(t); } } }} />
        <button className="rk-iconbtn" aria-label="Send" disabled={!text.trim() || busy} onClick={() => { const t = text.trim(); setText(''); if (speech.listening) speech.stop(); void send(t); }}><ArrowUp /></button>
      </div>
    </>
  );
}
