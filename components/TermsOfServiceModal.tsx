import React, { useState } from 'react';
import { XCircle, FileText, CheckCircle2 } from 'lucide-react';

interface TermsOfServiceModalProps {
  onClose: () => void;
  onAccept?: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ onClose, onAccept }) => {
  const [isAccepted, setIsAccepted] = useState(false);

  const handleAccept = () => {
    setIsAccepted(true);
    localStorage.setItem('terms_accepted', 'true');
    if (onAccept) {
      onAccept();
    }
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl relative">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-400" />
            <h3 className="text-xl font-bold text-white">Terms of Service</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-1"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 text-sm text-slate-300 leading-relaxed space-y-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Last Updated: {new Date().toLocaleDateString()}</p>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">1. Acceptance of Terms</h4>
            <p>By accessing and using GitSync Mobile, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.</p>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">2. Use License</h4>
            <p>Permission is granted to temporarily download one copy of the materials (information or software) on GitSync Mobile for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose or for any public display</li>
              <li>Attempt to decompile or reverse engineer any software contained on the app</li>
              <li>Remove any copyright or other proprietary notations from the materials</li>
              <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
              <li>Use automated tools or bots to access the service</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">3. Disclaimer</h4>
            <p>The materials on GitSync Mobile are provided on an 'as is' basis. GitSync Mobile makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">4. Limitations</h4>
            <p>In no event shall GitSync Mobile or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on GitSync Mobile, even if GitSync Mobile or an authorized representative has been notified orally or in writing of the possibility of such damage.</p>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">5. Accuracy of Materials</h4>
            <p>The materials appearing on GitSync Mobile could include technical, typographical, or photographic errors. GitSync Mobile does not warrant that any of the materials on its application are accurate, complete, or current. GitSync Mobile may make changes to the materials contained on its application at any time without notice.</p>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">6. Materials & Content Ownership</h4>
            <p>The materials on GitSync Mobile are owned or controlled by GitSync Mobile or the party credited as the provider of the materials. You retain all rights to any content you submit, post or display on or through GitSync Mobile. By submitting content to GitSync Mobile, you grant us a worldwide, non-exclusive, royalty-free license to use, copy, reproduce, process, adapt, modify, publish, transmit, display and distribute such content in any media or medium and for any purposes.</p>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">7. Limitations on Liability</h4>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <p><strong className="text-amber-400">GitHub Integration:</strong> You are responsible for maintaining the confidentiality of your GitHub Personal Access Token. GitSync Mobile is not liable for any unauthorized use of your token.</p>
              <p><strong className="text-amber-400">File Sync:</strong> GitSync Mobile is provided "as-is". We are not responsible for data loss, corruption, or unintended modifications during sync operations.</p>
              <p><strong className="text-amber-400">Third-Party Services:</strong> GitSync Mobile integrates with GitHub and may use third-party services (Google Gemini, etc.). We are not liable for their actions or unavailability.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">8. Acceptable Use Policy</h4>
            <p>You agree not to use GitSync Mobile:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>To upload malicious code or harmful content</li>
              <li>To bypass security measures or attack the service</li>
              <li>To spam or abuse the sync functionality</li>
              <li>To infringe on others' intellectual property rights</li>
              <li>To engage in illegal activities</li>
              <li>To create excessive load on servers through automation</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">9. User Accounts & Credentials</h4>
            <p>All GitHub tokens and credentials are stored locally on your device. You are solely responsible for:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Keeping your GitHub token secure and confidential</li>
              <li>Not sharing your token with unauthorized parties</li>
              <li>All activities that occur under your GitHub account</li>
              <li>Clearing credentials when using shared devices</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">10. Termination</h4>
            <p>GitSync Mobile may terminate or suspend your access to the service immediately, without prior notice or liability, for any reason whatsoever, including if you breach the Terms.</p>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">11. Governing Law</h4>
            <p>These terms and conditions are governed by and construed in accordance with applicable laws, and you irrevocably submit to the exclusive jurisdiction of the courts located in that location.</p>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">12. Contact Information</h4>
            <p>If you have any questions about these Terms of Service, please contact us at:</p>
            <p className="text-blue-400">support@gitsyncmobile.com</p>
          </section>

          <div className="pt-6 border-t border-slate-800 text-xs text-slate-500">
            <p>GitSync Mobile - All Rights Reserved.</p>
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur rounded-b-2xl space-y-3">
          <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <input 
              type="checkbox" 
              id="accept-terms"
              checked={isAccepted}
              onChange={(e) => setIsAccepted(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-blue-500 bg-slate-800 cursor-pointer accent-blue-600"
            />
            <label htmlFor="accept-terms" className="text-sm text-slate-300 cursor-pointer flex-1">
              I agree to the Terms of Service
            </label>
            {isAccepted && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Close
            </button>
            <button 
              onClick={handleAccept}
              disabled={!isAccepted}
              className={`flex-1 px-4 py-2.5 text-sm font-bold rounded-xl transition-all ${
                isAccepted 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95' 
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              Accept & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
