export type RedirectMethod =
  | 'meta-no-referrer'
  | 'http-307-noreferrer'
  | 'double-hop-bridge'
  | 'consent-interstitial';

export interface RedirectLink {
  id: string;
  label: string;
  slug: string;
  destinationUrl: string;
  sanitizedUrl: string;
  method: RedirectMethod;
  stripTrackingParams: boolean;
  delaySeconds: number;
  status: 'active' | 'paused';
  hits: number;
  createdAt: string;
  lastAccessedAt: string | null;
}

export interface HeaderSimulationResult {
  inboundHeaders: Record<string, string>;
  bridgeResponseHeaders: Record<string, string>;
  outboundHeadersToDestination: Record<string, string>;
  referrerVisibleToDestination: boolean;
  strippedParams: string[];
  finalDestinationUrl: string;
  privacySummary: string;
}

const TRACKING_PARAMS_TO_STRIP = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'twclid',
  'ttclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'referrer',
  'source',
  '_hsenc',
  '_hsmi',
  'yclid',
  'igshid',
]);

export function validateDestinationUrl(rawUrl: string): {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Destination URL is required (Destination URL dalna zaroori hai).',
    };
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Only HTTP and HTTPS destination URLs are supported.',
      };
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Please enter a valid domain name (e.g., https://example.com/offer).',
      };
    }
    return {
      valid: true,
      normalizedUrl: parsed.toString(),
    };
  } catch {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Invalid URL format. Please enter a complete web address.',
    };
  }
}

export function sanitizeTrackingParams(rawUrl: string): {
  cleanUrl: string;
  strippedParams: string[];
} {
  const validation = validateDestinationUrl(rawUrl);
  if (!validation.valid) {
    return { cleanUrl: rawUrl, strippedParams: [] };
  }

  const parsed = new URL(validation.normalizedUrl);
  const strippedParams: string[] = [];

  const keys = Array.from(parsed.searchParams.keys());
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (
      TRACKING_PARAMS_TO_STRIP.has(lowerKey) ||
      lowerKey.startsWith('utm_')
    ) {
      strippedParams.push(`${key}=${parsed.searchParams.get(key) ?? ''}`);
      parsed.searchParams.delete(key);
    }
  }

  return {
    cleanUrl: parsed.toString(),
    strippedParams,
  };
}

export function normalizeSlug(rawSlug: string): string {
  return rawSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function generateSlug(seed?: string): string {
  if (seed) {
    const cleaned = normalizeSlug(seed);
    if (cleaned.length >= 3) {
      return cleaned.slice(0, 32);
    }
  }
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = 'zt-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function simulateOutboundHeaders(options: {
  sourceOriginUrl: string;
  destinationUrl: string;
  method: RedirectMethod;
  stripTracking: boolean;
  userAgent?: string;
}): HeaderSimulationResult {
  const {
    sourceOriginUrl,
    destinationUrl,
    method,
    stripTracking,
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  } = options;

  const { cleanUrl, strippedParams } = stripTracking
    ? sanitizeTrackingParams(destinationUrl)
    : {
        cleanUrl: validateDestinationUrl(destinationUrl).normalizedUrl || destinationUrl,
        strippedParams: [],
      };

  let destHost = 'destination.example.com';
  try {
    destHost = new URL(cleanUrl).host;
  } catch {
    destHost = 'destination.example.com';
  }

  const inboundHeaders: Record<string, string> = {
    Host: 'zerotrace-bridge.local',
    Referer: sourceOriginUrl || 'https://private-source-campaign.example.com/ad-group-42',
    'User-Agent': userAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
  };

  const bridgeResponseHeaders: Record<string, string> = {
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  };

  if (method === 'http-307-noreferrer') {
    bridgeResponseHeaders['Status'] = '307 Temporary Redirect';
    bridgeResponseHeaders['Location'] = cleanUrl;
  } else {
    bridgeResponseHeaders['Status'] = '200 OK (Zero-Referrer HTML Bridge)';
    bridgeResponseHeaders['Content-Type'] = 'text/html; charset=utf-8';
  }

  const outboundHeadersToDestination: Record<string, string> = {
    Host: destHost,
    Referer: '[OMITTED — Blank / Direct Traffic]',
    'User-Agent': userAgent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
  };

  const methodDescriptions: Record<RedirectMethod, string> = {
    'meta-no-referrer':
      'HTML <meta name="referrer" content="no-referrer"> + window.location.replace() strips the HTTP Referer header so the destination logs Direct / Dark Traffic.',
    'http-307-noreferrer':
      'Server responds with Referrer-Policy: no-referrer and 307 redirect, instructing compliant browsers to drop the origin Referer header.',
    'double-hop-bridge':
      'Two-stage neutral hop clears both document.referrer and intermediate referrer context before loading the destination URL.',
    'consent-interstitial':
      'Displays a click-through anchor with rel="noreferrer noopener" and Referrer-Policy: no-referrer for verified manual navigation.',
  };

  return {
    inboundHeaders,
    bridgeResponseHeaders,
    outboundHeadersToDestination,
    referrerVisibleToDestination: false,
    strippedParams,
    finalDestinationUrl: cleanUrl,
    privacySummary: methodDescriptions[method],
  };
}

