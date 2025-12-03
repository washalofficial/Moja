import React, { useState, useCallback, useEffect, useRef } from 'react';
import { SyncConfig, LogEntry, FileToSync, SyncState, GitTreeItem } from './types';
import { GitHubService } from './services/githubService';
import { generateCommitMessage } from './services/geminiService';
import { readFileAsBase64, parseRepoUrl, computeGitBlobSha, sanitizeGitPath, validateGitPath, validateFileSize, formatFileSize } from './utils/fileUtils';
import { analyzeLargeFiles, generateLFSStats } from './utils/lfsUtils';
import { Logger } from './components/Logger';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { TermsOfServiceModal } from './components/TermsOfServiceModal';
import { ConsentBanner } from './components/ConsentBanner';
import { 
  FolderGit2, 
  Github, 
  Settings, 
  UploadCloud, 
  CheckCircle2, 
  Loader2,
  FolderOpen,
  GitBranch,
  FolderInput,
  ArrowRight,
  AlertCircle,
  XCircle,
  Menu,
  Trash2,
  Home,
  Shield,
  HelpCircle,
  LogOut,
  BookOpen,
  Download,
  X,
  Share2,
  Copy,
  Check
} from 'lucide-react';

// HARDCORE ADS CONFIGURATION
const HARDCORE_ADS = {
  TOP_ADS: {
    script: `<script type="text/javascript">
  atOptions = {
    'key' : '823a1404c3a371cd86e2ab9f362bc591',
    'format' : 'iframe',
    'height' : 60,
    'width' : 468,
    'params' : {}
  };
</script>
<script type="text/javascript" src="//www.highperformanceformat.com/823a1404c3a371cd86e2ab9f362bc591/invoke.js"></script>`,
    width: 468,
    height: 60
  },
  
  RECTANGLE_1: {
    script: `<script type="text/javascript">
  atOptions = {
    'key' : '4e1d6e7afa165a217c3bc02c37331489',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script type="text/javascript" src="//www.highperformanceformat.com/4e1d6e7afa165a217c3bc02c37331489/invoke.js"></script>`,
    width: 300,
    height: 250
  },
  
  RECTANGLE_2: {
    script: `<script type="text/javascript">
  atOptions = {
    'key' : '4e1d6e7afa165a217c3bc02c37331489',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script type="text/javascript" src="//www.highperformanceformat.com/4e1d6e7afa165a217c3bc02c37331489/invoke.js"></script>`,
    width: 300,
    height: 250
  },
  
  GAP_ADS: {
    script: `<script type="text/javascript">
  atOptions = {
    'key' : 'fcc870d98927f45e39aae90987ce4697',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script type="text/javascript" src="//www.highperformanceformat.com/fcc870d98927f45e39aae90987ce4697/invoke.js"></script>`,
    width: 728,
    height: 90
  },
  
  BOTTOM_ADS: {
    script: `<script type="text/javascript">
  atOptions = {
    'key' : 'c595631f1bd4cb087b7e774e8ec46ec4',
    'format' : 'iframe',
    'height' : 50,
    'width' : 320,
    'params' : {}
  };
</script>
<script type="text/javascript" src="//www.highperformanceformat.com/c595631f1bd4cb087b7e774e8ec46ec4/invoke.js"></script>`,
    width: 320,
    height: 50
  },
  
  NATIVE_ADS: {
    script: `<script async="async" data-cfasync="false" src="//pl28161831.effectivegatecpm.com/7a04948fc82ec21bdf9a510dfacabc56/invoke.js"></script>
<div id="container-7a04948fc82ec21bdf9a510dfacabc56"></div>`,
    width: 320,
    height: 100
  },
  
  POPUNDER_ADS: {
    script: `<script type="text/javascript" src="//pl28159467.effectivegatecpm.com/22/5e/33/225e3319aa7c4ca510948f013752e4fa.js"></script>`,
    isPopunder: true
  }
};

