import React, { useState, useCallback, useEffect, useRef } from 'react';
import { SyncConfig, LogEntry, FileToSync, SyncState, GitTreeItem } from './types';
import { GitHubService } from './services/githubService';
import { generateCommitMessage } from './services/geminiService';
import { readFileAsBase64, parseRepoUrl, computeGitBlobSha, sanitizeGitPath } from './utils/fileUtils';
import { Logger } from './components/Logger';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
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
  UserCog,
  Shield,
  HelpCircle,
  LogOut,
  BookOpen,
  Lock,
  Save,
  LayoutDashboard,
  BarChart3,
  Globe,
  Layers,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Activity
} from 'lucide-react';

interface AdsConfig {
  adsterra: {
    enabled: boolean;
    bannerZoneId: string;
    rectangleZoneId: string;
  };
  adsense: {
    enabled: boolean;
    clientId: string;
    bannerSlotId: string;
    rectangleSlotId: string;
  };
  placements: {
    topBanner: boolean;
    twinRectangles: boolean;
    gapAds: boolean;
    nativeBanner: boolean;
    bottomBanner: boolean;
  };
}

const DEFAULT_ADS_CONFIG: AdsConfig = {
  adsterra: {
    enabled: true,
    bannerZoneId: '',
    rectangleZoneId: ''
  },
  adsense: {
    enabled: true,
    clientId: '',
    bannerSlotId: '',
    rectangleSlotId: ''
  },
  placements: {
    topBanner: true,
    twinRectangles: true,
    gapAds: true,
    nativeBanner: true,
    bottomBanner: true
  }
};

