'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {House, Library, Fingerprint, MessageCircle} from 'lucide-react';
import type {ReactNode} from 'react';
import {ReckonStoreProvider} from '@/lib/reckon/store';

const tabs = [
  {href: '/reckon', label: 'Home', Icon: House, match: (p: string) => p === '/reckon'},
  {href: '/reckon/library', label: 'My Reckons', Icon: Library, match: (p: string) => p.startsWith('/reckon/library') || p.startsWith('/reckon/items') || p.startsWith('/reckon/thread')},
  {href: '/reckon/me', label: 'My Reckon', Icon: Fingerprint, match: (p: string) => p.startsWith('/reckon/me') || p.startsWith('/reckon/trying')},
  {href: '/reckon/chat', label: 'Chat', Icon: MessageCircle, match: (p: string) => p.startsWith('/reckon/chat')},
];

export function Shell({children}: {children: ReactNode}) {
  const path = usePathname() ?? '/reckon';
  return (
    <ReckonStoreProvider>
      <div className="rk rk-shell">
        <div className="rk-backdrop" aria-hidden="true" />
        <div className="rk-frame">
          <main className="rk-main">{children}</main>
        </div>
        <nav className="rk-nav" aria-label="Reckon">
          <div className="rk-nav-inner">
            {tabs.map(t => <Link key={t.href} href={t.href} aria-current={t.match(path) ? 'page' : undefined}><t.Icon aria-hidden="true" />{t.label}</Link>)}
          </div>
        </nav>
      </div>
    </ReckonStoreProvider>
  );
}
