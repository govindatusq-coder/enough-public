'use client';
import Link from 'next/link';
import type {ReckonItem, Source, Theme} from '@/lib/reckon/types';
import {platformLabel} from '@/lib/reckon/platform';
import {ROUTE_LABELS, ITEM_STATUS_LABELS} from '@/lib/reckon/labels';
import {themeTitle} from '@/lib/reckon/model';
import {fmtDate} from './ui';

export function ItemCard({item, source, themes}: {item: ReckonItem; source?: Source; themes: Theme[]}) {
  const recede = item.status === 'INTEGRATED' || item.status === 'RETIRED';
  const image = source?.thumbnailUrl ?? source?.imageDataUrl;
  return (
    <Link href={`/reckon/items/${item.id}`} className={`rk-item ${recede ? 'recede' : ''}`}>
      {image ? (
        <div className="thumb">
          {/* Remote thumbnails come from arbitrary provider CDNs; next/image would need a per-host allowlist. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" loading="lazy" />
          <span className="rk-chip champagne platform">{source ? platformLabel[source.platform] : ''}</span>
        </div>
      ) : null}
      <div className="body">
        {!image && <div className="rk-row between" style={{marginBottom: 8}}><span className="rk-chip">{source ? platformLabel[source.platform] : 'Source'}</span>{item.isSeed && <span className="rk-chip mist">seed</span>}</div>}
        <p className="take">{item.takeaway?.text ?? (source?.title || source?.caption?.slice(0, 120) || source?.manualText?.slice(0, 120) || 'Kept, not yet reckoned')}</p>
        {!item.takeaway && <p className="rk-muted rk-small" style={{marginTop: 6}}>What caught you? Tap to say.</p>}
        <div className="foot">
          <span className="rk-chip">{ITEM_STATUS_LABELS[item.status]}</span>
          {item.route && <span>{ROUTE_LABELS[item.route.function].label}</span>}
          {themes.map(t => <span key={t.id} className="rk-chip champagne">{themeTitle(t)}</span>)}
          <span style={{marginLeft: 'auto'}}>{fmtDate(item.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}