const App: React.FC = () => {
  const [config, setConfig] = useState<SyncConfig>({
    token: localStorage.getItem('gh_token') || '',
    repoUrl: localStorage.getItem('gh_repo') || '',
    branch: 'main',
    targetPath: '',
    deleteMissing: false,
    autoCommitMessage: true,
  });

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [activeAdminTab, setActiveAdminTab] = useState<'overview' | 'networks' | 'placements'>('overview');
  
  const [adsConfig, setAdsConfig] = useState<AdsConfig>(() => {
    const saved = localStorage.getItem('admin_ads_config');
    return saved ? JSON.parse(saved) : DEFAULT_ADS_CONFIG;
  });

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  const [hasConsent, setHasConsent] = useState(!!localStorage.getItem('privacy_consent'));
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const [files, setFiles] = useState<FileToSync[]>([]);
  const [syncState, setSyncState] = useState<SyncState>(SyncState.IDLE);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, scanned: 0, uploaded: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('gh_token', config.token);
    localStorage.setItem('gh_repo', config.repoUrl);
  }, [config.token, config.repoUrl]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      let userFriendlyMsg = msg;
      
      if (msg === 'Not Found' || msg.includes('404')) {
        userFriendlyMsg = "Repository not found. Please check the URL, or ensure your Token has 'repo' permissions (private repos require this).";
      } else if (msg.includes('Bad credentials') || msg.includes('401')) {
        userFriendlyMsg = "Invalid Token. Please check your Personal Access Token.";
      }

      setConnectionError(userFriendlyMsg);
      addLog(`Connection failed: ${msg}`, 'error');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const fileList = Array.from(event.target.files) as File[];
      
      const rootFolderName = fileList[0].webkitRelativePath.split('/')[0] || 'Selected Folder';

      const syncFiles: FileToSync[] = fileList.map(f => {
        const fullPath = f.webkitRelativePath || f.name;
        const parts = fullPath.split('/');
        const relativePath = parts.length > 1 ? parts.slice(1).join('/') : fullPath;
        const sanitizedPath = sanitizeGitPath(relativePath);

        return {
          path: sanitizedPath,
          file: f,
          status: 'pending' as const
        };
      }).filter(f => f.path.length > 0);

      setFiles(syncFiles);
      setStats({ total: syncFiles.length, scanned: 0, uploaded: 0 });
      addLog(`Selected ${syncFiles.length} files from '${rootFolderName}'. Syncing folder contents...`, 'info');
      
      setSyncState(SyncState.IDLE);
      setProgress(0);
    }
  };

  const startSync = async () => {
    if (!isConnected) return;
    
    const repoDetails = parseRepoUrl(config.repoUrl);
    if (!repoDetails) return;

    if (files.length === 0 && !config.deleteMissing) {
      addLog('No files selected.', 'warning');
      return;
    }

    setSyncState(SyncState.SCANNING);
    setProgress(0);
    setStats({ total: files.length, scanned: 0, uploaded: 0 });
    const gh = new GitHubService(config.token.replace(/[\s\u200B-\u200D\uFEFF]/g, ''));

    try {
      const defaultBranch = config.branch.trim() || 'main';
      addLog(`Targeting branch: ${defaultBranch}`, 'info');

      let latestCommitSha: string | null = null;
      let baseTreeData: { tree: GitTreeItem[], truncated: boolean } = { tree: [], truncated: false };

      try {
        const ref = await gh.getRef(repoDetails.owner, repoDetails.repo, defaultBranch);
        latestCommitSha = ref.object.sha;
        baseTreeData = await gh.getTreeRecursive(repoDetails.owner, repoDetails.repo, latestCommitSha);
      } catch (e) {
        addLog(`Branch '${defaultBranch}' not found (or repo empty). Initializing fresh upload.`, 'info');
      }
      
      if (baseTreeData.truncated && config.deleteMissing) {
        addLog('Repo too large. "Delete missing" disabled safely.', 'warning');
      }

      setSyncState(SyncState.ANALYZING);

      const targetPrefix = config.targetPath ? sanitizeGitPath(config.targetPath) + '/' : '';
      
      addLog('Analyzing file signatures...', 'info');
      
      const remoteFileMap = new Map<string, string>();
      baseTreeData.tree.forEach(item => {
        if (item.type === 'blob') remoteFileMap.set(item.path, item.sha);
      });

      const filesToUpload: { file: FileToSync, remotePath: string, isNew: boolean }[] = [];
      const filesSkipped: string[] = [];
      const filesToDelete: string[] = [];
      const processedRemotePaths = new Set<string>();

      let analysisCount = 0;
      for (const f of files) {
        const remotePath = sanitizeGitPath(targetPrefix + f.path);
        const remoteSha = remoteFileMap.get(remotePath);
        
        analysisCount++;
        setStats(prev => ({ ...prev, scanned: analysisCount }));
        
        if (files.length > 50 && analysisCount % 10 === 0) {
          setProgress(Math.round((analysisCount / files.length) * 20)); 
        }

        if (remoteSha) {
          processedRemotePaths.add(remotePath);
          try {
            const localSha = await computeGitBlobSha(f.file);
            if (localSha === remoteSha) {
              filesSkipped.push(remotePath);
              continue;
            }
          } catch (e) {
            console.warn("Could not compute SHA, defaulting to upload", e);
          }
          filesToUpload.push({ file: f, remotePath, isNew: false });
        } else {
          filesToUpload.push({ file: f, remotePath, isNew: true });
        }
      }

      if (config.deleteMissing && !baseTreeData.truncated) {
        baseTreeData.tree.forEach(item => {
          if (item.type === 'blob') {
            if (targetPrefix && !item.path.startsWith(targetPrefix)) return;
            if (!processedRemotePaths.has(item.path)) {
              filesToDelete.push(item.path);
            }
          }
        });
      }

      addLog(`Analysis Complete: ${filesToUpload.length} to upload, ${filesToDelete.length} to delete.`, 'info');

      if (filesToUpload.length === 0 && filesToDelete.length === 0) {
        addLog('Remote is already up to date!', 'success');
        setSyncState(SyncState.SUCCESS);
        setProgress(100);
        return;
      }

      setSyncState(SyncState.UPLOADING);
      const newTree: any[] = [];
      let completedOps = 0;
      const totalOps = filesToUpload.length;
      const uploadedPaths: string[] = [];

      const CHUNK_SIZE = 5;
      for (let i = 0; i < filesToUpload.length; i += CHUNK_SIZE) {
        const chunk = filesToUpload.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (item) => {
          try {
            const base64 = await readFileAsBase64(item.file.file);
            const blobSha = await gh.createBlob(repoDetails.owner, repoDetails.repo, base64);
            newTree.push({
              path: item.remotePath,
              mode: '100644',
              type: 'blob',
              sha: blobSha,
            });
            uploadedPaths.push(item.remotePath);
            
            if (!item.isNew) {
              addLog(`Updating: ${item.remotePath}`, 'warning');
            }
            
            completedOps++;
            setStats(prev => ({ ...prev, uploaded: completedOps }));
            
            const uploadProgress = 20 + Math.round((completedOps / totalOps) * 70);
            setProgress(uploadProgress);
          } catch (e) {
            addLog(`Failed upload: ${item.remotePath}`, 'error');
            throw e;
          }
        }));
      }

      const finalTree: any[] = [...newTree]; 
      const uploadedSet = new Set(uploadedPaths);

      baseTreeData.tree.forEach(t => {
        if (t.type !== 'blob') return; 
        if (uploadedSet.has(t.path)) return; 
        if (filesToDelete.includes(t.path)) return; 
        if (targetPrefix && t.path.startsWith(targetPrefix) && !processedRemotePaths.has(t.path) && config.deleteMissing) return; 

        finalTree.push({
          path: t.path,
          mode: t.mode,
          type: t.type,
          sha: t.sha
        });
      });

      setSyncState(SyncState.COMMITTING);
      setProgress(95);

      let commitMessage = `chore: sync ${filesToUpload.length} files`;
      if (config.autoCommitMessage) {
        const addedPaths = filesToUpload.filter(f => f.isNew).map(f => f.remotePath);
        const modifiedPaths = filesToUpload.filter(f => !f.isNew).map(f => f.remotePath);
        commitMessage = await generateCommitMessage(addedPaths, modifiedPaths, filesToDelete);
      }

      const newTreeSha = await gh.createTree(repoDetails.owner, repoDetails.repo, finalTree);
      
      const newCommitSha = await gh.createCommit(repoDetails.owner, repoDetails.repo, commitMessage, newTreeSha, latestCommitSha);
      
      if (latestCommitSha) {
        await gh.updateRef(repoDetails.owner, repoDetails.repo, defaultBranch, newCommitSha);
      } else {
        await gh.createRef(repoDetails.owner, repoDetails.repo, defaultBranch, newCommitSha);
      }

      setSyncState(SyncState.SUCCESS);
      setProgress(100);
      addLog('Sync completed successfully.', 'success');

    } catch (error) {
      console.error(error);
      setSyncState(SyncState.ERROR);
      addLog(`Error: ${(error as Error).message}`, 'error');
    }
  };

  const handleBackToDashboard = () => {
    setSyncState(SyncState.IDLE);
    setFiles([]);
    setStats({ total: 0, scanned: 0, uploaded: 0 });
    setLogs([]);
    setProgress(0);
  };

  const handleClearCredentials = () => {
    if (window.confirm("Are you sure you want to clear your saved credentials? You will need to re-enter your Token and URL.")) {
      localStorage.removeItem('gh_token');
      localStorage.removeItem('gh_repo');
      
      setConfig(prev => ({ ...prev, token: '', repoUrl: '' }));
      
      setIsConnected(false);
      setIsMenuOpen(false);
      setFiles([]);
      setSyncState(SyncState.IDLE);
      addLog('Credentials cleared successfully.', 'success');
    }
  };

  const handleHome = () => {
    setSyncState(SyncState.IDLE);
    setFiles([]);
    setIsMenuOpen(false);
  };

  const handleAdminClick = () => {
    setIsMenuOpen(false);
    setShowAdminLogin(true);
    setAdminPasswordInput('');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
    if (!adminPassword) {
      alert("Admin access is not configured");
      return;
    }
    if (adminPasswordInput === adminPassword) {
      setShowAdminLogin(false);
      setShowAdminPanel(true);
    } else {
      alert("Incorrect Password");
    }
  };

  const handleAcceptConsent = () => {
    localStorage.setItem('privacy_consent', 'true');
    setHasConsent(true);
  };

  const saveAdsConfig = () => {
    localStorage.setItem('admin_ads_config', JSON.stringify(adsConfig));
    alert('Ads configuration saved successfully!');
  };

  const AdRectangle = ({ label = "Ad Block", placementKey = 'twinRectangles' }: { label?: string, placementKey?: keyof AdsConfig['placements'] }) => {
    if (!adsConfig.placements[placementKey]) return null;

    const showAdsterra = adsConfig.adsterra.enabled;
    const showAdsense = adsConfig.adsense.enabled;
    const isConfigured = (showAdsterra && adsConfig.adsterra.rectangleZoneId) || (showAdsense && adsConfig.adsense.clientId);

    return (
      <div className="w-[300px] h-[250px] bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center relative overflow-hidden group shadow-lg mx-auto shrink-0">
        <div className="absolute inset-0 bg-slate-800/20 opacity-50"></div>
        <div className="z-10 text-center p-4">
          {isConfigured ? (
            <div className="text-xs text-center p-2 break-all text-slate-500 font-mono">
              {showAdsense && <div className="text-blue-400 mb-1">AdSense: {adsConfig.adsense.rectangleSlotId || 'No Slot ID'}</div>}
              {showAdsterra && <div className="text-amber-400">Adsterra: {adsConfig.adsterra.rectangleZoneId || 'No Zone ID'}</div>}
            </div>
          ) : (
            <>
              <p className="text-slate-600 text-xs font-bold tracking-widest uppercase mb-2">{label}</p>
              <div className="w-16 h-8 bg-slate-800 rounded mx-auto flex items-center justify-center border border-slate-700/50">
                <span className="text-slate-500 text-[10px] font-bold">300x250</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const AdNativeBanner = ({ label = "Native Ad", placementKey = 'nativeBanner' }: { label?: string, placementKey?: keyof AdsConfig['placements'] }) => {
    if (!adsConfig.placements[placementKey]) return null;
    
    const showAdsterra = adsConfig.adsterra.enabled;
    const showAdsense = adsConfig.adsense.enabled;
    const isConfigured = (showAdsterra && adsConfig.adsterra.bannerZoneId) || (showAdsense && adsConfig.adsense.clientId);

    return (
      <div className="w-[320px] h-[100px] bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center relative overflow-hidden group shadow-md mx-auto my-4 shrink-0">
        <div className="z-10 text-center">
          {isConfigured ? (
            <div className="text-xs text-center p-2 break-all text-slate-500 font-mono">
               {showAdsense && <div className="text-blue-400 mb-1">AdSense: {adsConfig.adsense.bannerSlotId || 'No Slot ID'}</div>}
               {showAdsterra && <div className="text-amber-400">Adsterra: {adsConfig.adsterra.bannerZoneId || 'No Zone ID'}</div>}
            </div>
          ) : (
            <>
              <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold block mb-1">{label}</span>
              <div className="inline-block bg-slate-800 px-2 py-0.5 rounded border border-slate-700/50">
                 <span className="text-[10px] text-slate-500 font-bold">320x100</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const TwinRectangles = () => {
    if (!adsConfig.placements.twinRectangles) return null;
    return (
      <div className="w-full my-6 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
        <AdRectangle label="Ad Unit 1" />
        <AdRectangle label="Ad Unit 2" />
      </div>
    );
  };

  const StatCard = ({ label, value, subLabel }: { label: string, value: number, subLabel?: string }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-lg">
      <span className="text-3xl font-bold text-white mb-1">{value}</span>
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      {subLabel && <span className="text-[10px] text-slate-600 mt-1">{subLabel}</span>}
    </div>
  );

  if (syncState !== SyncState.IDLE) {
    return (
      <div className="min-h-screen bg-black text-slate-200 font-sans p-4 flex flex-col items-center">
        <div className="w-full max-w-3xl flex-1 flex flex-col">
          
          <AdNativeBanner label="Top Ad" placementKey="topBanner" />

          <div className="mb-6 mt-2">
            <div className="flex items-center gap-3 mb-2">
              {syncState === SyncState.SUCCESS ? (
                <div className="p-2 bg-emerald-500/10 rounded-full">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
              ) : syncState === SyncState.ERROR ? (
                <div className="p-2 bg-red-500/10 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
              ) : (
                <div className="p-2 bg-indigo-500/10 rounded-full">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              )}
              <div>
                <h1 className={`text-xl font-bold ${
                  syncState === SyncState.SUCCESS ? 'text-emerald-400' : 
                  syncState === SyncState.ERROR ? 'text-red-400' : 'text-white'
                }`}>
                  {syncState === SyncState.SUCCESS ? 'Sync Complete' : 
                    syncState === SyncState.ERROR ? 'Sync Failed' : 'Syncing Files...'}
                </h1>
                <p className="text-xs text-slate-500">
                  {syncState === SyncState.SUCCESS 
                    ? 'All changes pushed to GitHub successfully.' 
                    : syncState === SyncState.ERROR 
                    ? 'There was a problem syncing your files.'
                    : 'Please do not close this tab.'}
                </p>
              </div>
            </div>
            
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  syncState === SyncState.SUCCESS ? 'bg-emerald-500' :
                  syncState === SyncState.ERROR ? 'bg-red-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5 text-right">{progress}%</p>
          </div>

          <TwinRectangles />

          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Scanned" value={stats.scanned} />
            <StatCard label="Uploaded" value={stats.uploaded} />
          </div>

          <AdNativeBanner label="Mid Ad" placementKey="gapAds" />

          <Logger logs={logs} />

          {(syncState === SyncState.SUCCESS || syncState === SyncState.ERROR) && (
            <button 
              onClick={handleBackToDashboard}
              className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" /> Back to Dashboard
            </button>
          )}

          <TwinRectangles />

        </div>
      </div>
    );
  }

  if (showAdminPanel) {
    return (
      <div className="min-h-screen bg-black text-slate-200 font-sans p-4 flex flex-col items-center">
        <div className="w-full max-w-4xl">
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-amber-600 p-2 rounded-xl shadow-lg">
                <UserCog className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
            </div>
            <button 
              onClick={() => setShowAdminPanel(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Exit Admin
            </button>
          </header>

          <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4">
            <button 
              onClick={() => setActiveAdminTab('overview')}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${activeAdminTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Overview
            </button>
            <button 
              onClick={() => setActiveAdminTab('networks')}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${activeAdminTab === 'networks' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <Globe className="w-4 h-4" /> Ad Networks
            </button>
            <button 
              onClick={() => setActiveAdminTab('placements')}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${activeAdminTab === 'placements' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              <Layers className="w-4 h-4" /> Placements
            </button>
          </div>

          {activeAdminTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-500 uppercase">Status</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-400">Active</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-slate-500 uppercase">Networks</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {(adsConfig.adsterra.enabled ? 1 : 0) + (adsConfig.adsense.enabled ? 1 : 0)}/2
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-slate-500 uppercase">Placements</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {Object.values(adsConfig.placements).filter(Boolean).length}/5
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-slate-500 uppercase">Est. RPM</span>
                  </div>
                  <p className="text-lg font-bold text-green-400">$2.50</p>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setActiveAdminTab('networks')} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-left transition-colors">
                    <Globe className="w-5 h-5 text-indigo-400 mb-2" />
                    <p className="font-medium text-white">Configure Networks</p>
                    <p className="text-xs text-slate-500">Set up AdSense & Adsterra</p>
                  </button>
                  <button onClick={() => setActiveAdminTab('placements')} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-left transition-colors">
                    <Layers className="w-5 h-5 text-amber-400 mb-2" />
                    <p className="font-medium text-white">Manage Placements</p>
                    <p className="text-xs text-slate-500">Toggle ad positions</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeAdminTab === 'networks' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <span className="text-blue-400 font-bold text-sm">G</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Google AdSense</h3>
                      <p className="text-xs text-slate-500">Premium ad network</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setAdsConfig(prev => ({ ...prev, adsense: { ...prev.adsense, enabled: !prev.adsense.enabled }}))}
                    className="text-slate-400 hover:text-white"
                  >
                    {adsConfig.adsense.enabled ? <ToggleRight className="w-8 h-8 text-emerald-400" /> : <ToggleLeft className="w-8 h-8" />}
                  </button>
                </div>
                {adsConfig.adsense.enabled && (
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Client ID</label>
                      <input 
                        type="text" 
                        value={adsConfig.adsense.clientId}
                        onChange={e => setAdsConfig(prev => ({ ...prev, adsense: { ...prev.adsense, clientId: e.target.value }}))}
                        placeholder="ca-pub-xxxxxxxxxxxxxxxx"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Banner Slot ID</label>
                        <input 
                          type="text" 
                          value={adsConfig.adsense.bannerSlotId}
                          onChange={e => setAdsConfig(prev => ({ ...prev, adsense: { ...prev.adsense, bannerSlotId: e.target.value }}))}
                          placeholder="1234567890"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Rectangle Slot ID</label>
                        <input 
                          type="text" 
                          value={adsConfig.adsense.rectangleSlotId}
                          onChange={e => setAdsConfig(prev => ({ ...prev, adsense: { ...prev.adsense, rectangleSlotId: e.target.value }}))}
                          placeholder="0987654321"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                      <span className="text-amber-400 font-bold text-sm">A</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Adsterra</h3>
                      <p className="text-xs text-slate-500">High CPM network</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setAdsConfig(prev => ({ ...prev, adsterra: { ...prev.adsterra, enabled: !prev.adsterra.enabled }}))}
                    className="text-slate-400 hover:text-white"
                  >
                    {adsConfig.adsterra.enabled ? <ToggleRight className="w-8 h-8 text-emerald-400" /> : <ToggleLeft className="w-8 h-8" />}
                  </button>
                </div>
                {adsConfig.adsterra.enabled && (
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Banner Zone ID</label>
                        <input 
                          type="text" 
                          value={adsConfig.adsterra.bannerZoneId}
                          onChange={e => setAdsConfig(prev => ({ ...prev, adsterra: { ...prev.adsterra, bannerZoneId: e.target.value }}))}
                          placeholder="Enter Zone ID"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Rectangle Zone ID</label>
                        <input 
                          type="text" 
                          value={adsConfig.adsterra.rectangleZoneId}
                          onChange={e => setAdsConfig(prev => ({ ...prev, adsterra: { ...prev.adsterra, rectangleZoneId: e.target.value }}))}
                          placeholder="Enter Zone ID"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={saveAdsConfig}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" /> Save Configuration
              </button>
            </div>
          )}

          {activeAdminTab === 'placements' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                {Object.entries(adsConfig.placements).map(([key, enabled]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                    <div>
                      <p className="font-medium text-white capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p className="text-xs text-slate-500">
                        {key === 'topBanner' && '320x100 at page top'}
                        {key === 'twinRectangles' && 'Two 300x250 units side by side'}
                        {key === 'gapAds' && '320x100 between sections'}
                        {key === 'nativeBanner' && '320x100 native format'}
                        {key === 'bottomBanner' && '320x100 at page bottom'}
                      </p>
                    </div>
                    <button 
                      onClick={() => setAdsConfig(prev => ({ 
                        ...prev, 
                        placements: { 
                          ...prev.placements, 
                          [key]: !enabled 
                        }
                      }))}
                      className="text-slate-400 hover:text-white"
                    >
                      {enabled ? <ToggleRight className="w-8 h-8 text-emerald-400" /> : <ToggleLeft className="w-8 h-8" />}
                    </button>
                  </div>
                ))}
              </div>

              <button 
                onClick={saveAdsConfig}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" /> Save Placements
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-200 font-sans flex flex-col">
      {!hasConsent && (
        <ConsentBanner 
          onAccept={handleAcceptConsent}
          onReadPolicy={() => setShowPrivacyPolicy(true)}
        />
      )}

      {showPrivacyPolicy && (
        <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} />
      )}

      {showAdminLogin && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-500/20 rounded-full">
                <Lock className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Admin Access</h3>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Password</label>
                <input 
                  type="password"
                  value={adminPasswordInput}
                  onChange={e => setAdminPasswordInput(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowAdminLogin(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-bold"
                >
                  Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHelpModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-emerald-400" />
                <h3 className="text-xl font-bold text-white">How to Use</h3>
              </div>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-500 hover:text-white">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300">
              <div>
                <h4 className="font-bold text-white mb-2">1. Get a GitHub Token</h4>
                <p className="text-slate-400">Go to GitHub Settings &gt; Developer Settings &gt; Personal Access Tokens &gt; Generate new token (classic). Select the "repo" scope.</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">2. Enter Repository</h4>
                <p className="text-slate-400">Paste your token and repository URL (e.g., username/repo-name or the full GitHub URL).</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">3. Connect & Select Folder</h4>
                <p className="text-slate-400">Click "Connect Repository", then select the folder you want to sync from your device.</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">4. Start Sync</h4>
                <p className="text-slate-400">Click "START SYNC" and wait for the process to complete. Your files will be pushed to GitHub!</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-800">
              <button 
                onClick={() => setShowHelpModal(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl"
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}

      <AdNativeBanner label="Top Banner" placementKey="topBanner" />

      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 pb-4 relative flex-1">
        <header className="flex items-center justify-between mb-8 relative z-50">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-900/20">
              <FolderGit2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">GitSync <span className="text-slate-500 font-normal">Mobile</span></h1>
          </div>
          
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2.5 rounded-full hover:bg-slate-800 active:scale-95 transition-all border ${isMenuOpen ? 'bg-slate-800 border-indigo-500/50 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {isMenuOpen && (
              <div className="absolute right-0 top-12 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="p-1.5 space-y-0.5">
                  <button onClick={handleHome} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors text-left">
                    <Home className="w-4 h-4 text-indigo-400" /> Home Page
                  </button>
                  <button onClick={() => { setShowHelpModal(true); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors text-left">
                    <HelpCircle className="w-4 h-4 text-emerald-400" /> How to use
                  </button>
                  <button onClick={() => { if(isConnected) setShowAdvancedSettings(!showAdvancedSettings); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors text-left">
                    <Settings className="w-4 h-4 text-slate-400" /> Settings
                  </button>
                  <div className="h-px bg-slate-800 mx-2 my-1"></div>
                   <button onClick={handleAdminClick} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors text-left">
                    <UserCog className="w-4 h-4 text-amber-500" /> Admin Panel
                  </button>
                  <button onClick={() => { setShowPrivacyPolicy(true); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors text-left">
                    <Shield className="w-4 h-4 text-indigo-400" /> Privacy Policy
                  </button>
                  <div className="h-px bg-slate-800 mx-2 my-1"></div>
                  <button onClick={handleClearCredentials} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-colors text-left">
                    <Trash2 className="w-4 h-4" /> Clear Credentials
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="space-y-6">
          <div className="flex items-center gap-2.5 mb-2">
            <Github className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Repository Setup</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Personal Access Token
              </label>
              <input 
                type="password" 
                value={config.token}
                onChange={e => setConfig(prev => ({ ...prev, token: e.target.value }))}
                placeholder="ghp_xxxxxxxxxxxx"
                disabled={isConnected}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all placeholder:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
              />
              <p className="text-xs text-slate-500 leading-relaxed">
                Required scope: <span className="font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">repo</span>
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Repository Link
              </label>
              <input 
                type="text" 
                value={config.repoUrl}
                onChange={e => setConfig(prev => ({ ...prev, repoUrl: e.target.value }))}
                placeholder="username/repo"
                disabled={isConnected}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all placeholder:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-400">Branch</label>
                <div className="relative">
                  <GitBranch className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-600" />
                  <input 
                    type="text" 
                    value={config.branch}
                    onChange={e => setConfig(prev => ({ ...prev, branch: e.target.value }))}
                    placeholder="main"
                    disabled={isConnected}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3 py-3.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50 shadow-inner"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-400">Target Path</label>
                <div className="relative">
                  <FolderInput className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-600" />
                  <input 
                    type="text" 
                    value={config.targetPath}
                    onChange={e => setConfig(prev => ({ ...prev, targetPath: e.target.value }))}
                    placeholder="assets"
                    disabled={isConnected}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-3 py-3.5 text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-50 shadow-inner"
                  />
                </div>
              </div>
            </div>

            {connectionError && (
              <div className="animate-in fade-in slide-in-from-top-2 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-red-400 mb-1">Connection Failed</p>
                  <p className="text-red-300/80 leading-relaxed">{connectionError}</p>
                </div>
              </div>
            )}

            {!isConnected && (
              <>
                <button 
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 active:scale-[0.98] text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-2.5 group mt-4 text-base"
                >
                  {isConnecting ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white/90" />
                  ) : (
                    <>
                      Connect Repository <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
                <TwinRectangles />
              </>
            )}

            {isConnected && (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
                
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                   <div className="bg-emerald-500/20 p-2 rounded-full ring-1 ring-emerald-500/30">
                     <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="text-base text-emerald-300 font-medium truncate">Repository Connected</p>
                     <p className="text-xs text-emerald-400/60 truncate">Ready for file selection</p>
                   </div>
                   <button 
                     onClick={() => { setIsConnected(false); setFiles([]); setLogs([]); setProgress(0); setSyncState(SyncState.IDLE); }} 
                     className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-xs text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
                   >
                     <LogOut className="w-3 h-3" /> Disconnect
                   </button>
                </div>

                <AdNativeBanner label="Gap Ad" placementKey="gapAds" />

                <div className="relative group touch-manipulation">
                  <input
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFolderSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                  <div className={`
                    border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all duration-300
                    ${files.length > 0 
                      ? 'border-indigo-500/50 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.1)]' 
                      : 'border-slate-700 bg-slate-900/50 hover:border-indigo-500 hover:bg-slate-800'}
                  `}>
                    {files.length > 0 ? (
                      <>
                        <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-1">
                          <FolderOpen className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-white text-lg font-semibold">{files.length} files selected</p>
                          <p className="text-indigo-400 text-sm mt-1 font-medium">Tap to change folder</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 mb-1">
                          <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                        </div>
                        <div className="text-center">
                          <p className="text-white text-lg font-semibold group-hover:text-indigo-100">Select Folder</p>
                          <p className="text-slate-500 text-sm mt-1 max-w-[200px] mx-auto leading-tight">
                            Syncs to <span className="text-slate-300 font-mono bg-slate-800 px-1 py-0.5 rounded">{config.targetPath || '/root'}</span>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 space-y-5">
                    <div className="flex justify-end">
                      <button 
                        onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 transition-colors py-2"
                      >
                        <Settings className="w-3.5 h-3.5" /> 
                        <span>{showAdvancedSettings ? 'Hide Options' : 'Advanced Options'}</span>
                      </button>
                    </div>

                    {showAdvancedSettings && (
                      <div className="bg-slate-900/80 backdrop-blur-sm p-4 rounded-xl border border-slate-800 text-sm space-y-3 shadow-lg">
                          <label className="flex items-center gap-3 text-slate-300 cursor-pointer active:opacity-70">
                            <input 
                              type="checkbox" 
                              checked={config.deleteMissing}
                              onChange={e => setConfig(prev => ({ ...prev, deleteMissing: e.target.checked }))}
                              className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-offset-slate-900"
                            />
                            <span>Delete remote files missing locally</span>
                          </label>
                          <div className="h-px bg-slate-800/50"></div>
                          <label className="flex items-center gap-3 text-slate-300 cursor-pointer active:opacity-70">
                            <input 
                              type="checkbox" 
                              checked={config.autoCommitMessage}
                              onChange={e => setConfig(prev => ({ ...prev, autoCommitMessage: e.target.checked }))}
                              className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-offset-slate-900"
                            />
                            <span>Use AI for commit messages</span>
                          </label>
                      </div>
                    )}

                    <button
                      onClick={startSync}
                      className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-900/20 w-full py-4 rounded-xl font-bold text-base tracking-wide shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                    >
                      START SYNC
                    </button>
                    
                    <TwinRectangles />

                    <div className="pt-2">
                       <Logger logs={logs} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 border-t border-slate-800 pt-8">
           <TwinRectangles />
           <AdNativeBanner label="Footer Native" placementKey="nativeBanner" />
        </div>

      </div>

      <footer className="w-full max-w-3xl mx-auto px-6 py-6 border-t border-slate-800/50 mt-4 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
           <p className="text-xs text-slate-600">© 2024 GitSync Mobile</p>
           <div className="flex items-center gap-4 text-xs">
             <button onClick={() => setShowPrivacyPolicy(true)} className="text-slate-500 hover:text-indigo-400 transition-colors">Privacy Policy</button>
             <button onClick={() => {}} className="text-slate-500 hover:text-indigo-400 transition-colors cursor-not-allowed">Terms of Service</button>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
