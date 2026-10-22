'use client';
import {Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {AddFlow} from '@/components/reckon/add-flow';
import {PageHeader} from '@/components/reckon/ui';
import {useReckon} from '@/lib/reckon/store';

function AddInner() {
  const params = useSearchParams();
  const {state, ready} = useReckon();
  const url = params.get('url') ?? undefined;
  const q = params.get('q') ?? undefined;
  const queued = q ? state.queue.find(x => x.id === q) : undefined;
  if (!ready) return null;
  return (
    <>
      <PageHeader back="/reckon" />
      <h1 className="rk-h1" style={{marginBottom: 16}}>Add to Reckon</h1>
      <AddFlow key={q ?? url ?? 'new'} initialUrl={queued?.url ?? url} queueId={queued?.id} />
    </>
  );
}

export default function AddPage() {
  return <Suspense fallback={null}><AddInner /></Suspense>;
}
