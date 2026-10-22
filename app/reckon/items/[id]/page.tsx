'use client';
import {use, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Trash2, MessageCircle} from 'lucide-react';
import {useReckon} from '@/lib/reckon/store';
import {confirmTakeaway, deleteItem, setRoute, setSemantic, confirmedThemes, themeTitle, logAi} from '@/lib/reckon/model';
import {ROUTE_LABELS, ROUTE_ORDER, ITEM_STATUS_LABELS} from '@/lib/reckon/labels';
import {api} from '@/lib/reckon/client';
import type {RouteFunction} from '@/lib/reckon/types';
import {Card, Eyebrow, PageHeader, fmtDate} from '@/components/reckon/ui';
import {SourceCard} from '@/components/reckon/source-card';

export default function ItemPage({params}: {params: Promise<{id: string}>}) {
  const {id} = use(params);
  const {state, ready, update} = useReckon();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [routing, setRouting] = useState(false);
  if (!ready) return null;
  const item = state.items.find(i => i.id === id);
  const source = item && state.sources.find(s => s.id === item.sourceId);
  if (!item || !source) return <><PageHeader back="/reckon/library" /><p className="rk-empty">That Reckon is gone.</p></>;
  const themes = confirmedThemes(state).filter(t => item.themeIds.includes(t.id));
  const experiments = state.experiments.filter(e => e.itemIds.includes(item.id));

  const save = () => {
    const clean = text.trim(); if (!clean) return;
    update(s => confirmTakeaway(s, item.id, clean, item.distilled?.text));
    setEditing(false);
    api.features(clean, item.userNote, item.route?.function).then(r => update(s => logAi(setSemantic(s, item.id, {...r.output, provenance: {kind: r.meta.provider === 'anthropic' ? 'ai' : 'system', at: new Date().toISOString(), detail: r.meta.model ?? 'keyword facets (no AI key)'}}), {fn: 'features', provider: r.meta.provider, model: r.meta.model, ms: r.meta.ms, ok: !r.meta.error, error: r.meta.error}))).catch(() => {});
  };
  const changeRoute = (fn: RouteFunction) => { update(s => setRoute(s, item.id, fn, 'user', item.route?.alternatives ?? [])); setRouting(false); };

  return (
    <>
      <PageHeader back="/reckon/library" action={<button className="rk-btn ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete"><Trash2 size={18} /></button>} />
      <div className="rk-stack">
        <Card>
          <div className="rk-row between" style={{marginBottom: 12}}><span className="rk-chip">{ITEM_STATUS_LABELS[item.status]}</span><span className="rk-muted rk-small">{fmtDate(item.createdAt)}</span></div>
          <SourceCard source={source} />
        </Card>

        <Card>
          <Eyebrow>{item.takeaway ? 'What I wanted to keep' : 'What caught you?'}</Eyebrow>
          {item.takeaway && !editing && <>
            <p className="rk-big">{item.takeaway.text}</p>
            <p className="rk-muted rk-small" style={{marginTop: 8}}>{item.takeaway.status === 'user_modified' ? 'Confirmed, in your words' : 'Confirmed by you'} · {fmtDate(item.takeaway.confirmedAt)}</p>
            {item.distilled && item.distilled.text !== item.takeaway.text && <p className="rk-muted rk-small" style={{marginTop: 6}}>Reckon first read it as: “{item.distilled.text}”</p>}
            <div className="rk-row" style={{marginTop: 14}}><button className="rk-btn secondary sm" onClick={() => { setText(item.takeaway!.text); setEditing(true); }}>Change</button></div>
          </>}
          {(!item.takeaway || editing) && <>
            {!item.takeaway && <p className="rk-muted">Say what you wanted to keep from this, in a sentence.</p>}
            <div className="rk-field"><textarea className="rk-textarea" value={text} onChange={e => setText(e.target.value)} placeholder={item.distilled?.text ?? 'In your words…'} /></div>
            <div className="rk-choices row">{item.takeaway && <button className="rk-btn secondary" onClick={() => setEditing(false)}>Cancel</button>}<button className="rk-btn primary" disabled={!text.trim()} onClick={save}>Keep this</button></div>
          </>}
        </Card>

        {item.takeaway && (
          <Card tone="flat">
            <Eyebrow>What I want this idea to do</Eyebrow>
            {!routing ? <div className="rk-row between"><p>{item.route ? ROUTE_LABELS[item.route.function].label : 'Not chosen yet'}</p><button className="rk-btn secondary sm" onClick={() => setRouting(true)}>Change</button></div>
              : <div className="rk-choices">{ROUTE_ORDER.map(fn => <button key={fn} className="rk-choice" aria-pressed={item.route?.function === fn} onClick={() => changeRoute(fn)}><span className="dot" /><span><strong>{ROUTE_LABELS[fn].label}</strong></span></button>)}</div>}
            {themes.length > 0 && <><div className="rk-divider" /><Eyebrow>Threads</Eyebrow><div className="rk-chips">{themes.map(t => <span key={t.id} className="rk-chip champagne">{themeTitle(t)}</span>)}</div></>}
            {experiments.length > 0 && <><div className="rk-divider" /><Eyebrow>Being tried</Eyebrow>{experiments.map(e => <Link key={e.id} href={`/reckon/trying/${e.id}`} className="rk-muted" style={{display: 'block', textDecoration: 'underline'}}>{e.try}</Link>)}</>}
            <div className="rk-choices"><Link className="rk-btn secondary block" href={`/reckon/chat?item=${item.id}`}><MessageCircle size={16} /> Talk about this</Link></div>
          </Card>
        )}

        {confirmDelete && (
          <Card tone="navy"><p>Delete this Reckon? Its source, meaning and any thread evidence from it will go too.</p>
            <div className="rk-choices row"><button className="rk-btn secondary" onClick={() => setConfirmDelete(false)}>Keep it</button><button className="rk-btn champagne" onClick={() => { update(s => deleteItem(s, item.id)); router.push('/reckon/library'); }}>Delete</button></div></Card>
        )}
      </div>
    </>
  );
}
