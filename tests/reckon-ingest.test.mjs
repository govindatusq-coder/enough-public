import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePageMeta, parseInstagramEmbed, looksBlocked} from '../lib/reckon/ingest/parse.ts';
import {retrieveSource} from '../lib/reckon/ingest/retrieve.ts';
import {detectSource} from '../lib/reckon/platform.ts';
import * as fallback from '../lib/reckon/ai/fallback.ts';
import {manualRecord} from '../lib/reckon/model.ts';

function mockFetch(responder) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const r = responder(String(url));
    if (r instanceof Error) throw r;
    return new Response(r.body ?? '', {status: r.status ?? 200, headers: {'content-type': r.type ?? 'text/html'}});
  };
  return () => { globalThis.fetch = original; };
}

test('parses Open Graph metadata and decodes entities', () => {
  const html = `<html><head><title>Fallback &amp; title</title><meta property="og:title" content="Start before you&#39;re ready"><meta property="og:description" content="A short &quot;note&quot;"><meta property="og:image" content="https://img.example/x.jpg"></head><body><p>${'word '.repeat(30)}</p></body></html>`;
  const m = parsePageMeta(html, {readableText: true});
  assert.equal(m.title, "Start before you're ready");
  assert.equal(m.description, 'A short "note"');
  assert.equal(m.image, 'https://img.example/x.jpg');
  assert.ok(m.text.startsWith('word word'));
});

test('parses the Instagram embed caption block only when present', () => {
  const html = `<div class="Caption"><a class="CaptionUsername">someone</a> Motivation follows action. Start anyway.<br>#reels</div>`;
  assert.equal(parseInstagramEmbed(html).caption, 'Motivation follows action. Start anyway. #reels');
  assert.deepEqual(parseInstagramEmbed('<html><body>nothing here</body></html>'), {});
  assert.ok(looksBlocked('<html></html>', 'https://www.instagram.com/accounts/login/?next=/p/x/'));
});

test('a blocked Instagram retrieval records every attempt and invents nothing', async () => {
  const restore = mockFetch(() => Object.assign(new Error('CONNECT tunnel failed, response 403'), {name: 'FetchError'}));
  try {
    const result = await retrieveSource(detectSource('https://www.instagram.com/p/DcqQ7sMgBjE/'));
    assert.equal(result.record.status, 'failed');
    assert.equal(result.record.contentAvailableToAi, false);
    assert.equal(result.record.transcriptAvailable, false);
    assert.deepEqual(result.record.fieldsRetrieved, []);
    assert.equal(result.content.caption, undefined);
    assert.equal(result.content.title, undefined);
    assert.equal(result.content.embedUrl, 'https://www.instagram.com/p/DcqQ7sMgBjE/embed/captioned/');
    assert.deepEqual(result.record.attempts.map(a => a.method), ['oembed', 'open_graph', 'embed_page']);
    assert.ok(result.record.attempts[0].note.includes('not configured'));
    assert.ok(result.record.attempts[1].error.includes('403'));
    assert.ok(result.record.error);
  } finally { restore(); }
});

test('a login-walled Instagram page is marked unavailable, not retrieved', async () => {
  const restore = mockFetch(url => url.includes('/embed/') ? {body: '<html><body>Login</body></html>'} : {body: '<html><head><meta property="og:title" content="Instagram"></head><body><form id="loginForm"></form></body></html>', status: 200});
  try {
    const result = await retrieveSource(detectSource('https://www.instagram.com/reel/Cxyz_123/'));
    assert.equal(result.record.status, 'unavailable');
    assert.equal(result.content.caption, undefined);
    assert.equal(result.record.contentAvailableToAi, false);
  } finally { restore(); }
});

test('a real caption makes content available to the AI', async () => {
  const caption = 'Motivation follows action. If you wait to feel ready you will wait forever, so start with two minutes.';
  const restore = mockFetch(url => url.includes('/embed/') ? {body: `<div class="Caption">${caption}</div>`} : {body: '<html><head><meta property="og:image" content="https://cdn.example/thumb.jpg"></head></html>'});
  try {
    const result = await retrieveSource(detectSource('https://www.instagram.com/reel/Cxyz_123/'));
    assert.equal(result.record.status, 'retrieved');
    assert.equal(result.content.caption, caption);
    assert.equal(result.content.thumbnailUrl, 'https://cdn.example/thumb.jpg');
    assert.equal(result.record.contentAvailableToAi, true);
    assert.ok(result.record.fieldsRetrieved.includes('caption'));
  } finally { restore(); }
});

test('YouTube uses public oEmbed metadata only and never claims a transcript', async () => {
  const restore = mockFetch(url => url.includes('/oembed') ? {body: JSON.stringify({title: 'How to start when you do not feel like it', author_name: 'Someone', thumbnail_url: 'https://i.ytimg.com/x.jpg'}), type: 'application/json'} : {body: '<html></html>'});
  try {
    const result = await retrieveSource(detectSource('https://youtu.be/dQw4w9WgXcQ'));
    assert.equal(result.content.title, 'How to start when you do not feel like it');
    assert.equal(result.record.transcriptAvailable, false);
    assert.equal(result.record.status, 'partial');
  } finally { restore(); }
});

test('the fallback distiller refuses to invent an insight from thin sources', () => {
  const source = {id: 's', userId: 'u', createdAt: '', updatedAt: '', platform: 'instagram', type: 'reel', retrieval: {...manualRecord('manual'), status: 'unavailable', fieldsRetrieved: []}};
  const out = fallback.distil(source);
  assert.equal(out.enoughContent, false);
  assert.equal(out.insight, '');
  const withCaption = fallback.distil({...source, caption: 'Starting smaller can be more useful than waiting to feel motivated. Try two minutes.'});
  assert.equal(withCaption.enoughContent, true);
  assert.equal(withCaption.insight, 'Starting smaller can be more useful than waiting to feel motivated.');
});
