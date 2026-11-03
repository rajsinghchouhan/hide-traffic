import React, { useState, useEffect, useRef } from 'react';
import {
  RedirectLink,
  RedirectMethod,
  validateDestinationUrl,
  sanitizeTrackingParams,
  generateSlug,
} from './utils/redirectorLogic';
import { HeaderInspectorPanel } from './components/HeaderInspectorPanel';
import { CodeGeneratorPanel } from './components/CodeGeneratorPanel';
import { BridgePreviewModal } from './components/BridgePreviewModal';
import {
  Copy,
  Check,
  Search,
  Trash2,
  Eye,
  Pause,
  Play,
  SlidersHorizontal,
  ArrowUpRight,
} from 'lucide-react';

const FALLBACK_LINKS: RedirectLink[] = [
  {
    id: 'link-1',
    label: 'Affiliate Campaign Landing — Origin Shield',
    slug: 'zt-offer-prime',
    destinationUrl:
      'https://example.com/special-deal?utm_source=fb_ads&fbclid=IwAR987654&partner=alpha',
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
    destinationUrl:
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy?utm_medium=referral',
    sanitizedUrl:
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy',
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

const METHOD_LABELS: Record<RedirectMethod, string> = {
  'meta-no-referrer': 'Meta No-Referrer Bridge',
  'double-hop-bridge': 'Double-Hop Isolation',
  'http-307-noreferrer': 'HTTP 307 + no-referrer',
  'consent-interstitial': 'Click-Through Gate',
};

export default function App() {
  const [links, setLinks] = useState<RedirectLink[]>(FALLBACK_LINKS);
  const [isLoading, setIsLoading] = useState(false);

  // Builder Form State
  const [labelInput, setLabelInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const [methodInput, setMethodInput] = useState<RedirectMethod>('meta-no-referrer');
  const [stripParamsInput, setStripParamsInput] = useState(true);
  const [delayInput, setDelayInput] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selected Link for Preview or Inspector
  const [previewLink, setPreviewLink] = useState<RedirectLink | null>(null);
  const [inspectorTarget, setInspectorTarget] = useState<{
    url: string;
    method: RedirectMethod;
  }>({
    url: 'https://example.com/special-deal?utm_source=fb_ads&fbclid=IwAR987654&partner=alpha',
    method: 'meta-no-referrer',
  });

  const destInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const fetchLinks = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/links');
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data.links)) {
            setLinks(data.links);
          }
        }
      } catch {
        // Keep deterministic fallback links if offline
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchLinks();
    return () => {
      active = false;
    };
  }, []);

  const liveSanitizedPreview = destinationInput.trim()
    ? sanitizeTrackingParams(destinationInput)
    : null;

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const validation = validateDestinationUrl(destinationInput);
    if (!validation.valid) {
      setFormError(validation.error || 'Please enter a valid Destination URL.');
      return;
    }

    const desiredSlug = generateSlug(slugInput || undefined);
    if (links.some((l) => l.slug === desiredSlug)) {
      setFormError(`Slug "${desiredSlug}" already exists. Try another custom slug.`);
      return;
    }

    const sanitized = stripParamsInput
      ? sanitizeTrackingParams(validation.normalizedUrl).cleanUrl
      : validation.normalizedUrl;

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: labelInput.trim() || 'Origin-Protected Redirect Link',
          slug: desiredSlug,
          destinationUrl: validation.normalizedUrl,
          method: methodInput,
          stripTrackingParams: stripParamsInput,
          delaySeconds: delayInput,
        }),
      });

      if (response.ok) {
        const { link } = await response.json();
        setLinks((prev) => [link, ...prev]);
        setFormSuccess(
          `Created zero-referrer redirect link /r/${link.slug} — origin traffic source is now hidden.`
        );
      } else {
        const errData = await response.json().catch(() => ({}));
        if (errData.error) {
          setFormError(errData.error);
          return;
        }
      }
    } catch {
      const fallbackNew: RedirectLink = {
        id: `link-${Date.now()}`,
        label: labelInput.trim() || 'Origin-Protected Redirect Link',
        slug: desiredSlug,
        destinationUrl: validation.normalizedUrl,
        sanitizedUrl: sanitized,
        method: methodInput,
        stripTrackingParams: stripParamsInput,
        delaySeconds: delayInput,
        status: 'active',
        hits: 0,
        createdAt: new Date().toISOString(),
        lastAccessedAt: null,
      };
      setLinks((prev) => [fallbackNew, ...prev]);
      setFormSuccess(
        `Created zero-referrer redirect link /r/${fallbackNew.slug} — origin traffic source is now hidden.`
      );
    }

    setLabelInput('');
    setDestinationInput('');
    setSlugInput('');
  };

  const handleToggleStatus = async (id: string) => {
    setLinks((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, status: l.status === 'active' ? 'paused' : 'active' } : l
      )
    );
    try {
      await fetch(`/api/links/${id}/toggle`, { method: 'POST' });
    } catch {
      // State already updated optimistically
    }
  };

  const handleDeleteLink = async (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    try {
      await fetch(`/api/links/${id}`, { method: 'DELETE' });
    } catch {
      // State already updated optimistically
    }
  };

  const handleSimulateVisit = async (id: string) => {
    const now = new Date().toISOString();
    setLinks((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, hits: l.hits + 1, lastAccessedAt: now } : l
      )
    );
    setPreviewLink((prev) =>
      prev && prev.id === id
        ? { ...prev, hits: prev.hits + 1, lastAccessedAt: now }
        : prev
    );
    try {
      await fetch(`/api/links/${id}/hit`, { method: 'POST' });
    } catch {
      // Local state already incremented
    }
  };

  const handleCopyRedirectUrl = async (link: RedirectLink) => {
    const fullUrl = `${window.location.origin}/r/${link.slug}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
    } catch {
      // Ignore clipboard permission limitations in sandbox
    }
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendToInspector = (link: RedirectLink) => {
    setInspectorTarget({
      url: link.destinationUrl,
      method: link.method,
    });
    const el = document.getElementById('inspector-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const filteredLinks = links.filter((link) => {
    if (statusFilter !== 'all' && link.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      link.label.toLowerCase().includes(q) ||
      link.slug.toLowerCase().includes(q) ||
      link.destinationUrl.toLowerCase().includes(q)
    );
  });

  const totalHits = links.reduce((acc, item) => acc + item.hits, 0);
  const activeCount = links.filter((l) => l.status === 'active').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            ZeroTrace
          </a>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#links-section"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Redirect Links
            </a>
            <a
              href="#inspector-section"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Header Inspector
            </a>
            <a
              href="#codegen-section"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Code Generator
            </a>
            <a
              href="#architecture-section"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                destInputRef.current?.focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Create Protected Link
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-16">
        {/* Hero & Redirector Link Builder Split */}
        <section aria-labelledby="hero-heading" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Column: Value Proposition & Privacy Explanation */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <p className="text-xs font-medium text-slate-500">
                  HTTP Referrer-Policy Manager · Origin Traffic Anonymizer
                </p>
                <h1
                  id="hero-heading"
                  className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 font-display leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  Hide Traffic Origin &amp; Strip HTTP Referer Headers Automatically
                </h1>
                <p className="text-base text-slate-600 leading-relaxed">
                  Jab koi user aapke link par click karta hai, browser default roop se{' '}
                  <code className="font-mono text-xs bg-slate-200/70 px-1.5 py-0.5 rounded text-slate-900">
                    Referer
                  </code>{' '}
                  header bhejta hai jis se samne wali website ko pata chal jata hai ki traffic kahan se aa raha hai. ZeroTrace ek zero-referrer bridge banata hai jo{' '}
                  <code className="font-mono text-xs bg-slate-200/70 px-1.5 py-0.5 rounded text-slate-900">
                    Referrer-Policy: no-referrer
                  </code>{' '}
                  aur tracker scrubbing lagata hai — taaki destination ko sirf{' '}
                  <strong className="text-slate-900">Direct / Unknown Traffic</strong> dikhe.
                </p>
              </div>

              {/* Unboxed KPI Strip */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200">
                <div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {links.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Protected Endpoints
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {totalHits.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Anonymized Redirects
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
                    0%
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Origin Referrer Leaked
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Redirect Link Builder */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              <div className="border-b border-slate-100 pb-4 mb-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Create Zero-Referrer Redirect Link
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Apna destination URL dalein — hum uske liye ek anonymized redirect bridge link taiyar karenge.
                </p>
              </div>

              <form onSubmit={handleCreateLink} className="space-y-4" noValidate>
                <div>
                  <label
                    htmlFor="destination-url-input"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Destination URL (Jahan traffic bhejna hai) *
                  </label>
                  <input
                    ref={destInputRef}
                    id="destination-url-input"
                    type="url"
                    required
                    value={destinationInput}
                    onChange={(e) => {
                      setDestinationInput(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="https://destination-website.com/offer?utm_source=fb&partner=123"
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                  />
                </div>

                {/* Live Parameter Sanitizer Preview */}
                {liveSanitizedPreview && liveSanitizedPreview.strippedParams.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                    <div className="text-slate-700 font-medium">
                      Detected Source Trackers (Auto-Stripped when enabled):{' '}
                      <span className="font-mono text-rose-600">
                        {liveSanitizedPreview.strippedParams.join(' · ')}
                      </span>
                    </div>
                    <div className="font-mono text-slate-600 break-all">
                      Clean URL: <span className="text-emerald-700">{liveSanitizedPreview.cleanUrl}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="link-label-input"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Campaign / Link Name
                    </label>
                    <input
                      id="link-label-input"
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      placeholder="e.g., Main Telegram Traffic Bridge"
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="custom-slug-input"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Custom Bridge Slug (Optional)
                    </label>
                    <div className="flex items-center">
                      <span className="px-3 py-2 text-xs font-mono bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg text-slate-500">
                        /r/
                      </span>
                      <input
                        id="custom-slug-input"
                        type="text"
                        value={slugInput}
                        onChange={(e) => setSlugInput(e.target.value)}
                        placeholder="auto-generated"
                        className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-r-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="redirect-method-select"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Referrer Hiding Mode (Cloaking / Anonymizer Policy)
                    </label>
                    <select
                      id="redirect-method-select"
                      value={methodInput}
                      onChange={(e) => setMethodInput(e.target.value as RedirectMethod)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    >
                      <option value="meta-no-referrer">
                        Zero-Referrer HTML Meta + JS Replace (Recommended)
                      </option>
                      <option value="double-hop-bridge">
                        Double-Hop Neutral Bridge (Maximum Origin Isolation)
                      </option>
                      <option value="http-307-noreferrer">
                        Server HTTP 307 + Referrer-Policy: no-referrer
                      </option>
                      <option value="consent-interstitial">
                        Interactive Click Gate (rel=&quot;noreferrer&quot;)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="redirect-delay-input"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Bridge Delay (Sec)
                    </label>
                    <input
                      id="redirect-delay-input"
                      type="number"
                      min={0}
                      max={10}
                      value={delayInput}
                      onChange={(e) => setDelayInput(Number(e.target.value) || 0)}
                      className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stripParamsInput}
                      onChange={(e) => setStripParamsInput(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    <span>
                      Remove URL Source Trackers (utm_source, fbclid, gclid, ref)
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Generate Zero-Referrer Link
                  </button>
                </div>

                {formError && (
                  <p role="alert" className="text-xs font-medium text-rose-600 pt-1">
                    {formError}
                  </p>
                )}

                {formSuccess && (
                  <p role="status" className="text-xs font-medium text-emerald-700 pt-1">
                    {formSuccess}
                  </p>
                )}
              </form>
            </div>
          </div>
        </section>

        {/* Active Redirect Links Table Workspace */}
        <section id="links-section" aria-labelledby="links-heading" className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">
                Active Endpoints · {activeCount} Active / {links.length} Total
              </p>
              <h2 id="links-heading" className="text-2xl font-bold text-slate-900">
                Configured Zero-Referrer Redirect Links
              </h2>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label="Search redirect links"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by name, slug, or URL..."
                  className="w-64 pl-8 pr-3.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div
                role="group"
                aria-label="Filter links by status"
                className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
              >
                {(['all', 'active', 'paused'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'all' ? 'All Links' : st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                No matching redirect links found
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Create a new protected link above or clear your search filter to view configured zero-referrer bridges.
              </p>
              {searchQuery || statusFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              ) : null}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Campaign &amp; Privacy Policy</th>
                      <th className="py-3 px-4 whitespace-nowrap">Redirect Bridge Endpoint</th>
                      <th className="py-3 px-4">Sanitized Destination</th>
                      <th className="py-3 px-4 text-right">Redirects</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {filteredLinks.map((link) => {
                      const targetUrl = link.stripTrackingParams
                        ? link.sanitizedUrl
                        : link.destinationUrl;
                      return (
                        <tr
                          key={link.id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3.5 px-4 align-middle">
                            <div className="font-semibold text-slate-900">
                              {link.label}
                            </div>
                            {/* Unboxed metadata with typographic separators (Zero-Pill discipline) */}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                              <span
                                className={
                                  link.status === 'active'
                                    ? 'text-emerald-700 font-medium'
                                    : 'text-amber-700 font-medium'
                                }
                              >
                                {link.status === 'active' ? 'Active' : 'Paused'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{METHOD_LABELS[link.method]}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {link.stripTrackingParams
                                  ? 'Trackers Stripped'
                                  : 'Raw Params Preserved'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <code className="text-xs font-mono font-semibold text-indigo-700 whitespace-nowrap shrink-0">
                                /r/{link.slug}
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyRedirectUrl(link)}
                                aria-label={`Copy redirect URL for ${link.label}`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              >
                                {copiedId === link.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Link</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-middle max-w-xs">
                            <div
                              className="text-xs font-mono text-slate-800 truncate"
                              title={targetUrl}
                            >
                              {targetUrl}
                            </div>
                            {link.stripTrackingParams &&
                              link.sanitizedUrl !== link.destinationUrl && (
                                <div className="text-xs text-slate-500 truncate mt-0.5">
                                  Stripped from: {link.destinationUrl}
                                </div>
                              )}
                          </td>

                          <td className="py-3.5 px-4 align-middle text-right font-mono tabular-nums font-semibold text-slate-900">
                            {link.hits.toLocaleString()}
                          </td>

                          <td className="py-3.5 px-4 align-middle text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPreviewLink(link)}
                                aria-label={`Preview bridge for ${link.label}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview Bridge</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSendToInspector(link)}
                                aria-label={`Inspect headers for ${link.label}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleStatus(link.id)}
                                aria-label={`${
                                  link.status === 'active' ? 'Pause' : 'Resume'
                                } ${link.label}`}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              >
                                {link.status === 'active' ? (
                                  <Pause className="w-3.5 h-3.5" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteLink(link.id)}
                                aria-label={`Delete ${link.label}`}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Inbound vs Outbound HTTP Referer Inspector */}
        <div id="inspector-section">
          <HeaderInspectorPanel
            initialDestinationUrl={inspectorTarget.url}
            initialMethod={inspectorTarget.method}
          />
        </div>

        {/* Standalone Code & HTML Generator */}
        <div id="codegen-section">
          <CodeGeneratorPanel defaultDestinationUrl={inspectorTarget.url} />
        </div>

        {/* Technical Architecture & How Referrer Hiding Works */}
        <section
          id="architecture-section"
          aria-labelledby="arch-heading"
          className="space-y-6 border-t border-slate-200 pt-12"
        >
          <div>
            <p className="text-xs text-slate-500 mb-1">
              Technical Mechanism · Origin Privacy Architecture
            </p>
            <h2 id="arch-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
              How ZeroTrace Hides Where Your Traffic Comes From
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
              <div className="text-xs font-mono text-slate-500">01. HTTP Referer Stripping</div>
              <h3 className="text-base font-bold text-slate-900">
                Strict Referrer-Policy Enforcement
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every ZeroTrace bridge endpoint responds with{' '}
                <code className="font-mono text-slate-900">Referrer-Policy: no-referrer</code> and embeds{' '}
                <code className="font-mono text-slate-900">&lt;meta name=&quot;referrer&quot; content=&quot;no-referrer&quot;&gt;</code>. Browsers are W3C-mandated to omit the{' '}
                <code className="font-mono text-slate-900">Referer</code> header completely when navigating outward.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
              <div className="text-xs font-mono text-slate-500">02. DOM History Replacement</div>
              <h3 className="text-base font-bold text-slate-900">
                Zero Back-Button &amp; Window.Opener Leak
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                By dispatching navigation through an ephemeral anchor with{' '}
                <code className="font-mono text-slate-900">rel=&quot;noreferrer noopener&quot;</code> and{' '}
                <code className="font-mono text-slate-900">window.location.replace()</code>, the destination page cannot inspect{' '}
                <code className="font-mono text-slate-900">window.opener</code> or read{' '}
                <code className="font-mono text-slate-900">document.referrer</code>.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
              <div className="text-xs font-mono text-slate-500">03. Query Fingerprint Scrubbing</div>
              <h3 className="text-base font-bold text-slate-900">
                Automatic Ad &amp; Platform Parameter Removal
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Even if the HTTP Referer is blank, parameters like{' '}
                <code className="font-mono text-slate-900">fbclid</code>,{' '}
                <code className="font-mono text-slate-900">gclid</code>, and{' '}
                <code className="font-mono text-slate-900">utm_source</code> reveal the traffic platform. ZeroTrace strips 20+ tracking parameters before forwarding.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            ZeroTrace Redirector &amp; HTTP Referrer-Policy Manager · Standard W3C Referrer-Policy Compliance
          </div>
          <div className="flex items-center gap-4">
            <a href="#links-section" className="hover:text-slate-900">
              Redirect Links
            </a>
            <a href="#inspector-section" className="hover:text-slate-900">
              Header Inspector
            </a>
            <a href="#codegen-section" className="hover:text-slate-900">
              Export HTML Bridge
            </a>
          </div>
        </div>
      </footer>

      <BridgePreviewModal
        link={previewLink}
        onClose={() => setPreviewLink(null)}
        onSimulateVisit={handleSimulateVisit}
      />
    </div>
  );
}
