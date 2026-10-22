import test from 'node:test';
import assert from 'node:assert/strict';
import {detectSource, looksLikeUrl, normaliseUrl} from '../lib/reckon/platform.ts';

test('detects Instagram posts and reels and strips tracking', () => {
  const d = detectSource('https://www.instagram.com/p/DcqQ7sMgBjE/?igsh=abc123&utm_source=ig');
  assert.equal(d.platform, 'instagram');
  assert.equal(d.type, 'post');
  assert.equal(d.externalId, 'DcqQ7sMgBjE');
  assert.equal(d.canonicalUrl, 'https://www.instagram.com/p/DcqQ7sMgBjE/');
  assert.equal(d.embedUrl, 'https://www.instagram.com/p/DcqQ7sMgBjE/embed/captioned/');
  assert.equal(detectSource('instagram.com/reel/Cxyz_123/').type, 'reel');
  assert.equal(detectSource('https://www.instagram.com/someone/reel/Cxyz_123/').externalId, 'Cxyz_123');
});

test('detects YouTube, TikTok and generic web', () => {
  assert.deepEqual([detectSource('https://youtu.be/dQw4w9WgXcQ?si=x').platform, detectSource('https://youtu.be/dQw4w9WgXcQ').externalId], ['youtube', 'dQw4w9WgXcQ']);
  assert.equal(detectSource('https://www.youtube.com/shorts/abcDEF12345').type, 'short');
  assert.equal(detectSource('https://www.youtube.com/watch?v=abcDEF12345&t=3').canonicalUrl, 'https://www.youtube.com/watch?v=abcDEF12345');
  const tt = detectSource('https://www.tiktok.com/@scout2015/video/6718335390845095173?_r=1');
  assert.equal(tt.platform, 'tiktok'); assert.equal(tt.externalId, '6718335390845095173');
  assert.equal(detectSource('https://example.com/article?utm_campaign=x#top').canonicalUrl, 'https://example.com/article');
  assert.equal(detectSource('example.com/a').platform, 'web');
});

test('rejects non-URLs', () => {
  assert.equal(detectSource('just a thought about starting'), null);
  assert.equal(detectSource('ftp://x.com/a'), null);
  assert.equal(looksLikeUrl('starting small is hard'), false);
  assert.equal(looksLikeUrl('www.instagram.com/p/abc/'), true);
  assert.equal(normaliseUrl('   '), null);
});