export function generateZeroReferrerHtml(options: {
  destinationUrl: string;
  method: RedirectMethod;
  delaySeconds?: number;
  title?: string;
}): string {
  const {
    destinationUrl,
    method,
    delaySeconds = 0,
    title = 'Redirecting...',
  } = options;

  const safeUrl = destinationUrl.replace(/"/g, '&quot;');
  const jsUrl = JSON.stringify(destinationUrl);
  const delayMs = Math.max(0, delaySeconds) * 1000;

  if (method === 'consent-interstitial') {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="referrer" content="no-referrer" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 440px; width: 90%; text-align: center; }
    .btn { display: inline-block; margin-top: 20px; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; }
    .meta { font-size: 12px; color: #94a3b8; margin-top: 14px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin:0 0 8px 0;font-size:18px;">Privacy-Protected Redirect</h2>
    <p style="margin:0;color:#cbd5e1;font-size:14px;">Your origin traffic source (HTTP Referer) is hidden via strict no-referrer policy.</p>
    <a class="btn" href="${safeUrl}" rel="noreferrer noopener" referrerpolicy="no-referrer">Continue to Destination</a>
    <div class="meta">Referrer-Policy: no-referrer · document.referrer: ""</div>
  </div>
</body>
</html>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="referrer" content="no-referrer" />
  <meta name="robots" content="noindex, nofollow" />
  <meta http-equiv="refresh" content="${Math.max(1, delaySeconds)};url=${safeUrl}" />
  <title>${title}</title>
  <script>
    (function() {
      var target = ${jsUrl};
      var go = function() {
        try {
          var link = document.createElement('a');
          link.rel = 'noreferrer noopener';
          link.referrerPolicy = 'no-referrer';
          link.href = target;
          document.body.appendChild(link);
          link.click();
        } catch (e) {
          window.location.replace(target);
        }
      };
      if (${delayMs} <= 0) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', go);
        } else {
          go();
        }
      } else {
        setTimeout(go, ${delayMs});
      }
    })();
  </script>
</head>
<body style="background:#0f172a;color:#94a3b8;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <noscript>
    <a href="${safeUrl}" rel="noreferrer noopener" referrerpolicy="no-referrer" style="color:#818cf8;">Continue to destination</a>
  </noscript>
</body>
</html>`;
}

export function generateServerSnippet(
  platform: 'html' | 'cloudflare' | 'nginx' | 'express',
  destinationUrl: string,
  method: RedirectMethod
): string {
  const clean =
    validateDestinationUrl(destinationUrl).normalizedUrl ||
    'https://example.com/landing';

  switch (platform) {
    case 'html':
      return generateZeroReferrerHtml({
        destinationUrl: clean,
        method,
        delaySeconds: 0,
      });
    case 'cloudflare':
      return `// Cloudflare Worker — Zero-Referrer Traffic Redirector
export default {
  async fetch(request) {
    const targetUrl = ${JSON.stringify(clean)};
    const html = \`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="refresh" content="0;url=\${targetUrl}">
  <script>window.location.replace(\${JSON.stringify(targetUrl)});</script>
</head>
<body></body>
</html>\`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }
};`;
    case 'nginx':
      return `# Nginx Location Block — Strip HTTP Referer & Origin Headers
location /go/ {
    add_header Referrer-Policy "no-referrer" always;
    add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    default_type text/html;
    return 200 '<!doctype html><html><head><meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="0;url=${clean}"><script>location.replace("${clean}")</script></head><body></body></html>';
}`;
    case 'express':
      return `// Express.js Middleware — Zero-Referrer Bridge Route
app.get('/r/:slug', (req, res) => {
  const destination = ${JSON.stringify(clean)};
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.status(200).send(\`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <script>
    const a = document.createElement('a');
    a.rel = 'noreferrer noopener';
    a.referrerPolicy = 'no-referrer';
    a.href = \${JSON.stringify(destination)};
    document.body.appendChild(a);
    a.click();
  </script>
</head>
<body></body>
</html>\`);
});`;
  }
}

export function encodePortableTarget(url: string): string {
  try {
    const bytes = new TextEncoder().encode(url);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return encodeURIComponent(url);
  }
}

export function decodePortableTarget(encoded: string): string | null {
  if (!encoded) return null;
  try {
    if (/^https?:\/\//i.test(encoded)) {
      return validateDestinationUrl(encoded).normalizedUrl || null;
    }
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder().decode(bytes);
    const validation = validateDestinationUrl(decoded);
    return validation.valid ? validation.normalizedUrl : null;
  } catch {
    return null;
  }
}

export function buildPortableRedirectUrl(
  baseUrl: string,
  link: Pick<
    RedirectLink,
    'slug' | 'destinationUrl' | 'sanitizedUrl' | 'stripTrackingParams' | 'method' | 'delaySeconds'
  >
): string {
  const target = link.stripTrackingParams ? link.sanitizedUrl : link.destinationUrl;
  const encoded = encodePortableTarget(target);
  const cleanBase = baseUrl.replace(/\/$/, '');
  const params = new URLSearchParams();
  params.set('r', link.slug);
  params.set('u', encoded);
  if (link.method === 'consent-interstitial') {
    params.set('m', 'gate');
  }
  if (link.delaySeconds > 0) {
    params.set('d', String(link.delaySeconds));
  }
  return `${cleanBase}/?${params.toString()}`;
}