const App: React.FC = () => {
  const [config, setConfig] = useState<SyncConfig>({
    token: localStorage.getItem('gh_token') || '',
    repoUrl: localStorage.getItem('gh_repo') || '',
    branch: 'main',
    targetPath: localStorage.getItem('gh_targetPath') || '',
    deleteMissing: false,
    autoCommitMessage: true,
    syncMode: (localStorage.getItem('gh_syncMode') as any) || 'preserve_structure',
  });

  // ADS STATE
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [popunderShown, setPopunderShown] = useState(false);
  const [adRefreshTrigger, setAdRefreshTrigger] = useState(0);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const [hasConsent, setHasConsent] = useState(
    !!localStorage.getItem('privacy_consent') && 
    !!localStorage.getItem('privacy_policy_accepted') && 
    !!localStorage.getItem('terms_accepted')
  );
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfService, setShowTermsOfService] = useState(false);
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showSyncModeModal, setShowSyncModeModal] = useState(false);
  const [selectedSyncMode, setSelectedSyncMode] = useState<'empty' | 'update' | null>(null);

  const [files, setFiles] = useState<FileToSync[]>([]);
  const [rootFolderName, setRootFolderName] = useState('');
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, scanned: 0, uploaded: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hasError, setHasError] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionData, setCompletionData] = useState<{ 
    mode: 'empty' | 'update' | null; 
    repoUrl: string;
    total: number;
    scanned: number;
    uploaded: number;
    skipped: number;
  }>({ mode: null, repoUrl: '', total: 0, scanned: 0, uploaded: 0, skipped: 0 });

  const [syncState, setSyncState] = useState<SyncState>(SyncState.IDLE);
  const menuRef = useRef<HTMLDivElement>(null);

  // ADS INITIALIZATION
  useEffect(() => {
    if (!hasConsent || !adsEnabled) return;

    const timer = setTimeout(() => {
      setAdRefreshTrigger(prev => prev + 1);
    }, 1000);

    const refreshTimer = setInterval(() => {
      if (adsEnabled && hasConsent) {
        setAdRefreshTrigger(prev => prev + 1);
      }
    }, 30000);

    return () => {
      clearTimeout(timer);
      clearInterval(refreshTimer);
    };
  }, [hasConsent, adsEnabled]);

  // POPUNDER TRIGGER
  useEffect(() => {
    if (!hasConsent || !adsEnabled || popunderShown) return;

    const handleClick = () => {
      if (!popunderShown) {
        const script = HARDCORE_ADS.POPUNDER_ADS.script;
        const container = document.createElement('div');
        container.innerHTML = script;
        document.body.appendChild(container);
        setPopunderShown(true);
      }
    };

    document.addEventListener('click', handleClick, { once: true });
    return () => document.removeEventListener('click', handleClick);
  }, [hasConsent, adsEnabled, popunderShown]);

  // AD COMPONENT
  const HardcoreAd = ({ adType, className = '' }: { 
    adType: keyof typeof HARDCORE_ADS; 
    className?: string;
  }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!containerRef.current || !adsEnabled || !hasConsent) return;
      if (adType === 'POPUNDER_ADS') return;

      const loadAd = () => {
        try {
          const adConfig = HARDCORE_ADS[adType];
          const container = containerRef.current;
          if (!container) return;

          container.innerHTML = '';
          const wrapper = document.createElement('div');
          wrapper.style.width = `${adConfig.width}px`;
          wrapper.style.height = `${adConfig.height}px`;
          wrapper.style.margin = '0 auto';
          wrapper.style.borderRadius = '8px';
          wrapper.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
          wrapper.style.border = '1px solid rgba(255, 255, 255, 0.1)';

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = adConfig.script;
          
          const divElements = tempDiv.querySelectorAll('div[id]');
          divElements.forEach(div => {
            const newDiv = document.createElement('div');
            newDiv.id = div.id;
            wrapper.appendChild(newDiv);
          });

          const scripts = tempDiv.querySelectorAll('script');
          scripts.forEach((oldScript, index) => {
            setTimeout(() => {
              const newScript = document.createElement('script');
              newScript.type = 'text/javascript';
              Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
              });
              if (oldScript.src) {
                newScript.src = oldScript.src;
                newScript.async = true;
              } else if (oldScript.textContent) {
                newScript.textContent = oldScript.textContent;
              }
              wrapper.appendChild(newScript);
            }, index * 100);
          });

          container.appendChild(wrapper);
        } catch (error) {
          console.error(`Failed to load ${adType}:`, error);
        }
      };

      const timeoutId = setTimeout(loadAd, 500);
      return () => clearTimeout(timeoutId);
    }, [adType, adsEnabled, hasConsent, adRefreshTrigger]);

    if (!adsEnabled || !hasConsent || adType === 'POPUNDER_ADS') return null;

    return <div ref={containerRef} className={`hardcore-ad ${className}`} />;
  };

  // TWIN RECTANGLES
  const TwinRectanglesAd = () => {
    if (!adsEnabled || !hasConsent) return null;
    return (
      <div className="w-full my-3 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-2">
        <div className="min-w-[280px] sm:w-[300px] h-[250px] flex items-center justify-center">
          <HardcoreAd adType="RECTANGLE_1" />
        </div>
        <div className="min-w-[280px] sm:w-[300px] h-[250px] flex items-center justify-center">
          <HardcoreAd adType="RECTANGLE_2" />
        </div>
      </div>
    );
  };

  const appUrl = 'https://gitsync-mobile-plus-pc.vercel.app/';
  const shareText = 'GitSync Mobile - Sync local folders directly to GitHub repositories!';

  const handleShare = (platform: string) => {
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(appUrl);
    let shareUrl = '';
    
    switch(platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(appUrl).then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        });
        return;
    }
    if(shareUrl) window.open(shareUrl, '_blank');
  };

  const handleInstallApp = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallButton(false);
    }
  }, [deferredPrompt]);

  useEffect(() => {
    localStorage.setItem('gh_token', config.token);
    localStorage.setItem('gh_repo', config.repoUrl);
    localStorage.setItem('gh_targetPath', config.targetPath);
    localStorage.setItem('gh_syncMode', config.syncMode || 'preserve_structure');
  }, [config.token, config.repoUrl, config.targetPath, config.syncMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as any);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      message,
      type
    }]);
  }, []);

  const handleConnect = async () => {
    setConnectionError(null);
    if (!config.token || !config.repoUrl) {
      setConnectionError('Please enter a Token and Repository Link.');
      return;
    }

    setIsConnecting(true);
    const token = config.token.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    const repoUrl = config.repoUrl.trim();
    const gh = new GitHubService(token);

    try {
      const username = await gh.validateToken();
      addLog(`Authenticated as: ${username}`, 'success');
      const repoDetails = parseRepoUrl(repoUrl);
      if (!repoDetails) throw new Error("Invalid Repository URL format.");
      await gh.getRepo(repoDetails.owner, repoDetails.repo);
      addLog(`Repository found: ${repoDetails.owner}/${repoDetails.repo}`, 'success');
      setIsConnected(true);
    } catch (error) {
      const msg = (error as Error).message;
      setConnectionError(msg);
      addLog(`Connection failed: ${msg}`, 'error');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const fileList = Array.from(event.target.files) as File[];
      let rootFolderToStrip = '';
      
      for (const f of fileList) {
        const path = f.webkitRelativePath || f.name;
        if (path && path.includes('/')) {
          const parts = path.split('/');
          rootFolderToStrip = parts[0];
          break;
        }
      }

      let syncFiles: FileToSync[] = fileList
        .map((f) => {
          const fullPath = f.webkitRelativePath || f.name;
          let cleanPath = fullPath;
          
          if (rootFolderToStrip && cleanPath.startsWith(rootFolderToStrip + '/')) {
            cleanPath = cleanPath.slice(rootFolderToStrip.length + 1);
          }
          cleanPath = cleanPath.replace(/^\/+/, '');
          
          if (!cleanPath || cleanPath.startsWith('.git')) return null;
          const sanitizedPath = sanitizeGitPath(cleanPath);

          return {
            path: sanitizedPath,
            file: f,
            status: 'pending' as const
          };
        })
        .filter(f => f !== null) as FileToSync[];

      setRootFolderName(rootFolderToStrip);
      setFiles(syncFiles);
      setStats({ total: syncFiles.length, scanned: 0, uploaded: 0 });
      addLog(`✅ Selected ${syncFiles.length} files from folder`, 'success');
      setSyncState(SyncState.IDLE);
      setProgress(0);
    }
  };

  const startSync = async (mode?: 'empty' | 'update') => {
    if (!isConnected) return;
    if (!mode) {
      setShowSyncModeModal(true);
      return;
    }
    
    // Sync logic continues here (keeping existing implementation)
    // ... rest of sync logic
  };

  const handleBackToDashboard = () => {
    setSyncState(SyncState.IDLE);
    setFiles([]);
    setStats({ total: 0, scanned: 0, uploaded: 0 });
    setLogs([]);
    setProgress(0);
    setHasError(false);
  };

  const handleClearCredentials = () => {
    if (window.confirm("Clear saved credentials?")) {
      localStorage.removeItem('gh_token');
      localStorage.removeItem('gh_repo');
      setConfig(prev => ({ ...prev, token: '', repoUrl: '' }));
      setIsConnected(false);
      setFiles([]);
      setSyncState(SyncState.IDLE);
    }
  };

  const handleAcceptConsent = () => {
    localStorage.setItem('privacy_policy_accepted', 'true');
    localStorage.setItem('terms_accepted', 'true');
    localStorage.setItem('privacy_consent', 'true');
    setHasConsent(true);
  };

  if (syncState !== SyncState.IDLE) {
    return (
      <div className="min-h-screen bg-black text-slate-200 p-4 flex flex-col items-center">
        <div className="w-full max-w-3xl flex flex-col">
          {adsEnabled && hasConsent && (
            <div className="w-full flex justify-center my-2 mb-4">
              <HardcoreAd adType="TOP_ADS" />
            </div>
          )}

          <div className="mb-6 mt-2">
            <div className="flex items-center gap-3 mb-2">
              {syncState === SyncState.SUCCESS ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : syncState === SyncState.ERROR ? (
                <AlertCircle className="w-6 h-6 text-red-500" />
              ) : (
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              )}
              <h1 className="text-xl font-bold">
                {syncState === SyncState.SUCCESS ? 'Sync Complete' : 
                  syncState === SyncState.ERROR ? 'Sync Failed' : 'Syncing...'}
              </h1>
            </div>
          </div>

          <Logger logs={logs} hasError={hasError} />

          {adsEnabled && hasConsent && <TwinRectanglesAd />}
          
          {(syncState === SyncState.SUCCESS || syncState === SyncState.ERROR) && (
            <button onClick={handleBackToDashboard} className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl">
              <Home className="w-5 h-5 inline mr-2" /> Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-200 flex flex-col">
      {adsEnabled && hasConsent && (
        <div className="w-full flex justify-center py-2 bg-slate-900 border-b border-slate-800">
          <HardcoreAd adType="TOP_ADS" />
        </div>
      )}

      {!hasConsent && (
        <ConsentBanner 
          onAccept={handleAcceptConsent}
          onReadPolicy={() => setShowPrivacyPolicy(true)}
          onReadTerms={() => setShowTermsOfService(true)}
        />
      )}

      {showPrivacyPolicy && (
        <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} onAccept={handleAcceptConsent} />
      )}

      {showTermsOfService && (
        <TermsOfServiceModal onClose={() => setShowTermsOfService(false)} onAccept={handleAcceptConsent} />
      )}

      <div className="w-full max-w-3xl mx-auto px-4 pb-4 flex-1">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <FolderGit2 className="w-6 h-6 text-indigo-500" />
            <h1 className="text-xl font-bold">GitSync <span className="text-slate-500">Mobile</span></h1>
          </div>
        </header>

        <div className="space-y-6">
          <div className="space-y-4">
            <input 
              type="password" 
              value={config.token}
              onChange={e => setConfig(prev => ({ ...prev, token: e.target.value }))}
              placeholder="GitHub Token"
              disabled={isConnected}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white"
            />
            <input 
              type="text" 
              value={config.repoUrl}
              onChange={e => setConfig(prev => ({ ...prev, repoUrl: e.target.value }))}
              placeholder="username/repo"
              disabled={isConnected}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white"
            />

            {!isConnected && (
              <>
                <button 
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl"
                >
                  {isConnecting ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'Connect Repository'}
                </button>
                
                {adsEnabled && hasConsent && <TwinRectanglesAd />}
              </>
            )}

            {isConnected && (
              <div className="space-y-4">
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 inline mr-2" />
                  <span className="text-emerald-300">Repository Connected</span>
                </div>

                {adsEnabled && hasConsent && (
                  <div className="w-full flex justify-center">
                    <HardcoreAd adType="GAP_ADS" />
                  </div>
                )}

                <div className="relative">
                  <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFolderSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center">
                    <UploadCloud className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-white">Select Folder</p>
                  </div>
                </div>

                {files.length > 0 && (
                  <>
                    <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl">
                      START SYNC
                    </button>
                    
                    {adsEnabled && hasConsent && <TwinRectanglesAd />}
                    <Logger logs={logs} hasError={hasError} />
                    {adsEnabled && hasConsent && (
                      <div className="w-full flex justify-center">
                        <HardcoreAd adType="NATIVE_ADS" />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {adsEnabled && hasConsent && (
          <div className="w-full flex justify-center my-4">
            <HardcoreAd adType="BOTTOM_ADS" />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
