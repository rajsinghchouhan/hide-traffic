import React, { useState } from 'react';
import {
  RedirectMethod,
  generateServerSnippet,
  validateDestinationUrl,
} from '../utils/redirectorLogic';
import { Copy, Check, Download, Code2 } from 'lucide-react';

interface CodeGeneratorPanelProps {
  defaultDestinationUrl?: string;
}

export const CodeGeneratorPanel: React.FC<CodeGeneratorPanelProps> = ({
  defaultDestinationUrl = 'https://example.com/offer-page',
}) => {
  const [destinationUrl, setDestinationUrl] = useState(defaultDestinationUrl);
  const [platform, setPlatform] = useState<'html' | 'cloudflare' | 'nginx' | 'express'>('html');
  const [method, setMethod] = useState<RedirectMethod>('meta-no-referrer');
  const [copied, setCopied] = useState(false);

  const snippet = generateServerSnippet(platform, destinationUrl, method);
  const validation = validateDestinationUrl(destinationUrl);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadHtml = () => {
    const htmlContent = generateServerSnippet('html', destinationUrl, method);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'redirect-noreferrer.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="codegen-heading" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs text-slate-500 mb-1">
            Self-Hosted Deployment · Zero-Referrer Bridge Code
          </p>
          <h2 id="codegen-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
            Standalone Redirector Code &amp; HTML Generator
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .HTML Bridge</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Code'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2">
            <label
              htmlFor="codegen-target-url"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Destination URL for Exported Bridge
            </label>
            <input
              id="codegen-target-url"
              type="url"
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="https://example.com/landing"
              className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
            />
            {!validation.valid && (
              <p className="text-xs text-rose-600 mt-1">{validation.error}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="codegen-method-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              HTML Bridge Behavior
            </label>
            <select
              id="codegen-method-select"
              value={method}
              onChange={(e) => setMethod(e.target.value as RedirectMethod)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="meta-no-referrer">Instant Zero-Referrer Bridge</option>
              <option value="consent-interstitial">Click-Through Interstitial Gate</option>
              <option value="double-hop-bridge">Double-Hop Meta Refresh</option>
            </select>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <div
            role="tablist"
            aria-label="Deployment Target Platform"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(
              [
                { id: 'html', label: 'Standalone HTML File' },
                { id: 'cloudflare', label: 'Cloudflare Worker' },
                { id: 'nginx', label: 'Nginx Config' },
                { id: 'express', label: 'Node.js / Express' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={platform === tab.id}
                onClick={() => setPlatform(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  platform === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Referrer-Policy: no-referrer · rel=&quot;noreferrer&quot;
          </span>
        </div>

        {/* Code Output Box */}
        <div className="bg-slate-900 text-slate-100 rounded-xl p-5 overflow-x-auto">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-3 mb-3 border-b border-slate-800 font-mono">
            <span className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {platform === 'html'
                  ? 'redirect-noreferrer.html'
                  : platform === 'cloudflare'
                  ? 'worker.js'
                  : platform === 'nginx'
                  ? 'nginx-referrer-strip.conf'
                  : 'server-redirect.js'}
              </span>
            </span>
            <span>UTF-8 · Zero-Referrer Verified</span>
          </div>
          <pre className="text-xs font-mono leading-relaxed text-slate-200 overflow-x-auto">
            <code>{snippet}</code>
          </pre>
        </div>
      </div>
    </section>
  );
};
