import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  RedirectLink,
  RedirectMethod,
  validateDestinationUrl,
  sanitizeTrackingParams,
  generateSlug,
  simulateOutboundHeaders,
  generateZeroReferrerHtml,
} from './src/utils/redirectorLogic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const initialLinks: RedirectLink[] = [
  {
    id: 'link-1',
    label: 'Affiliate Campaign Landing — Origin Shield',
    slug: 'zt-offer-prime',
    destinationUrl: 'https://example.com/special-deal?utm_source=fb_ads&fbclid=IwAR987654&partner=alpha',
    sanitizedUrl: 'https://example.com/special-deal?partner=alpha',
    method: 'meta-no-referrer',
    stripTrackingParams: true,
    delaySeconds: 0,
    status: 'active',
    hits: 148,
    createdAt: '2026-11-01T10:15:00Z',
    lastAccessedAt: '2026-11-03T03:40:12Z',
  },
  {
    id: 'link-2',
    label: 'Partner Outbound — Double-Hop Anonymizer',
    slug: 'zt-partner-bridge',
    destinationUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy?utm_medium=referral',
    sanitizedUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy',
    method: 'double-hop-bridge',
    stripTrackingParams: true,
    delaySeconds: 1,
    status: 'active',
    hits: 84,
    createdAt: '2026-11-02T14:22:00Z',
    lastAccessedAt: '2026-11-03T02:18:45Z',
  },
  {
    id: 'link-3',
    label: 'External Research Portal — Consent Gate',
    slug: 'zt-research-gate',
    destinationUrl: 'https://httpbin.org/headers',
    sanitizedUrl: 'https://httpbin.org/headers',
    method: 'consent-interstitial',
    stripTrackingParams: false,
    delaySeconds: 0,
    status: 'active',
    hits: 39,
    createdAt: '2026-11-02T19:05:00Z',
    lastAccessedAt: '2026-11-03T01:10:00Z',
  },
];

let linksStore: RedirectLink[] = [...initialLinks];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Apply strict privacy headers on all API & redirect responses
  app.use((_req, res, next) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.get('/api/links', (_req, res) => {
    res.json({ links: linksStore });
  });

  app.post('/api/links', (req, res) => {
    const {
      label,
      slug,
      destinationUrl,
      method = 'meta-no-referrer',
      stripTrackingParams = true,
      delaySeconds = 0,
    } = req.body ?? {};

    const validation = validateDestinationUrl(String(destinationUrl ?? ''));
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const finalSlug = generateSlug(slug ? String(slug) : undefined);
    if (linksStore.some((l) => l.slug === finalSlug)) {
      res.status(400).json({
        error: `Slug "${finalSlug}" is already in use. Please choose another slug.`,
      });
      return;
    }

    const sanitized = stripTrackingParams
      ? sanitizeTrackingParams(validation.normalizedUrl).cleanUrl
      : validation.normalizedUrl;

    const newLink: RedirectLink = {
      id: `link-${Date.now()}`,
      label: String(label || 'Protected Redirect Link').trim(),
      slug: finalSlug,
      destinationUrl: validation.normalizedUrl,
      sanitizedUrl: sanitized,
      method: method as RedirectMethod,
      stripTrackingParams: Boolean(stripTrackingParams),
      delaySeconds: Math.max(0, Math.min(10, Number(delaySeconds) || 0)),
      status: 'active',
      hits: 0,
      createdAt: new Date().toISOString(),
      lastAccessedAt: null,
    };

    linksStore = [newLink, ...linksStore];
    res.status(201).json({ link: newLink });
  });

  app.post('/api/links/:id/toggle', (req, res) => {
    const { id } = req.params;
    const target = linksStore.find((l) => l.id === id);
    if (!target) {
      res.status(404).json({ error: 'Redirect link not found.' });
      return;
    }
    target.status = target.status === 'active' ? 'paused' : 'active';
    res.json({ link: target });
  });

  app.post('/api/links/:id/hit', (req, res) => {
    const { id } = req.params;
    const target = linksStore.find((l) => l.id === id);
    if (!target) {
      res.status(404).json({ error: 'Redirect link not found.' });
      return;
    }
    target.hits += 1;
    target.lastAccessedAt = new Date().toISOString();
    res.json({ link: target });
  });

  app.delete('/api/links/:id', (req, res) => {
    const { id } = req.params;
    linksStore = linksStore.filter((l) => l.id !== id);
    res.json({ ok: true });
  });

  app.post('/api/inspect', (req, res) => {
    const {
      sourceOriginUrl = 'https://private-traffic-source.example.com/secret-ad-set',
      destinationUrl = 'https://example.com/landing?utm_source=newsletter&fbclid=IwAR123',
      method = 'meta-no-referrer',
      stripTracking = true,
    } = req.body ?? {};

    const result = simulateOutboundHeaders({
      sourceOriginUrl: String(sourceOriginUrl),
      destinationUrl: String(destinationUrl),
      method: method as RedirectMethod,
      stripTracking: Boolean(stripTracking),
      userAgent: req.headers['user-agent'] || undefined,
    });

    res.json(result);
  });

  app.get('/api/echo-headers', (req, res) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.json({
      receivedReferer: req.headers['referer'] || req.headers['referrer'] || null,
      receivedOrigin: req.headers['origin'] || null,
      userAgent: req.headers['user-agent'] || null,
      referrerPolicyApplied: 'no-referrer',
      timestamp: new Date().toISOString(),
    });
  });

  // Live Zero-Referrer Bridge Endpoint: /r/:slug
  app.get('/r/:slug', (req, res) => {
    const { slug } = req.params;
    const link = linksStore.find((l) => l.slug === slug);

    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    if (!link) {
      res.status(404).send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Redirect Not Found</title></head>
<body style="font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:24px;">
    <h1 style="font-size:20px;margin-bottom:8px;">404 — Redirect Link Not Found</h1>
    <p style="color:#94a3b8;font-size:14px;">Slug "/r/${slug}" does not exist.</p>
    <a href="/" style="color:#818cf8;font-size:14px;">Return to ZeroTrace Console</a>
  </div>
</body>
</html>`);
      return;
    }

    if (link.status === 'paused') {
      res.status(423).send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Link Paused</title></head>
<body style="font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:24px;">
    <h1 style="font-size:20px;margin-bottom:8px;">Redirect Link Paused</h1>
    <p style="color:#94a3b8;font-size:14px;">This redirect endpoint (/r/${link.slug}) is currently paused by the administrator.</p>
    <a href="/" style="color:#818cf8;font-size:14px;">Return to ZeroTrace Console</a>
  </div>
</body>
</html>`);
      return;
    }

    link.hits += 1;
    link.lastAccessedAt = new Date().toISOString();

    const targetUrl = link.stripTrackingParams ? link.sanitizedUrl : link.destinationUrl;

    if (link.method === 'http-307-noreferrer') {
      res.redirect(307, targetUrl);
      return;
    }

    const html = generateZeroReferrerHtml({
      destinationUrl: targetUrl,
      method: link.method,
      delaySeconds: link.delaySeconds,
      title: 'ZeroTrace Privacy Bridge',
    });

    res.status(200).send(html);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZeroTrace Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
