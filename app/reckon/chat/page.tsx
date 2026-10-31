'use client';
import {Suspense, useEffect, useRef} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {useReckon} from '@/lib/reckon/store';
import {startConversation, themeTitle} from '@/lib/reckon/model';
import {PageHeader, Card, fmtDate} from '@/components/reckon/ui';
import {ChatView} from '@/components/reckon/chat';

function ChatInner() {
  const {state, ready, update} = useReckon();
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('c');
  const themeId = params.get('theme');
  const itemId = params.get('item');
  const fresh = params.get('new');
  const creating = useRef(false);

  useEffect(() => {
    if (!ready || id || creating.current) return;
    if (themeId || itemId || fresh) {
      creating.current = true;
      const theme = themeId ? state.themes.find(t => t.id === themeId) : undefined;
      const item = itemId ? state.items.find(i => i.id === itemId) : undefined;
      const existing = themeId ? state.conversations.find(c => c.themeId === themeId && c.stage !== 'done') : undefined;
      if (existing) { router.replace(`/reckon/chat?c=${existing.id}`); return; }
      const c = update(s => startConversation(s, {title: theme ? themeTitle(theme) : item?.takeaway?.text?.slice(0, 60) ?? 'Talk to Reckon', themeId: theme?.id, itemId: item?.id}).state);
      router.replace(`/reckon/chat?c=${c.conversations[c.conversations.length - 1].id}`);
    }
  }, [ready, id, themeId, itemId, fresh, state, update, router]);

  if (!ready) return null;
  const conversation = id ? state.conversations.find(c => c.id === id) : undefined;

  if (conversation) return <><PageHeader back="/reckon/chat" /><h1 className="rk-h2" style={{marginBottom: 14}}>{conversation.title}</h1><ChatView key={conversation.id} conversation={conversation} /></>;
  if (themeId || itemId || fresh) return null;

  const list = [...state.conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <>
      <PageHeader />
      <h1 className="rk-h1">Talk to Reckon</h1>
      <p className="rk-lead">Not a chatbot. A quiet conversation about what you&apos;ve kept and where it might matter.</p>
      <Link className="rk-btn primary block" href="/reckon/chat?new=1" style={{marginBottom: 16}}>Start a conversation</Link>
      <div className="rk-stack">
        {list.map(c => <Link key={c.id} href={`/reckon/chat?c=${c.id}`}><Card tone="plain"><div className="rk-row between"><strong style={{fontWeight: 500}}>{c.title}</strong><span className="rk-muted rk-small">{fmtDate(c.updatedAt)}</span></div><p className="rk-muted rk-small" style={{marginTop: 6}}>{c.messages[c.messages.length - 1]?.content.slice(0, 110) ?? ''}</p></Card></Link>)}
        {!list.length && <p className="rk-empty">Conversations usually begin from a thread Reckon noticed, or from a Reckon you want to think about.</p>}
      </div>
    </>
  );
}

export default function ChatPage() { return <Suspense fallback={null}><ChatInner /></Suspense>; }
