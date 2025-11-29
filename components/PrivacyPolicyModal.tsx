import React from 'react';
import { XCircle, Shield } from 'lucide-react';

interface PrivacyPolicyModalProps {
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl relative">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-400" />
            <h3 className="text-xl font-bold text-white">Privacy Policy</h3>
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
            <h4 className="text-lg font-bold text-white">1. Information We Collect</h4>
            
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <p><strong className="text-indigo-400">Personal Information:</strong> GitHub Personal Access Tokens (stored locally), Repository URLs, and file metadata.</p>
              <p><strong className="text-indigo-400">Usage Data:</strong> Sync operation logs, error reports, and performance metrics.</p>
              <p><strong className="text-indigo-400">Technical Data:</strong> IP addresses, device information (User Agent), and timestamps.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">2. How We Use Your Information</h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><strong className="text-slate-200">Provide Services:</strong> To sync files directly from your device to your GitHub repositories.</li>
              <li><strong className="text-slate-200">Improve Functionality:</strong> Analyze anonymous usage patterns to enhance features.</li>
              <li><strong className="text-slate-200">Troubleshooting:</strong> Identify and fix technical issues based on error logs.</li>
              <li><strong className="text-slate-200">Security:</strong> Monitor for unauthorized access or abuse of the service.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">3. Data Sharing and Disclosure</h4>
            <div className="space-y-2">
              <p>We transmit data to the following third parties as required for the service to function:</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li><strong className="text-slate-200">GitHub:</strong> Your files and repository data are transmitted directly to GitHub's API.</li>
                <li><strong className="text-slate-200">Analytics:</strong> We may use tools to collect anonymous usage statistics.</li>
                <li><strong className="text-slate-200">Legal:</strong> We may disclose information if required by law.</li>
              </ul>
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg mt-2">
                <p className="text-red-200 font-medium">We do NOT sell your personal data or share your GitHub tokens with advertisers.</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">4. Data Security & Retention</h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Your GitHub Tokens are stored locally on your device via <code>localStorage</code>.</li>
              <li>All data transmission occurs over secure HTTPS channels.</li>
              <li>We retain sync logs for a maximum of 30 days for troubleshooting purposes.</li>
              <li>You can clear your stored credentials at any time using the "Clear Credentials" option in the menu.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">5. User Consent & Rights (GDPR/CCPA)</h4>
            <p>By using this tool, you consent to the processing of your data as described. You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Request access to your data.</li>
              <li>Request deletion of your data (Clear Credentials).</li>
              <li>Opt-out of non-essential tracking.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h4 className="text-lg font-bold text-white">6. Contact Information</h4>
            <p>For privacy concerns, please contact the administrator via the support channels provided in the application or at:</p>
            <p className="text-indigo-400">privacy@gitsyncmobile.com</p>
          </section>

           <div className="pt-6 border-t border-slate-800 text-xs text-slate-500">
            <p>GitSync Mobile - All Rights Reserved.</p>
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur rounded-b-2xl">
          <button 
            onClick={onClose}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
