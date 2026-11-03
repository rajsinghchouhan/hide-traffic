import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDestinationUrl,
  sanitizeTrackingParams,
  normalizeSlug,
  simulateOutboundHeaders,
  generateZeroReferrerHtml,
} from './redirectorLogic';

test('validateDestinationUrl accepts valid URLs and auto-prepends https://', () => {
  const res1 = validateDestinationUrl('https://example.com/offer?id=10');
  assert.equal(res1.valid, true);
  assert.equal(res1.normalizedUrl, 'https://example.com/offer?id=10');

  const res2 = validateDestinationUrl('example.org/landing');
  assert.equal(res2.valid, true);
  assert.equal(res2.normalizedUrl, 'https://example.org/landing');

  const resEmpty = validateDestinationUrl('   ');
  assert.equal(resEmpty.valid, false);
});

test('sanitizeTrackingParams strips UTM, fbclid, gclid while keeping business params', () => {
  const raw =
    'https://shop.example.com/product?id=99&utm_source=facebook&utm_medium=cpc&fbclid=IwAR12345&plan=pro';
  const result = sanitizeTrackingParams(raw);
  assert.equal(result.cleanUrl, 'https://shop.example.com/product?id=99&plan=pro');
  assert.equal(result.strippedParams.length, 3);
});

test('normalizeSlug produces URL-safe lowercase slugs', () => {
  assert.equal(normalizeSlug('  My Secret Campaign #1! '), 'my-secret-campaign-1');
});

test('simulateOutboundHeaders omits Referer header and sets Referrer-Policy: no-referrer', () => {
  const sim = simulateOutboundHeaders({
    sourceOriginUrl: 'https://private-ad-network.example.com/campaign/77',
    destinationUrl: 'https://target-site.com/welcome?utm_source=tiktok&deal=50',
    method: 'meta-no-referrer',
    stripTracking: true,
  });

  assert.equal(sim.referrerVisibleToDestination, false);
  assert.equal(sim.bridgeResponseHeaders['Referrer-Policy'], 'no-referrer');
  assert.equal(
    sim.outboundHeadersToDestination['Referer'],
    '[OMITTED — Blank / Direct Traffic]'
  );
  assert.equal(sim.finalDestinationUrl, 'https://target-site.com/welcome?deal=50');
  assert.deepEqual(sim.strippedParams, ['utm_source=tiktok']);
});

test('generateZeroReferrerHtml embeds no-referrer meta tag and rel="noreferrer"', () => {
  const html = generateZeroReferrerHtml({
    destinationUrl: 'https://destination.example.com/path',
    method: 'meta-no-referrer',
  });
  assert.ok(html.includes('<meta name="referrer" content="no-referrer" />'));
  assert.ok(html.includes('noreferrer noopener'));
});
