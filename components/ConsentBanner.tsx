import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface ConsentBannerProps {
  onAccept: () => void;
  onReadPolicy: () => void;
}

export const ConsentBanner: React.FC<ConsentBannerProps> = ({ onAccept, onReadPolicy }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-t border-indigo-500/20 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] p-4 animate-in slide-in-from-bottom duration-500">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-full shrink-0">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="text-sm text-slate-300">
            <p className="font-bold text-white mb-1">We value your privacy</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              We use cookies and local storage to securely sync your files and improve your experience. 
              By continuing, you agree to our <button onClick={onReadPolicy} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Privacy Policy</button> and Terms of Service.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={onReadPolicy}
            className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap"
          >
            Read Policy
          </button>
          <button 
            onClick={onAccept}
            className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 whitespace-nowrap"
          >
            Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
