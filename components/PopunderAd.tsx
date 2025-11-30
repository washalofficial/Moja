import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { AdIframe } from './AdIframe';

interface PopunderAdProps {
  isOpen: boolean;
  onClose: () => void;
  placementAds: Record<string, any>;
  onConfirmExit: () => void;
}

export const PopunderAd: React.FC<PopunderAdProps> = ({ isOpen, onClose, placementAds, onConfirmExit }) => {
  if (!isOpen) return null;

  const config = placementAds['popunder'];
  const hasRawScript = config?.adsterra?.rawScript;
  const hasZoneId = config?.adsterra?.zoneId;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 sticky top-0 bg-slate-900">
          <h2 className="text-lg font-bold text-white">Special Offer</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Ad Content */}
        <div className="p-6 flex flex-col items-center gap-6">
          {hasRawScript ? (
            <div className="w-full flex justify-center">
              <AdIframe html={config.adsterra.rawScript} placementId="popunder" width={300} height={250} />
            </div>
          ) : hasZoneId ? (
            <div className="w-full flex justify-center">
              <iframe
                src={`https://a.adsterra.com/ban/rt?domains=a.adsterra.com&key=${config.adsterra.zoneId}&size=300x250&adaptive=no`}
                width="300"
                height="250"
                style={{ border: 'none' }}
              />
            </div>
          ) : (
            <div className="w-full h-64 bg-slate-800 rounded border border-slate-700 flex items-center justify-center">
              <p className="text-slate-400 text-sm">No ad configured</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
            >
              Close
            </button>
            <button
              onClick={onConfirmExit}
              className="flex-1 px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
