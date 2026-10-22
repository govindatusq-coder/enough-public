'use client';
import {Suspense, useMemo, useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Search, Waves} from 'lucide-react';
import {useReckon} from '@/lib/reckon/store';
import {tokens, detectFacets} from '@/lib/reckon/facets';
import {itemText} from '@/lib/reckon/threads';
import {confirmedThemes} from '@/lib/reckon/model';
import {ITEM_STATUS_LABELS} from '@/lib/reckon/labels';
import type {ItemStatus} from '@/lib/reckon/types';
import {PageHeader} from '@/components/reckon/ui';
import {ItemCard} from '@/components/reckon/item-card';

const FILTERS: ('all' | 'unfinished' | ItemStatus)[] = ['all', 'unfinished', 'KEPT', 'EXPLORING', 'TRYING', 'WORKING', 'INTEGRATED'];

function LibraryInner() {
  const {state, ready} = useReckon();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<typeof FILTERS[number]>((params.get('filter') as typeof FILTERS[number]) ?? 'all');
  const themes = confirmedThemes(state);

  const items = useMemo(() => {
    let list = state.items.filter(i => !i.archived);
    if (filter === 'unfinished') list = list.filter(i => !i.takeaway);
    else if (filter !== 'all') list = list.filter(i => i.status === filter);
    const query = q.trim();
    if (query) {
      // Search by meaning: facet overlap plus tokens over the confirmed takeaway and semantic features, not just titles.
      const qt = new Set(tokens(query)); const qf = new Set(detectFacets(query));
      list = list.map(i => {
        const src = state.sources.find(s => s.id === i.sourceId);
        const text = itemText(i) + ' ' + (i.userNote ?? '') + ' ' + (src?.title ?? '') + ' ' + (src?.caption ?? '') + ' ' + (src?.manualText ?? '');
        let score = 0;
        for (const t of tokens(text)) if (qt.has(t)) score += 1;
        for (const f of i.semantic?.facets ?? detectFacets(text)) if (qf.has(f)) score += 3;
        if (text.toLowerCase().includes(query.toLowerCase())) score += 2;
        return {i, score};
      }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.i);
    } else list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [state.items, state.sources, q, filter]);

  if (!ready) return null;
  const confirmed = state.items.filter(i => i.takeaway).length;
  return (
    <>
      <PageHeader />
      <h1 className="rk-h1">My Reckons</h1>
      <p className="rk-lead">{confirmed} kept your way{state.items.length > confirmed ? `, ${state.items.length - confirmed} waiting` : ''}.</p>
      {confirmed >= 2 && <Link href="/reckon/thread" className="rk-btn champagne block" style={{marginBottom: 16}}><Waves size={18} /> Find the thread</Link>}
      <div className="rk-searchwrap"><Search /><input className="rk-input" placeholder="Search by meaning…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="rk-filters">{FILTERS.map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'unfinished' ? 'Not yet reckoned' : ITEM_STATUS_LABELS[f]}</button>)}</div>
      <div className="rk-grid">
        {items.map(i => <ItemCard key={i.id} item={i} source={state.sources.find(s => s.id === i.sourceId)} themes={themes.filter(t => i.themeIds.includes(t.id))} />)}
        {items.length === 0 && <p className="rk-empty">{state.items.length ? 'Nothing matches that.' : 'Nothing kept yet.'} <Link href="/reckon/add" style={{textDecoration: 'underline'}}>Add to Reckon</Link></p>}
      </div>
    </>
  );
}

export default function LibraryPage() { return <Suspense fallback={null}><LibraryInner /></Suspense>; }
