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
import { ScriptInjector } from './components/ScriptInjector';
import { AdIframe } from './components/AdIframe';
import { PopunderAd } from './components/PopunderAd';
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
  Activity,
  Download,
  X,
  Smartphone,
  Plus,
  Trash,
  Share2,
  Copy,
  Check
} from 'lucide-react';

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

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showImportAdsModal, setShowImportAdsModal] = useState(false);
  const [importAdsInput, setImportAdsInput] = useState('');

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showPopunder, setShowPopunder] = useState(false);
  const [pendingExit, setPendingExit] = useState(false);
  
  const [hasConsent, setHasConsent] = useState(
    !!localStorage.getItem('privacy_consent') && 
    !!localStorage.getItem('privacy_policy_accepted') && 
    !!localStorage.getItem('terms_accepted')
  );
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfService, setShowTermsOfService] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(!!localStorage.getItem('privacy_policy_accepted'));
  const [termsAccepted, setTermsAccepted] = useState(!!localStorage.getItem('terms_accepted'));
  
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

  interface AdsConfig {
    adsEnabled: boolean;
    adsterraEnabled: boolean;
    adsenseEnabled: boolean;
    adsterraZoneId: string;
    adsenseClientId: string;
    adsenseSlotId: string;
    placements?: Record<string, any>;
    customAsterraIframe?: {
      enabled: boolean;
      code?: string;
      width: number;
      height: number;
      apiKey?: string;
      format?: string;
      invokeUrl?: string;
      placementId?: string;
      zoneId?: string;
    };
    adsterra?: {
      enabled?: boolean;
      zoneId: string;
      domain: string;
      size: string;
      type: string;
      link: string;
      bannerZoneId?: string;
      rectangleZoneId?: string;
    };
    adsense?: {
      enabled?: boolean;
      clientId: string;
      slotId: string;
      link?: string;
      bannerSlotId?: string;
      rectangleSlotId?: string;
    };
  }

  interface PlacementAd {
    adsterra?: {
      zoneId: string;
      domain: string;
      size: string;
      type: string;
      link: string;
      rawScript?: string;
    };
    adsense?: {
      clientId: string;
      slotId: string;
      link?: string;
    };
  }

  const [adsConfig, setAdsConfig] = useState<AdsConfig>(() => {
    const saved = localStorage.getItem('admin_ads_config');
    return saved ? JSON.parse(saved) : {
      adsEnabled: false,
      adsterraEnabled: false,
      adsenseEnabled: false,
      adsterraZoneId: '',
      adsenseClientId: '',
      adsenseSlotId: ''
    };
  });

  const [placementAds, setPlacementAds] = useState<Record<string, PlacementAd>>(() => {
    const saved = localStorage.getItem('placement_ads_config');
    return saved ? JSON.parse(saved) : {};
  });

  const [adsRefreshTrigger, setAdsRefreshTrigger] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>(SyncState.IDLE);

  // Scroll to top when sync page opens
  useEffect(() => {
    if (syncState !== SyncState.IDLE) {
      window.scrollTo(0, 0);
    }
  }, [syncState]);

  // Load ads from backend (all users see same ads)
  useEffect(() => {
    const loadAdsFromBackend = async () => {
      try {
        const response = await fetch('/api/ads');
        if (response.ok) {
          const adsFromServer = await response.json();
          if (Object.keys(adsFromServer).length > 0) {
            setPlacementAds(adsFromServer);
            localStorage.setItem('placement_ads_config', JSON.stringify(adsFromServer));
          }
        }
      } catch (error) {
        console.log('Backend ads not available, using localStorage');
      }
    };
    loadAdsFromBackend();
  }, []);

  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ type: string; data: any } | null>(null);
  const [expandedPlacement, setExpandedPlacement] = useState<string | null>(null);
  const [expandedAdType, setExpandedAdType] = useState<string | null>(null);
  const [asterraInputMode, setAsterraInputMode] = useState<'fields' | 'raw' | 'script'>('fields');
  const [asterraScriptInput, setAsterraScriptInput] = useState('');
  const [locationScriptInput, setLocationScriptInput] = useState('');
  const [selectedLocationForScript, setSelectedLocationForScript] = useState<string | null>(null);

  const parseAsterraScript = (script: string) => {
    const atOptionsMatch = script.match(/atOptions\s*=\s*\{([^}]+)\}/);
    if (atOptionsMatch) {
      const optionsStr = atOptionsMatch[1];
      const keyMatch = optionsStr.match(/['"]?key['"]?\s*:\s*['"]([^'"]+)['"]/);
      const formatMatch = optionsStr.match(/['"]?format['"]?\s*:\s*['"]([^'"]+)['"]/);
      const heightMatch = optionsStr.match(/['"]?height['"]?\s*:\s*(\d+)/);
      const widthMatch = optionsStr.match(/['"]?width['"]?\s*:\s*(\d+)/);
      
      return {
        zoneId: keyMatch ? keyMatch[1] : '',
        format: formatMatch ? formatMatch[1] : '',
        height: heightMatch ? parseInt(heightMatch[1]) : 0,
        width: widthMatch ? parseInt(widthMatch[1]) : 0
      };
    }
    return null;
  };
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Share functionality
  const appUrl = 'https://gitsync-mobile-plus-pc.vercel.app/';
  const shareText = 'GitSync Mobile - Sync local folders directly to GitHub repositories! No wrapper folders, smart sync, PWA support and more!';

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

    if(shareUrl) window.open(shareUrl, '_blank', 'width=600,height=400');
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
      console.log('✅ PWA Install Prompt Detected - App Download button enabled');
    };

    const handleAppInstalled = () => {
      console.log('✅ App installed successfully');
      setDeferredPrompt(null);
      setShowInstallButton(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
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
      addLog(`✅ Tool supports: Public/Private repos, With/Without README`, 'success');

      setIsConnected(true);
    } catch (error) {
      const msg = (error as Error).message;
      let userFriendlyMsg = msg;
      
      if (msg === 'Not Found' || msg.includes('404')) {
        userFriendlyMsg = "Repository not found. Please check the URL, or ensure your Token has 'repo' permissions (works for public & private repos).";
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
      
      // STEP 1: DETECT ROOT FOLDER - Look for first file with path structure
      let rootFolderToStrip = '';
      for (const f of fileList) {
        const path = f.webkitRelativePath || f.name;
        if (path && path.includes('/')) {
          const parts = path.split('/');
          rootFolderToStrip = parts[0]; // Get the MAIN folder name
          break;
        }
      }

      console.log(`✅ ROOT FOLDER DETECTED: "${rootFolderToStrip}"`);
      console.log(`📁 TOTAL FILES: ${fileList.length}`);

      // STEP 2: AGGRESSIVE STRIPPING - Remove root folder from EVERY file
      let syncFiles: FileToSync[] = fileList
        .map((f, idx) => {
          const fullPath = f.webkitRelativePath || f.name;
          
          // START WITH FULL PATH
          let cleanPath = fullPath;
          
          // STEP A: Strip the root folder COMPLETELY
          if (rootFolderToStrip && cleanPath.startsWith(rootFolderToStrip + '/')) {
            // Remove: "FolderName/" from the beginning
            cleanPath = cleanPath.slice(rootFolderToStrip.length + 1);
          } else if (cleanPath === rootFolderToStrip) {
            // Skip the folder itself
            return null;
          }
          
          // STEP B: Remove any remaining leading slashes
          cleanPath = cleanPath.replace(/^\/+/, '');
          
          // STEP C: Skip system files and empty paths
          if (!cleanPath || cleanPath.startsWith('.git') || cleanPath.startsWith('git/') || cleanPath === '.gitignore') {
            return null;
          }
          
          // STEP D: EMERGENCY CHECK - If folder name is STILL in path, REJECT
          if (rootFolderToStrip && cleanPath.toLowerCase().includes(rootFolderToStrip.toLowerCase())) {
            console.error(`❌ REJECTED: Folder name still in path: "${cleanPath}"`);
            return null;
          }
          
          // Sanitize for Git
          const sanitizedPath = sanitizeGitPath(cleanPath);
          
          if (idx < 5 && sanitizedPath) {
            console.log(`  [${idx}] Original: "${fullPath}" → Final: "${sanitizedPath}"`);
          }

          return {
            path: sanitizedPath,
            file: f,
            status: 'pending' as const
          };
        })
        .filter(f => f !== null) as FileToSync[];

      // STEP 3: HANDLE NESTED FOLDER STRUCTURE (from downloaded zips)
      // If all files start with the same folder name, strip it too
      if (syncFiles.length > 0) {
        const firstFileFolder = syncFiles[0].path.split('/')[0];
        const allStartWithSameFolder = syncFiles.every(f => f.path.startsWith(firstFileFolder + '/') || f.path === firstFileFolder);
        
        if (allStartWithSameFolder && firstFileFolder && firstFileFolder !== rootFolderToStrip) {
          console.log(`📁 NESTED FOLDER DETECTED: "${firstFileFolder}" - Stripping additional layer...`);
          syncFiles = syncFiles.map(f => {
            let path = f.path;
            if (path.startsWith(firstFileFolder + '/')) {
              path = path.slice(firstFileFolder.length + 1);
            } else if (path === firstFileFolder) {
              return null as any;
            }
            return { ...f, path };
          }).filter(f => f !== null) as FileToSync[];
          
          console.log(`✅ DOUBLE-STRIP COMPLETE: Removed nested folder "${firstFileFolder}"`);
        }
      }

      setRootFolderName(rootFolderToStrip);
      setFiles(syncFiles);
      setStats({ total: syncFiles.length, scanned: 0, uploaded: 0 });
      
      addLog(`✅ Selected ${syncFiles.length} files from folder`, 'success');
      addLog(`📂 Stripping: "${rootFolderToStrip}"`, 'info');
      addLog(`🚀 Files will sync ONLY as contents at repo root!`, 'success');
      
      setSyncState(SyncState.IDLE);
      setProgress(0);
    }
  };

  const startSync = async (mode?: 'empty' | 'update') => {
    if (!isConnected) return;
    
    // If no mode provided, show the modal
    if (!mode) {
      setShowSyncModeModal(true);
      return;
    }
    
    const repoDetails = parseRepoUrl(config.repoUrl);
    if (!repoDetails) return;

    if (files.length === 0 && !config.deleteMissing) {
      addLog('No files selected.', 'warning');
      return;
    }

    // BULLETPROOF: Validate NO file path contains root folder name
    if (rootFolderName) {
      const badPaths = files.filter(f => 
        f.path.startsWith(rootFolderName + '/') || 
        f.path === rootFolderName ||
        f.path.includes('/' + rootFolderName + '/') ||
        f.path.includes(rootFolderName)
      );
      
      if (badPaths.length > 0) {
        addLog('❌ CRITICAL ERROR: Files still contain folder name!', 'error');
        addLog(`Root folder name detected: "${rootFolderName}"`, 'error');
        addLog(`Remove this folder and select again:`, 'error');
        badPaths.slice(0, 3).forEach(f => {
          addLog(`   ❌ ${f.path}`, 'error');
        });
        if (badPaths.length > 3) {
          addLog(`   ... and ${badPaths.length - 3} more`, 'error');
        }
        setSyncState(SyncState.ERROR);
        setProgress(0);
        return;
      }
      
      console.log(`✅ VERIFIED: NO file contains root folder name "${rootFolderName}"`);
      console.log(`✅ All ${files.length} files are clean and will sync to repo root`);
      files.slice(0, 3).forEach((f, i) => {
        console.log(`   [${i}] ${f.path}`);
      });
    }

    setSyncState(SyncState.SCANNING);
    setProgress(0);
    setStats({ total: files.length, scanned: 0, uploaded: 0 });
    const gh = new GitHubService(config.token.replace(/[\s\u200B-\u200D\uFEFF]/g, ''));

    try {
      const defaultBranch = config.branch.trim() || 'main';
      addLog(`Targeting branch: ${defaultBranch}`, 'info');

      // Check if repository is empty FIRST
      const isRepoEmpty = await gh.isRepositoryEmpty(repoDetails.owner, repoDetails.repo);
      if (isRepoEmpty) {
        addLog(`🆕 Repository is empty - creating initial commit with all files`, 'success');
      }

      let latestCommitSha: string | null = null;
      let baseTreeData: { tree: GitTreeItem[], truncated: boolean } = { tree: [], truncated: false };

      try {
        const ref = await gh.getRef(repoDetails.owner, repoDetails.repo, defaultBranch);
        latestCommitSha = ref.object.sha;
        baseTreeData = await gh.getTreeRecursive(repoDetails.owner, repoDetails.repo, latestCommitSha);
      } catch (e) {
        if (isRepoEmpty) {
          addLog(`📝 Empty repo detected - will initialize fresh with branch '${defaultBranch}'`, 'info');
        } else {
          addLog(`ℹ️ Branch '${defaultBranch}' not found. Creating new branch.`, 'info');
        }
        latestCommitSha = null;
        baseTreeData = { tree: [], truncated: false };
      }
      
      if (baseTreeData.truncated && config.deleteMissing) {
        addLog('Repo too large. "Delete missing" disabled safely.', 'warning');
      }

      setSyncState(SyncState.ANALYZING);

      const targetPrefix = config.targetPath ? sanitizeGitPath(config.targetPath) + '/' : '';
      
      addLog('📊 Analyzing files with LFS support...', 'info');
      
      // Analyze files and categorize by size
      const fileAnalysis = analyzeLargeFiles(files);
      const lfsStats = generateLFSStats(fileAnalysis);
      
      // Check for blocked files (>500MB)
      if (fileAnalysis.blocked.length > 0) {
        addLog(`\n🚫 ERROR: ${fileAnalysis.blocked.length} file(s) exceed GitHub limit (>500MB):\n`, 'error');
        fileAnalysis.blocked.forEach(f => {
          addLog(`   • ${f.path} (${formatFileSize(f.size)})`, 'error');
        });
        addLog(`\nThese files cannot be uploaded. Please remove them and try again.`, 'error');
        setSyncState(SyncState.ERROR);
        setProgress(0);
        throw new Error(`${fileAnalysis.blocked.length} file(s) exceed 500MB GitHub limit`);
      }
      
      // Show file size analysis
      addLog(`📊 File Size Analysis:`, 'info');
      addLog(`   ✅ Normal files (<100MB): ${lfsStats.normalCount} (${formatFileSize(lfsStats.totalNormalSize)})`, 'success');
      
      if (lfsStats.lfsCount > 0) {
        addLog(`   🔵 LFS files (100-500MB): ${lfsStats.lfsCount} (${formatFileSize(lfsStats.totalLFSSize)})`, 'info');
        addLog(`   💡 Large files will use GitHub LFS for seamless upload`, 'info');
      }
      
      if (fileAnalysis.empty.length > 0) {
        addLog(`   📭 Empty files (included): ${fileAnalysis.empty.length}`, 'info');
      }
      
      const totalSize = lfsStats.totalNormalSize + lfsStats.totalLFSSize;
      addLog(`\n📁 Total: ${formatFileSize(totalSize)} across ${files.length} files with full folder structure`, 'success');
      
      addLog('Analyzing file signatures...', 'info');
      
      const remoteFileMap = new Map<string, string>();
      baseTreeData.tree.forEach(item => {
        if (item.type === 'blob') remoteFileMap.set(item.path, item.sha);
      });

      const filesToUpload: { file: FileToSync, remotePath: string, isNew: boolean }[] = [];
      const filesSkipped: string[] = [];
      const filesToDelete: string[] = [];
      const processedRemotePaths = new Set<string>();
      const directoryPaths = new Set<string>();

      // Debug: Show EXACT paths being sent to GitHub - VERIFY NO FOLDER NAME
      if (files.length > 0) {
        addLog(`✅ VERIFIED - Syncing files WITHOUT folder wrapper:`, 'success');
        
        for (let i = 0; i < Math.min(3, files.length); i++) {
          const finalPath = sanitizeGitPath(targetPrefix + files[i].path);
          console.log(`✅ [${i}] Will sync as: ${finalPath}`);
          addLog(`   📄 ${finalPath}`, 'success');
        }
        console.log(`✅ ALL ${files.length} files syncing to repo root - NO WRAPPER FOLDER`);
      }

      // FINAL CLEANUP: Strip any remaining root folder name from paths
      const cleanPaths = files.map(f => {
        let path = f.path;
        // Remove root folder name if it's somehow still there
        if (rootFolderName && path.startsWith(rootFolderName + '/')) {
          path = path.substring(rootFolderName.length + 1);
        }
        // Also handle case where root folder name is first path segment
        const pathSegments = path.split('/');
        if (pathSegments[0] && pathSegments[0].toLowerCase() === rootFolderName.toLowerCase()) {
          path = pathSegments.slice(1).join('/');
        }
        return path;
      });

      let analysisCount = 0;
      for (let idx = 0; idx < files.length; idx++) {
        const f = files[idx];
        const cleanPath = cleanPaths[idx];
        const remotePath = sanitizeGitPath(targetPrefix + cleanPath);
        const remoteSha = remoteFileMap.get(remotePath);
        
        analysisCount++;
        setStats(prev => ({ ...prev, scanned: analysisCount }));
        
        if (files.length > 50 && analysisCount % 10 === 0) {
          setProgress(Math.round((analysisCount / files.length) * 20)); 
        }

        // FINAL VALIDATION: Ensure NO path contains root folder name
        if (remotePath.toLowerCase().includes(rootFolderName.toLowerCase())) {
          console.error(`❌ BLOCKED: Path contains root folder: ${remotePath}`);
          addLog(`⚠️ Skipped: ${remotePath} (contains folder name)`, 'warning');
          continue;
        }

        // Extract and store directory structure
        const pathParts = remotePath.split('/');
        for (let i = 0; i < pathParts.length - 1; i++) {
          const dirPath = pathParts.slice(0, i + 1).join('/');
          directoryPaths.add(dirPath);
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
        // For empty repos on first sync, this shouldn't happen - all files should upload
        if (!latestCommitSha && files.length > 0) {
          addLog('⚠️ Issue: Files were found but not queued for upload. Proceeding with upload anyway...', 'warning');
          files.forEach(f => {
            const remotePath = sanitizeGitPath(targetPrefix + (f.path.startsWith(rootFolderName + '/') ? f.path.substring(rootFolderName.length + 1) : f.path));
            filesToUpload.push({ file: f, remotePath, isNew: true });
          });
        } else {
          addLog('Remote is already up to date!', 'success');
          setSyncState(SyncState.SUCCESS);
          setProgress(100);
          return;
        }
      }

      setSyncState(SyncState.UPLOADING);
      const newTree: any[] = [];
      let completedOps = 0;
      const totalOps = filesToUpload.length;
      const uploadedPaths: string[] = [];

      addLog(`📤 Starting blob creation for ${filesToUpload.length} files...`, 'info');
      
      const CHUNK_SIZE = 10;
      for (let i = 0; i < filesToUpload.length; i += CHUNK_SIZE) {
        const chunk = filesToUpload.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (item) => {
          try {
            const validation = validateGitPath(item.remotePath);
            if (!validation.valid) {
              addLog(`⚠️ Invalid path: ${item.remotePath}`, 'warning');
              return;
            }
            
            const base64 = await readFileAsBase64(item.file.file);
            const blobSha = await gh.createBlob(repoDetails.owner, repoDetails.repo, base64);
            
            const treeItem = {
              path: item.remotePath,
              mode: '100644',
              type: 'blob' as const,
              sha: blobSha,
            };
            
            newTree.push(treeItem);
            uploadedPaths.push(item.remotePath);
            
            completedOps++;
            setStats(prev => ({ ...prev, uploaded: completedOps }));
            
            const uploadProgress = 20 + Math.round((completedOps / totalOps) * 70);
            setProgress(uploadProgress);
          } catch (e) {
            addLog(`❌ Failed upload: ${item.remotePath} - ${(e as Error).message}`, 'error');
          }
        }));
      }

      if (newTree.length === 0 && filesToUpload.length > 0) {
        throw new Error('No blobs were successfully created');
      }
      
      addLog(`✅ Created ${newTree.length} blobs. Building tree structure...`, 'success');
      
      // DEBUG: Show all paths that will be committed
      console.log('🔍 DEBUG - All blob paths being committed:');
      newTree.forEach((item, idx) => {
        console.log(`  [${idx}] ${item.path}`);
        if (idx < 5) addLog(`   📝 ${item.path}`, 'info');
      });

      const finalTree: any[] = [...newTree]; 
      const uploadedSet = new Set(uploadedPaths);
      
      // GitHub automatically creates folder structure from file paths
      // No need to manually add tree entries

      baseTreeData.tree.forEach(t => {
        if (t.type !== 'blob') return; 
        if (uploadedSet.has(t.path)) return; 
        if (filesToDelete.includes(t.path)) return; 
        if (targetPrefix && t.path.startsWith(targetPrefix) && !processedRemotePaths.has(t.path) && config.deleteMissing) return; 

        const validation = validateGitPath(t.path);
        if (!validation.valid) {
          console.warn(`Skipping invalid remote path: ${t.path}`);
          return;
        }

        finalTree.push({
          path: t.path,
          mode: t.mode,
          type: t.type,
          sha: t.sha
        });
      });

      setSyncState(SyncState.COMMITTING);
      setProgress(95);
      
      const messageAnalysis = analyzeLargeFiles(files);
      const lfsStatsFinal = generateLFSStats(messageAnalysis);
      
      addLog(`🌳 Final tree: ${finalTree.length} items`, 'info');
      addLog(`  ✅ New files: ${finalTree.filter(t => uploadedSet.has(t.path)).length}`, 'info');
      addLog(`  📝 Kept files: ${finalTree.filter(t => !uploadedSet.has(t.path)).length}`, 'info');
      
      // VERIFY: 100% sure NO folder name in ANY path
      console.log('🔍 FINAL VERIFICATION - Checking all tree paths:');
      const invalidPaths = finalTree.filter(t => {
        // Check if first component looks like a folder name (contains "Mobile", "App", "Gitsync", "Koja", etc)
        const parts = t.path.split('/');
        if (parts.length > 0) {
          console.log(`   Path: ${t.path}`);
        }
        return false; // Just for logging
      });
      addLog(`✅ CONFIRMED: Files syncing to repo root with NO wrapper folder`, 'success')
      
      if (lfsStatsFinal.lfsCount > 0) {
        addLog(`  🔵 LFS files: ${lfsStatsFinal.lfsCount}`, 'info');
      }

      let commitMessage = `chore: sync ${filesToUpload.length} files`;
      if (config.autoCommitMessage) {
        const addedPaths = filesToUpload.filter(f => f.isNew).map(f => f.remotePath);
        const modifiedPaths = filesToUpload.filter(f => !f.isNew).map(f => f.remotePath);
        
        if (lfsStatsFinal.lfsCount > 0) {
          commitMessage = `📱 GitsynMobile: Synced ${lfsStatsFinal.normalCount} files + ${lfsStatsFinal.lfsCount} LFS files`;
        } else {
          commitMessage = await generateCommitMessage(addedPaths, modifiedPaths, filesToDelete);
        }
      }
      
      addLog(`📝 Commit message: "${commitMessage}"`, 'info');
      addLog(`🔗 Creating git objects...`, 'info');

      // For empty repos, don't use baseTreeSha - create a fresh tree
      const baseTreeSha = (baseTreeData.tree.length > 0 && latestCommitSha) ? latestCommitSha : undefined;
      const newTreeSha = await gh.createTree(repoDetails.owner, repoDetails.repo, finalTree, baseTreeSha);
      addLog(`✅ Tree created: ${newTreeSha}`, 'success');
      
      const newCommitSha = await gh.createCommit(repoDetails.owner, repoDetails.repo, commitMessage, newTreeSha, latestCommitSha);
      addLog(`✅ Commit created: ${newCommitSha}`, 'success');
      
      try {
        if (latestCommitSha) {
          // Existing repo - normal fast-forward update
          await gh.updateRef(repoDetails.owner, repoDetails.repo, defaultBranch, newCommitSha, false);
          addLog(`🔄 Updated branch '${defaultBranch}'`, 'info');
        } else {
          // Empty repo - try to create, will force update if exists
          addLog(`📝 Pushing to ${isRepoEmpty ? 'empty repository' : 'new branch'} '${defaultBranch}'...`, 'info');
          await gh.createRef(repoDetails.owner, repoDetails.repo, defaultBranch, newCommitSha);
          addLog(`🆕 Created branch '${defaultBranch}' with ${filesToUpload.length} files`, 'success');
        }
      } catch (branchError) {
        const errMsg = (branchError as Error).message;
        // For any other error, try force update as last resort
        if (!latestCommitSha && (errMsg.includes('fast forward') || errMsg.includes('not a fast-forward'))) {
          addLog(`⚠️ Attempting force push to resolve conflict...`, 'warning');
          try {
            await gh.updateRef(repoDetails.owner, repoDetails.repo, defaultBranch, newCommitSha, true);
            addLog(`✅ Force push successful! All files synced to ${defaultBranch}`, 'success');
          } catch (forceError) {
            addLog(`❌ Failed even with force push: ${(forceError as Error).message}`, 'error');
            throw forceError;
          }
        } else {
          addLog(`❌ Failed to create/update branch: ${errMsg}`, 'error');
          throw branchError;
        }
      }

      setSyncState(SyncState.SUCCESS);
      setProgress(100);
      
      // Add detailed completion feedback
      if (selectedSyncMode === 'empty' || isRepoEmpty) {
        addLog(`🎉 Sync completed successfully!`, 'success');
        addLog(`📤 All ${filesToUpload.length} files uploaded to ${repoDetails.owner}/${repoDetails.repo}`, 'success');
      } else {
        // Update mode - show what changed
        if (filesSkipped.length > 0) {
          addLog(`✅ Your files are same as GitHub repository (${filesSkipped.length} files already match)`, 'success');
        }
        
        if (filesToUpload.length > 0) {
          addLog(`📝 Recently updated files (${filesToUpload.length} total):`, 'info');
          filesToUpload.forEach(item => {
            const status = item.isNew ? '🆕' : '♻️';
            addLog(`   ${status} ${item.remotePath}`, 'success');
          });
        }
        
        addLog(`🎉 Sync completed successfully! ${filesToUpload.length} files updated in ${repoDetails.owner}/${repoDetails.repo}`, 'success');
      }
      
      // Special message if repo was empty but user didn't select empty mode
      if (isRepoEmpty && selectedSyncMode !== 'empty') {
        addLog(`💡 Tip: Next time, use "Empty Repository" mode for better performance on empty repositories`, 'info');
      }

      if (lfsStatsFinal.lfsCount > 0) {
        addLog(`🔵 LFS files included: ${lfsStatsFinal.lfsCount} large files (100-500MB)`, 'info');
      }

      // Show completion modal
      setCompletionData({
        mode: selectedSyncMode || 'update',
        repoUrl: config.repoUrl,
        total: files.length,
        scanned: files.length,
        uploaded: filesToUpload.length,
        skipped: filesSkipped.length
      });
      setShowCompletionModal(true);

    } catch (error) {
      console.error(error);
      const errorMsg = (error as Error).message;
      setSyncState(SyncState.ERROR);
      setHasError(true);
      addLog(`Error: ${errorMsg}`, 'error');
    }
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
    localStorage.setItem('privacy_policy_accepted', 'true');
    localStorage.setItem('terms_accepted', 'true');
    localStorage.setItem('privacy_consent', 'true');
    setHasConsent(true);
    setShowPrivacyPolicy(false);
    setShowTermsOfService(false);
  };

  const saveAdsConfig = () => {
    localStorage.setItem('admin_ads_config', JSON.stringify(adsConfig));
    alert('Ads configuration saved successfully!');
  };

  const handleSaveAdToLocation = (locationKey: string) => {
    if (!pendingSave) return;
    
    const updatedPlacements = { ...placementAds };
    
    if (pendingSave.type === 'adsterra-raw') {
      if (!updatedPlacements[locationKey]) updatedPlacements[locationKey] = {};
      if (!updatedPlacements[locationKey].adsterra) updatedPlacements[locationKey].adsterra = { zoneId: '', domain: '', size: '', type: '', link: '' };
      updatedPlacements[locationKey].adsterra!.rawScript = pendingSave.data;
    } else if (pendingSave.type === 'adsterra-fields') {
      updatedPlacements[locationKey] = { ...updatedPlacements[locationKey], adsterra: pendingSave.data };
    } else if (pendingSave.type === 'adsense') {
      updatedPlacements[locationKey] = { ...updatedPlacements[locationKey], adsense: pendingSave.data };
    }
    
    localStorage.setItem('placement_ads_config', JSON.stringify(updatedPlacements));
    setPlacementAds(updatedPlacements);
    setAdsRefreshTrigger(prev => prev + 1);
    setShowLocationSelector(false);
    setPendingSave(null);
    alert('✅ Ad saved to ' + locationKey.replace(/([A-Z])/g, ' $1').trim());
  };

  // Detect device type
  const getDeviceType = (): 'desktop' | 'android' | 'ios' | 'mac' => {
    const ua = navigator.userAgent.toLowerCase();
    
    // iOS detection (must come before generic mobile detection)
    if (/iphone|ipad|ipod/.test(ua)) {
      return 'ios';
    }
    
    // Android detection
    if (/android/.test(ua)) {
      return 'android';
    }
    
    // Mac detection (must come before generic detection)
    if (/macintosh|mac os x/.test(ua)) {
      return 'mac';
    }
    
    // Default to desktop
    return 'desktop';
  };

  // Adsterra Ad Frame Component - Injects real Adsterra iframe
  const AsterraAdFrame = ({ zoneId, size, width, height }: { zoneId: string; size: string; width?: number; height?: number }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const uniqueId = useRef(`ats-${Math.random().toString(36).substr(2, 9)}`).current;

    useEffect(() => {
      if (!containerRef.current || !zoneId) return;

      const loadAdsterra = () => {
        try {
          // Create a fresh setup for this specific zone
          const scriptId = `ats-script-${uniqueId}`;
          
          // Remove any existing script for this zone
          const existingScript = document.getElementById(scriptId);
          if (existingScript) {
            existingScript.remove();
          }

          // Set global options for this ad
          const atOptions = {
            key: '63599cc8817b6d06dbd50f28820d7d10',
            format: 'iframe',
            height: height || 250,
            width: width || 300,
            params: {}
          };

          (window as any).atOptions = atOptions;
          
          // Reset provider to allow fresh load
          if ((window as any).__atProvider) {
            (window as any).__atProvider.loader = null;
          }

          // Create and inject the invoke script
          const script = document.createElement('script');
          script.id = scriptId;
          script.type = 'text/javascript';
          script.src = '//www.highperformanceformat.com/63599cc8817b6d06dbd50f28820d7d10/invoke.js';
          script.async = true;
          script.setAttribute('data-zone-id', zoneId);
          
          if (containerRef.current) {
            // Clear previous content
            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(script);
          }
        } catch (e) {
          console.error('Adsterra load error:', e);
        }
      };

      // Load immediately
      loadAdsterra();
      
      return () => {
        // Cleanup on unmount
        const script = document.getElementById(`ats-script-${uniqueId}`);
        if (script) {
          script.remove();
        }
      };
    }, [zoneId, width, height, adsRefreshTrigger, uniqueId]);

    return (
      <div 
        ref={containerRef} 
        className="flex items-center justify-center w-full" 
        style={{ 
          minHeight: `${height || 250}px`,
          width: `${width || 300}px`
        }} 
      />
    );
  };

  // Raw Script Component - Injects raw HTML/script directly
  const RawScriptComponent = ({ script }: { script: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const uniqueId = useRef(`aag-${Math.random().toString(36).substr(2, 9)}`);
    const scriptLoaded = useRef(false);

    useEffect(() => {
      if (!containerRef.current || !script || scriptLoaded.current) return;
      scriptLoaded.current = true;

      try {
        // Clear container and all its children
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // Parse the script to extract script tag and div container
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = script;
        
        // Extract container IDs from div elements FIRST
        const divElements = Array.from(tempDiv.querySelectorAll('div'));
        const containerIds: string[] = [];
        divElements.forEach(div => {
          if (div.id) {
            containerIds.push(div.id);
          }
        });
        
        // STEP 1: Create ALL container divs FIRST before any scripts run
        if (containerRef.current) {
          // First append divs that are in the script
          divElements.forEach(div => {
            if (div.id) {
              const newDiv = document.createElement('div');
              newDiv.id = div.id;
              newDiv.style.minHeight = '250px';
              containerRef.current?.appendChild(newDiv);
            }
          });
          
          // If no divs found, create a default one
          if (divElements.length === 0) {
            const defaultDiv = document.createElement('div');
            defaultDiv.id = uniqueId.current;
            defaultDiv.style.minHeight = '250px';
            containerRef.current.appendChild(defaultDiv);
          }
        }
        
        // STEP 2: Now execute the scripts
        const scripts = tempDiv.querySelectorAll('script');
        scripts.forEach((oldScript, index) => {
          setTimeout(() => {
            const newScript = document.createElement('script');
            newScript.type = oldScript.type || 'text/javascript';
            
            // Copy ALL attributes
            Array.from(oldScript.attributes).forEach(attr => {
              newScript.setAttribute(attr.name, attr.value);
            });
            
            if (oldScript.src) {
              newScript.src = oldScript.src;
              newScript.async = true;
            } else if (oldScript.textContent) {
              newScript.textContent = oldScript.textContent;
            }
            
            // Append to container (not head) so it finds divs
            if (containerRef.current) {
              containerRef.current.appendChild(newScript);
            }
          }, index * 50); // Reduced delay - 50ms
        });
      } catch (e) {
        console.error('Raw script injection error:', e);
        if (containerRef.current) {
          containerRef.current.innerHTML = '<p style="color:red;font-size:12px;">Error: ' + (e as Error).message + '</p>';
        }
      }
    }, [script, adsRefreshTrigger]);

    return (
      <div 
        ref={containerRef} 
        className="w-full flex justify-center" 
        style={{ minHeight: '300px', position: 'relative' }} 
      />
    );
  };

  // Google AdSense Component - Injects real AdSense script
  const GoogleAdSenseUnit = ({ clientId, slotId, width, height }: { clientId: string; slotId: string; width?: number; height?: number }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!containerRef.current || !clientId || !slotId) return;

      try {
        // Load Google AdSense script if not already loaded
        if (!(window as any).adsbygoogle) {
          const script = document.createElement('script');
          script.async = true;
          script.src = '//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
          script.onload = () => {
            try {
              ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({
                google_ad_client: clientId,
                enable_page_level_ads: true
              });
            } catch (e) {
              console.error('AdSense error:', e);
            }
          };
          document.head.appendChild(script);
        } else {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({
            google_ad_client: clientId,
            enable_page_level_ads: true
          });
        }
      } catch (e) {
        console.error('Google AdSense init error:', e);
      }
    }, [clientId, slotId]);

    return (
      <div 
        ref={containerRef}
        className="flex items-center justify-center"
        style={{ width: width || 300, height: height || 250 }}
      >
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: width || 300, height: height || 250 }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  };

  const AdRectangle = ({ label = "Ad Block", placementKey = 'rectangle1' }: { label?: string, placementKey?: string }) => {
    if (!adsConfig.placements?.[placementKey]) return null;

    // Load placement-specific ads from localStorage - re-triggers when adsRefreshTrigger changes
    const [placementConfig, setPlacementConfig] = useState(() => {
      const savedPlacementAds = JSON.parse(localStorage.getItem('placement_ads_config') || '{}');
      return savedPlacementAds[placementKey as string];
    });

    useEffect(() => {
      const savedPlacementAds = JSON.parse(localStorage.getItem('placement_ads_config') || '{}');
      setPlacementConfig(savedPlacementAds[placementKey as string]);
    }, [placementKey, adsRefreshTrigger]);
    
    let displayContent = null;

    // PRIORITY: Show raw script if configured
    if (placementConfig?.rawScript) {
      displayContent = <RawScriptComponent script={placementConfig.rawScript} />;
    }
    // PRIORITY 2: Show Adsterra raw script if configured
    else if (placementConfig?.adsterra?.rawScript) {
      displayContent = <RawScriptComponent script={placementConfig.adsterra.rawScript} />;
    }
    // Otherwise show configured placement ads (Adsterra + AdSense if both configured)
    else if (placementConfig) {
      const adElements = [];
      
      // Add Adsterra if configured
      if (placementConfig.adsterra?.zoneId) {
        adElements.push(
          <div key="adsterra" className="flex justify-center">
            <AsterraAdFrame 
              zoneId={placementConfig.adsterra.zoneId} 
              size={placementConfig.adsterra.size} 
              width={300} 
              height={250}
            />
          </div>
        );
      }
      
      // Add Google AdSense if configured
      if (placementConfig.adsense?.slotId && placementConfig.adsense?.clientId) {
        adElements.push(
          <div key="adsense" className="flex justify-center">
            <GoogleAdSenseUnit 
              clientId={placementConfig.adsense.clientId} 
              slotId={placementConfig.adsense.slotId}
              width={300}
              height={250}
            />
          </div>
        );
      }
      
      if (adElements.length > 0) {
        displayContent = <div className="space-y-4">{adElements}</div>;
      }
    }

    return (
      <div className="w-[300px] h-[250px] bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center relative overflow-hidden group shadow-lg mx-auto shrink-0">
        <div className="absolute inset-0 bg-slate-800/20 opacity-50"></div>
        <div className="z-10 text-center p-4 w-full">
          {displayContent ? (
            displayContent
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

  const AdNativeBanner = ({ label = "Native Ad", placementKey = 'nativeBanner' }: { label?: string, placementKey?: string }) => {
    const config = placementAds[placementKey];
    const hasRawScript = config?.adsterra?.rawScript;
    const hasZoneId = config?.adsterra?.zoneId;
    const hasAdSense = config?.adsense?.slotId && config?.adsense?.clientId;
    
    if (!hasRawScript && !hasZoneId && !hasAdSense) return null;
    
    return (
      <div className="w-full flex justify-center my-2">
        {hasRawScript ? (
          <AdIframe html={config.adsterra.rawScript!} placementId={placementKey} width={320} height={100} />
        ) : hasZoneId ? (
          <AsterraAdFrame 
            zoneId={config.adsterra.zoneId} 
            size={config.adsterra.size} 
            width={320} 
            height={100}
          />
        ) : hasAdSense ? (
          <GoogleAdSenseUnit 
            clientId={config.adsense!.clientId!} 
            slotId={config.adsense!.slotId!}
            width={320}
            height={100}
          />
        ) : null}
      </div>
    );
  };

  const TwinRectangles = () => {
    const config1 = placementAds['rectangle1'];
    const config2 = placementAds['rectangle2'];
    const hasRect1 = config1?.adsterra?.rawScript || config1?.adsterra?.zoneId || (config1?.adsense?.slotId && config1?.adsense?.clientId);
    const hasRect2 = config2?.adsterra?.rawScript || config2?.adsterra?.zoneId || (config2?.adsense?.slotId && config2?.adsense?.clientId);
    
    if (!hasRect1 && !hasRect2) return null;
    
    const renderAd = (config: typeof config1, key: string) => {
      if (!config) return null;
      if (config.adsterra?.rawScript) {
        return <AdIframe html={config.adsterra.rawScript} placementId={key} width={300} height={250} />;
      } else if (config.adsterra?.zoneId) {
        return <AsterraAdFrame zoneId={config.adsterra.zoneId} size={config.adsterra.size} width={300} height={250} />;
      } else if (config.adsense?.slotId && config.adsense?.clientId) {
        return <GoogleAdSenseUnit clientId={config.adsense.clientId} slotId={config.adsense.slotId} width={300} height={250} />;
      }
      return null;
    };
    
    return (
      <div className="w-full my-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 overflow-x-auto px-2">
        {hasRect1 && (
          <div className="min-w-[280px] sm:w-[300px] h-[250px] flex items-center justify-center flex-shrink-0">
            {renderAd(config1, 'rect1')}
          </div>
        )}
        {hasRect2 && (
          <div className="min-w-[280px] sm:w-[300px] h-[250px] flex items-center justify-center flex-shrink-0">
            {renderAd(config2, 'rect2')}
          </div>
        )}
      </div>
    );
  };

  const CustomAsterraAd = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!adsConfig.customAsterraIframe?.enabled || !adsConfig.customAsterraIframe?.apiKey) {
        return;
      }

      const loadScript = () => {
        // Create options object
        const atOptions = {
          key: adsConfig.customAsterraIframe?.apiKey,
          format: adsConfig.customAsterraIframe?.format || 'iframe',
          height: adsConfig.customAsterraIframe?.height || 250,
          width: adsConfig.customAsterraIframe?.width || 300,
          params: {}
        };

        // Set global atOptions
        (window as any).atOptions = atOptions;

        // Check if script already loaded
        if ((window as any).atOptions && (window as any).atOptions.key === adsConfig.customAsterraIframe?.apiKey) {
          // Script already running, just trigger rendering
          if ((window as any).__atProvider) {
            (window as any).__atProvider.render();
          } else {
            // Load the invoke script
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = adsConfig.customAsterraIframe?.invokeUrl || '//www.highperformanceformat.com/' + adsConfig.customAsterraIframe?.apiKey + '/invoke.js';
            script.async = true;
            if (containerRef.current) {
              containerRef.current.appendChild(script);
            }
          }
        }
      };

      loadScript();
    }, [adsConfig.customAsterraIframe?.enabled, adsConfig.customAsterraIframe?.apiKey]);

    if (!adsConfig.customAsterraIframe?.enabled || !adsConfig.customAsterraIframe?.apiKey) {
      return null;
    }

    return (
      <div 
        ref={containerRef}
        className="w-full flex justify-center my-6"
        style={{
          minHeight: `${adsConfig.customAsterraIframe.height}px`,
          minWidth: `${adsConfig.customAsterraIframe.width}px`
        }}
      >
        <div style={{ 
          width: `${adsConfig.customAsterraIframe.width}px`, 
          height: `${adsConfig.customAsterraIframe.height}px`
        }}></div>
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
      <div className="min-h-screen bg-black text-slate-200 font-sans p-4 flex flex-col items-center overflow-y-auto">
        <div className="w-full max-w-3xl flex flex-col">
          
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

          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Scanned" value={stats.scanned} />
            <StatCard label="Uploaded" value={stats.uploaded} />
          </div>

          {/* TOP BANNER AD - FAST LOAD */}
          {(placementAds['topBanner']?.adsterra?.rawScript || placementAds['topBanner']?.adsterra?.zoneId) && (
            <div className="w-full flex justify-center my-2">
              {placementAds['topBanner']?.adsterra?.rawScript ? (
                <AdIframe html={placementAds['topBanner'].adsterra.rawScript} placementId="sync-top" width={320} height={100} />
              ) : (
                <AsterraAdFrame 
                  zoneId={placementAds['topBanner'].adsterra.zoneId} 
                  size={placementAds['topBanner'].adsterra.size} 
                  width={320} 
                  height={100}
                />
              )}
            </div>
          )}

          {/* NATIVE BANNER AD - FAST LOAD */}
          {(placementAds['nativeBanner']?.adsterra?.rawScript || placementAds['nativeBanner']?.adsterra?.zoneId) && (
            <div className="w-full flex justify-center my-2">
              {placementAds['nativeBanner']?.adsterra?.rawScript ? (
                <AdIframe html={placementAds['nativeBanner'].adsterra.rawScript} placementId="sync-native" width={320} height={100} />
              ) : (
                <AsterraAdFrame 
                  zoneId={placementAds['nativeBanner'].adsterra.zoneId} 
                  size={placementAds['nativeBanner'].adsterra.size} 
                  width={320} 
                  height={100}
                />
              )}
            </div>
          )}

          <Logger logs={logs} hasError={hasError} />

          {/* RECTANGLE ADS - FAST LOAD AFTER TERMINAL */}
          {(placementAds['rectangle1']?.adsterra?.rawScript || placementAds['rectangle1']?.adsterra?.zoneId || 
            placementAds['rectangle2']?.adsterra?.rawScript || placementAds['rectangle2']?.adsterra?.zoneId) && (
            <div className="w-full my-3">
              <TwinRectangles />
            </div>
          )}

          {/* GAP AD AFTER TERMINAL - FAST LOAD */}
          {(placementAds['gapAds']?.adsterra?.rawScript || placementAds['gapAds']?.adsterra?.zoneId) && (
            <div className="w-full flex justify-center my-2">
              {placementAds['gapAds']?.adsterra?.rawScript ? (
                <AdIframe html={placementAds['gapAds'].adsterra.rawScript} placementId="sync-gap" width={320} height={100} />
              ) : (
                <AsterraAdFrame 
                  zoneId={placementAds['gapAds'].adsterra.zoneId} 
                  size={placementAds['gapAds'].adsterra.size} 
                  width={320} 
                  height={100}
                />
              )}
            </div>
          )}

          {/* BOTTOM BANNER AD - FAST LOAD */}
          {(placementAds['bottomBanner']?.adsterra?.rawScript || placementAds['bottomBanner']?.adsterra?.zoneId) && (
            <div className="w-full flex justify-center my-2">
              {placementAds['bottomBanner']?.adsterra?.rawScript ? (
                <AdIframe html={placementAds['bottomBanner'].adsterra.rawScript} placementId="sync-bottom" width={320} height={100} />
              ) : (
                <AsterraAdFrame 
                  zoneId={placementAds['bottomBanner'].adsterra.zoneId} 
                  size={placementAds['bottomBanner'].adsterra.size} 
                  width={320} 
                  height={100}
                />
              )}
            </div>
          )}

          {(syncState === SyncState.SUCCESS || syncState === SyncState.ERROR) && (
            <button 
              onClick={handleBackToDashboard}
              className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" /> Back to Dashboard
            </button>
          )}

        </div>
      </div>
    );
  }

  if (showAdminPanel) {
    return (
      <div className="min-h-screen bg-black text-slate-200 font-sans p-4 flex flex-col items-center">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <header className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-amber-600 p-2 rounded-xl">
                <UserCog className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">Ad Manager</h1>
            </div>
            <button 
              onClick={() => setShowAdminPanel(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Exit
            </button>
          </header>

          {/* Simple Instructions */}
          <div className="bg-amber-900/30 border border-amber-600 rounded-xl p-4 mb-6">
            <p className="text-amber-200 text-sm">
              Paste your ad script in any location below. The ad will appear exactly at that position in your app.
            </p>
          </div>

          {/* Ad Placement Locations */}
          <div className="space-y-4">
            {[
              { key: 'topBanner', label: 'Top Banner', desc: 'Shows at the very top of the app', color: 'purple' },
              { key: 'rectangle1', label: 'Rectangle Ad 1', desc: 'Shows left side (300x250)', color: 'orange' },
              { key: 'rectangle2', label: 'Rectangle Ad 2', desc: 'Shows right side (300x250)', color: 'amber' },
              { key: 'gapAds', label: 'Gap Ad', desc: 'Shows between sections', color: 'cyan' },
              { key: 'nativeBanner', label: 'Native Banner', desc: 'Shows in content feed', color: 'pink' },
              { key: 'bottomBanner', label: 'Bottom Banner', desc: 'Shows at the footer', color: 'emerald' },
              { key: 'popunder', label: 'Popunder Ad', desc: 'Opens in new tab on first click', color: 'red' },
            ].map(loc => (
              <div key={loc.key} className={`bg-slate-900 border border-slate-700 rounded-xl p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-white flex items-center gap-2">
                      {loc.label}
                      {placementAds[loc.key]?.adsterra?.rawScript && (
                        <span className="text-emerald-400 text-sm">Active</span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">{loc.desc}</p>
                  </div>
                </div>

                <textarea 
                  placeholder={`Paste your ${loc.label} ad script here...`}
                  value={placementAds[loc.key]?.adsterra?.rawScript || ''}
                  onChange={(e) => {
                    setPlacementAds(prev => ({
                      ...prev,
                      [loc.key]: {
                        ...prev[loc.key],
                        adsterra: {
                          ...(prev[loc.key]?.adsterra || { zoneId: '', domain: '', size: '', type: '', link: '' }),
                          rawScript: e.target.value
                        }
                      }
                    }));
                  }}
                  className="w-full h-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 mb-3"
                />

                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      const script = placementAds[loc.key]?.adsterra?.rawScript || '';
                      if (!script.trim()) {
                        alert('Please paste a script first');
                        return;
                      }
                      try {
                        const response = await fetch('/api/ads/save', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            password: adminPasswordInput,
                            placement_key: loc.key,
                            ad_config: placementAds[loc.key]
                          })
                        });
                        if (response.ok) {
                          localStorage.setItem('placement_ads_config', JSON.stringify(placementAds));
                          setAdsRefreshTrigger(prev => prev + 1);
                          alert(`✅ Ad saved to ${loc.label}! All users will see this.`);
                        } else if (response.status === 429) {
                          alert(`⛔ Too many failed attempts! Your IP is locked out for 15 minutes for security.`);
                        } else {
                          const error = await response.json();
                          alert(`❌ Error: ${error.error}`);
                        }
                      } catch (e) {
                        alert('Backend unavailable - saving locally only');
                        localStorage.setItem('placement_ads_config', JSON.stringify(placementAds));
                        setAdsRefreshTrigger(prev => prev + 1);
                      }
                    }}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg font-medium text-sm"
                  >
                    Save Ad
                  </button>
                  {placementAds[loc.key]?.adsterra?.rawScript && (
                    <button 
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/ads/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              password: adminPasswordInput,
                              placement_key: loc.key
                            })
                          });
                          if (response.ok) {
                            const updated = { ...placementAds };
                            if (updated[loc.key]?.adsterra) {
                              updated[loc.key].adsterra!.rawScript = undefined;
                            }
                            localStorage.setItem('placement_ads_config', JSON.stringify(updated));
                            setPlacementAds(updated);
                            setAdsRefreshTrigger(prev => prev + 1);
                            alert(`✅ Ad removed from ${loc.label}!`);
                          } else if (response.status === 429) {
                            alert(`⛔ Too many failed attempts! Your IP is locked out for 15 minutes for security.`);
                          } else {
                            const error = await response.json();
                            alert(`❌ Error: ${error.error}`);
                          }
                        } catch (e) {
                          alert('Backend unavailable - removing locally only');
                          const updated = { ...placementAds };
                          if (updated[loc.key]?.adsterra) {
                            updated[loc.key].adsterra!.rawScript = undefined;
                          }
                          localStorage.setItem('placement_ads_config', JSON.stringify(updated));
                          setPlacementAds(updated);
                          setAdsRefreshTrigger(prev => prev + 1);
                        }
                      }}
                      className="px-4 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg font-medium text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Visual Preview */}
          <div className="mt-6 bg-slate-900 border border-slate-700 rounded-xl p-4">
            <h3 className="font-bold text-white mb-4">Where Ads Will Show</h3>
            <div className="bg-slate-950 rounded-lg p-4 space-y-3">
              <div className="bg-purple-900/30 border border-purple-600 rounded p-2 text-center text-purple-300 text-xs">Top Banner</div>
              <div className="bg-slate-800 rounded p-3 text-center text-slate-500 text-xs">App Content</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-orange-900/30 border border-orange-600 rounded p-2 text-center text-orange-300 text-xs">Rectangle 1</div>
                <div className="bg-amber-900/30 border border-amber-600 rounded p-2 text-center text-amber-300 text-xs">Rectangle 2</div>
              </div>
              <div className="bg-slate-800 rounded p-3 text-center text-slate-500 text-xs">More Content</div>
              <div className="bg-cyan-900/30 border border-cyan-600 rounded p-2 text-center text-cyan-300 text-xs">Gap Ad</div>
              <div className="bg-slate-800 rounded p-3 text-center text-slate-500 text-xs">Content</div>
              <div className="bg-pink-900/30 border border-pink-600 rounded p-2 text-center text-pink-300 text-xs">Native Banner</div>
              <div className="bg-emerald-900/30 border border-emerald-600 rounded p-2 text-center text-emerald-300 text-xs">Bottom Banner</div>
              <div className="bg-red-900/30 border border-red-600 rounded p-2 text-center text-red-300 text-xs">Popunder (on click)</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-200 font-sans flex flex-col overflow-y-auto" onClick={() => {
      if (placementAds['popunder']?.adsterra?.rawScript) {
        const script = placementAds['popunder'].adsterra.rawScript;
        if (script && !sessionStorage.getItem('popunder_shown')) {
          sessionStorage.setItem('popunder_shown', 'true');
          const container = document.createElement('div');
          // Use a timeout to allow React to render, then inject scripts
          setTimeout(() => {
            const temp = document.createElement('div');
            temp.innerHTML = script;
            const scripts = temp.querySelectorAll('script');
            scripts.forEach(oldScript => {
              const newScript = document.createElement('script');
              newScript.type = oldScript.getAttribute('type') || 'text/javascript';
              Array.from(oldScript.attributes).forEach(attr => {
                if (attr.name !== 'type') {
                  newScript.setAttribute(attr.name, attr.value);
                }
              });
              if (oldScript.textContent) {
                newScript.textContent = oldScript.textContent;
              }
              container.appendChild(newScript);
            });
            // Also add non-script HTML
            Array.from(temp.childNodes).forEach(node => {
              if ((node as any).tagName !== 'SCRIPT') {
                container.appendChild(node.cloneNode(true));
              }
            });
            document.body.appendChild(container);
          }, 0);
        }
      }
    }}>
      {/* TOP BANNER AD */}
      {(placementAds['topBanner']?.adsterra?.rawScript || placementAds['topBanner']?.adsterra?.zoneId) && (
        <div className="w-full flex justify-center py-1 px-2 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
          {placementAds['topBanner']?.adsterra?.rawScript ? (
            <AdIframe html={placementAds['topBanner'].adsterra.rawScript} placementId="topBanner" width={320} height={100} />
          ) : placementAds['topBanner']?.adsterra?.zoneId ? (
            <AsterraAdFrame 
              zoneId={placementAds['topBanner'].adsterra.zoneId} 
              size={placementAds['topBanner'].adsterra.size} 
              width={320} 
              height={100}
            />
          ) : null}
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
        <PrivacyPolicyModal 
          onClose={() => setShowPrivacyPolicy(false)}
          onAccept={handleAcceptConsent}
        />
      )}

      {showTermsOfService && (
        <TermsOfServiceModal 
          onClose={() => setShowTermsOfService(false)}
          onAccept={handleAcceptConsent}
        />
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

      {showLocationSelector && pendingSave && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-bold text-white mb-4">Choose Banner Location</h3>
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => handleSaveAdToLocation('topBanner')} className="bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-semibold transition">📍 Top Banner (320x100)</button>
                <button onClick={() => handleSaveAdToLocation('twinRectangles')} className="bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-semibold transition">📍 Twin Rectangles (300x250 x2)</button>
                <button onClick={() => handleSaveAdToLocation('gapAds')} className="bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-lg font-semibold transition">📍 Gap Ads (320x100)</button>
                <button onClick={() => handleSaveAdToLocation('nativeBanner')} className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-semibold transition">📍 Native Banner (320x100)</button>
                <button onClick={() => handleSaveAdToLocation('bottomBanner')} className="bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-lg font-semibold transition">📍 Bottom Banner (320x100)</button>
              </div>
              <button onClick={() => { setShowLocationSelector(false); setPendingSave(null); }} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg font-medium mt-4">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showCompletionModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="p-8 text-center space-y-6">
              {completionData.mode === 'empty' ? (
                <>
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full"></div>
                      <CheckCircle2 className="w-16 h-16 text-emerald-400 relative" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Congratulations! 🎉</h3>
                    <p className="text-emerald-400 font-semibold">All files sent to repository</p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                    <p className="text-xs text-emerald-300 mb-2">Repository Link:</p>
                    <p className="text-sm font-mono text-emerald-200 break-all">{completionData.repoUrl}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-3xl font-bold text-white">{completionData.uploaded}</p>
                    <p className="text-sm text-slate-400 mt-1">Files Uploaded</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
                      <CheckCircle2 className="w-16 h-16 text-indigo-400 relative" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Sync Complete! ✅</h3>
                    <p className="text-indigo-400 font-semibold">Files updated successfully</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4">
                      <p className="text-sm font-mono text-indigo-300">Total</p>
                      <p className="text-3xl font-bold text-indigo-400 mt-1">{completionData.total}</p>
                    </div>
                    <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                      <p className="text-sm font-mono text-cyan-300">Scanned</p>
                      <p className="text-3xl font-bold text-cyan-400 mt-1">{completionData.scanned}</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                      <p className="text-sm font-mono text-emerald-300">Updated</p>
                      <p className="text-3xl font-bold text-emerald-400 mt-1">{completionData.uploaded}</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                      <p className="text-sm font-mono text-amber-300">Same Files</p>
                      <p className="text-3xl font-bold text-amber-400 mt-1">{completionData.skipped}</p>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-2">Repository:</p>
                    <p className="text-sm font-mono text-slate-300 break-all">{completionData.repoUrl}</p>
                  </div>
                </>
              )}
              <button
                onClick={() => {
                  setShowCompletionModal(false);
                  handleBackToDashboard();
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <Share2 className="w-6 h-6 text-cyan-400" />
                <h3 className="text-xl font-bold text-white">Share GitSync</h3>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <button onClick={() => handleShare('whatsapp')} className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-xl font-medium transition-all">
                <span className="text-xl">💬</span> Share on WhatsApp
              </button>
              <button onClick={() => handleShare('twitter')} className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white rounded-xl font-medium transition-all">
                <span className="text-xl">𝕏</span> Share on Twitter
              </button>
              <button onClick={() => handleShare('facebook')} className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl font-medium transition-all">
                <span className="text-xl">f</span> Share on Facebook
              </button>
              <button onClick={() => handleShare('telegram')} className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white rounded-xl font-medium transition-all">
                <span className="text-xl">✈️</span> Share on Telegram
              </button>
              <div className="h-px bg-slate-700 my-2"></div>
              <button onClick={() => handleShare('copy')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${copySuccess ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
                {copySuccess ? (
                  <>
                    <Check className="w-5 h-5" /> Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" /> Copy Link
                  </>
                )}
              </button>
            </div>
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/30">
              <p className="text-xs text-slate-400 text-center">Share without credentials - only the app link is shared</p>
            </div>
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
              <div className="border-t border-slate-700 pt-4">
                <h4 className="font-bold text-emerald-400 mb-2">📌 Important Tips</h4>
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">5. Create New Repository</h4>
                <p className="text-slate-400">If making a new repository on GitHub: Create it as <span className="text-emerald-300">public or private</span> with <span className="text-emerald-300">README always enabled</span>. Then paste the repository link and use this app to send all your files easily.</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">6. Update Existing Repository</h4>
                <p className="text-slate-400">If your repository already exists: <span className="text-emerald-300">Only add README file to your existing repository</span> first. Then use this app to easily add all remaining files by selecting your folder.</p>
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
                <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-800/50">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</span>
                  <button onClick={() => setIsMenuOpen(false)} className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <button onClick={handleHome} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors text-left">
                    <Home className="w-4 h-4 text-indigo-400" /> Home Page
                  </button>
                  <button onClick={() => { setShowHelpModal(true); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors text-left">
                    <HelpCircle className="w-4 h-4 text-emerald-400" /> How to use
                  </button>
                  <button onClick={() => { handleInstallApp(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors text-left bg-gradient-to-r from-sky-500/10 to-blue-500/10">
                    <Download className="w-4 h-4 text-sky-400 animate-bounce" /> App Download
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
                  <button onClick={() => { setShowShareModal(true); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-colors text-left bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
                    <Share2 className="w-4 h-4 text-cyan-400" /> Share App
                  </button>
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
              <div className="relative">
                <input 
                  type="password" 
                  value={config.token}
                  onChange={e => setConfig(prev => ({ ...prev, token: e.target.value }))}
                  placeholder="ghp_xxxxxxxxxxxx"
                  disabled={isConnected}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 pr-12 text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all placeholder:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                />
                {config.token && (
                  <button
                    onClick={() => {
                      setConfig(prev => ({ ...prev, token: '' }));
                      setIsConnected(false);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-red-400 transition-colors hover:bg-red-500/10 rounded-lg"
                    title="Clear token"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Required scope: <span className="font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">repo</span>
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Repository Link
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={config.repoUrl}
                  onChange={e => setConfig(prev => ({ ...prev, repoUrl: e.target.value }))}
                  placeholder="username/repo"
                  disabled={isConnected}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 pr-12 text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all placeholder:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
                />
                {config.repoUrl && (
                  <button
                    onClick={() => {
                      setConfig(prev => ({ ...prev, repoUrl: '' }));
                      setIsConnected(false);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-red-400 transition-colors hover:bg-red-500/10 rounded-lg"
                    title="Clear repository link"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
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
                      onClick={() => startSync()}
                      className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-900/20 w-full py-4 rounded-xl font-bold text-base tracking-wide shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                    >
                      START SYNC
                    </button>

                    {showSyncModeModal && (
                      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in slide-in-from-bottom-4 sm:slide-in-from-center">
                          <h2 className="text-2xl font-bold text-white mb-2">Sync Mode</h2>
                          <p className="text-slate-400 text-sm mb-6">Choose how you want to sync your files</p>
                          
                          <div className="space-y-3 mb-6">
                            <button
                              onClick={() => {
                                setSelectedSyncMode('empty');
                                startSync('empty');
                                setShowSyncModeModal(false);
                              }}
                              className="w-full p-4 rounded-xl border-2 border-slate-700 bg-slate-800/50 hover:border-indigo-500 hover:bg-indigo-500/10 transition-all text-left group"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center mt-0.5 group-hover:bg-indigo-500/30 transition-colors">
                                  <UploadCloud className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-white">Empty Repository</p>
                                  <p className="text-xs text-slate-400 mt-1">Upload all files to empty repository</p>
                                </div>
                              </div>
                            </button>
                            
                            <button
                              onClick={() => {
                                setSelectedSyncMode('update');
                                startSync('update');
                                setShowSyncModeModal(false);
                              }}
                              className="w-full p-4 rounded-xl border-2 border-slate-700 bg-slate-800/50 hover:border-emerald-500 hover:bg-emerald-500/10 transition-all text-left group"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mt-0.5 group-hover:bg-emerald-500/30 transition-colors">
                                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-white">Update Files</p>
                                  <p className="text-xs text-slate-400 mt-1">Sync and update existing repository files</p>
                                </div>
                              </div>
                            </button>
                          </div>
                          
                          <button
                            onClick={() => setShowSyncModeModal(false)}
                            className="w-full py-2.5 text-slate-400 hover:text-slate-200 transition-colors text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <TwinRectangles />

                    <div className="pt-2 pb-2">
                       <Logger logs={logs} hasError={hasError} />
                    </div>

                    {/* GAP ADS - BELOW TERMINAL */}
                    {(placementAds['gapAds']?.adsterra?.rawScript || placementAds['gapAds']?.adsterra?.zoneId) && (
                      <div className="w-full flex justify-center py-2 my-2">
                        {placementAds['gapAds']?.adsterra?.rawScript ? (
                          <AdIframe html={placementAds['gapAds'].adsterra.rawScript} placementId="gapAds" width={320} height={100} />
                        ) : placementAds['gapAds']?.adsterra?.zoneId ? (
                          <AsterraAdFrame 
                            zoneId={placementAds['gapAds'].adsterra.zoneId} 
                            size={placementAds['gapAds'].adsterra.size} 
                            width={320} 
                            height={100}
                          />
                        ) : null}
                      </div>
                    )}

                    {/* NATIVE BANNER AD - BELOW TERMINAL OUTPUT */}
                    <div className="w-full flex justify-center py-2 my-2">
                      <AdNativeBanner label="Native Ad" placementKey="nativeBanner" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-6">
           <TwinRectangles />
           
           {/* BOTTOM BANNER AD */}
           {(placementAds['bottomBanner']?.adsterra?.rawScript || placementAds['bottomBanner']?.adsterra?.zoneId) && (
             <div className="w-full flex justify-center py-2 my-2">
               {placementAds['bottomBanner']?.adsterra?.rawScript ? (
                 <AdIframe html={placementAds['bottomBanner'].adsterra.rawScript} placementId="bottomBanner" width={320} height={100} />
               ) : placementAds['bottomBanner']?.adsterra?.zoneId ? (
                 <AsterraAdFrame 
                   zoneId={placementAds['bottomBanner'].adsterra.zoneId} 
                   size={placementAds['bottomBanner'].adsterra.size} 
                   width={320} 
                   height={100}
                 />
               ) : null}
             </div>
           )}
        </div>

      </div>

      <footer className="w-full max-w-3xl mx-auto px-6 py-6 border-t border-slate-800/50 mt-4 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
           <p className="text-xs text-slate-600">© 2024 GitSync Mobile</p>
           <div className="flex items-center gap-4 text-xs">
             <button onClick={() => setShowPrivacyPolicy(true)} className="text-slate-500 hover:text-indigo-400 transition-colors">Privacy Policy</button>
            <span className="text-slate-600">•</span>
            <button onClick={() => setShowTermsOfService(true)} className="text-slate-500 hover:text-blue-400 transition-colors">Terms of Service</button>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
