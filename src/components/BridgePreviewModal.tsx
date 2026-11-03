import React from 'react';
import {
  RedirectLink,
  generateZeroReferrerHtml,
} from '../utils/redirectorLogic';
import { X, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface BridgePreviewModalProps {
  link: RedirectLink | null;
  onClose: () => void;
  onSimulateVisit: (linkId: string) => void;
}

export const BridgePreviewModal: React.FC<BridgePreviewModalProps> = ({
  link,
  onClose,
  onSimulateVisit,
}) => {
  if (!link) return null;

  const finalTarget = link.stripTrackingParams ? link.sanitizedUrl : link.destinationUrl;
  const generatedHtml = generateZeroReferrerHtml({
    destinationUrl: finalTarget,
    method: link.method,
    delaySeconds: link.delaySeconds,
    title: link.label,
  });

  const bridgeUrl = `${window.location.origin}/r/${link.slug}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bridge-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 shadow-xl space-y-5 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs text-slate-500">
              Zero-Referrer Bridge Verification · /r/{link.slug}
            </p>
            <h3 id="bridge-preview-title" className="text-lg font-bold text-slate-900 mt-0.5">
              {link.label}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
            <div className="text-slate-500">Public Redirector Bridge Link</div>
            <div className="font-mono font-semibold text-indigo-700 break-all">
              {bridgeUrl}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
            <div className="text-slate-500">Sanitized Outbound Target</div>
            <div className="font-mono font-semibold text-slate-900 break-all">
              {finalTarget}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Active Privacy Guarantees on This Endpoint</span>
          </div>
          <ul className="space-y-1 text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                HTTP Response Header: <code className="font-mono text-slate-900">Referrer-Policy: no-referrer</code>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                HTML Document Meta: <code className="font-mono text-slate-900">&lt;meta name=&quot;referrer&quot; content=&quot;no-referrer&quot;&gt;</code>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                Destination receives <code className="font-mono text-slate-900">Referer: [Blank / Direct]</code> — original traffic source cannot be detected.
              </span>
            </li>
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2">
            Rendered Zero-Referrer Bridge HTML Payload:
          </div>
          <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-56">
            <code>{generatedHtml}</code>
          </pre>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => onSimulateVisit(link.id)}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Simulate Anonymized Visit (+1 Hit)
          </button>

          <div className="flex items-center gap-3">
            <a
              href={`/r/${link.slug}`}
              target="_blank"
              rel="noreferrer noopener"
              referrerPolicy="no-referrer"
              onClick={() => onSimulateVisit(link.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <span>Open Live /r/{link.slug} Bridge</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
