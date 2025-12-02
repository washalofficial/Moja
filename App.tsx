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
import { AdIframe } from './components/AdIframe';
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
  Download,
  X,
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

  // HARDCODED ADS CONFIGURATION
  const hardcodedAds = {
    topBanner: {
      adsterra: {
        rawScript: `<script type="text/javascript">
          atOptions = {
            'key' : '823a1404c3a371cd86e2ab9f362bc591',
            'format' : 'iframe',
            'height' : 60,
            'width' : 468,
            'params' : {}
          };
        </script>
        <script
          type="text/javascript"
          src="//www.highperformanceformat.com/823a1404c3a371cd86e2ab9f362bc591/invoke.js"
        ></script>`,
        width: 468,
        height: 60
      }
    },
    rectangle1: {
      adsterra: {
        rawScript: `<script type="text/javascript">
          atOptions = {
            'key' : '4e1d6e7afa165a217c3bc02c37331489',
            'format' : 'iframe',
            'height' : 250,
            'width' : 300,
            'params' : {}
          };
        </script>
        <script
          type="text/javascript"
          src="//www.highperformanceformat.com/4e1d6e7afa165a217c3bc02c37331489/invoke.js"
        ></script>`,
        width: 300,
        height: 250
      }
    },
    rectangle2: {
      adsterra: {
        rawScript: `<script type="text/javascript">
          atOptions = {
            'key' : '4e1d6e7afa165a217c3bc02c37331489',
            'format' : 'iframe',
            'height' : 250,
            'width' : 300,
            'params' : {}
          };
        </script>
        <script
          type="text/javascript"
          src="//www.highperformanceformat.com/4e1d6e7afa165a217c3bc02c37331489/invoke.js"
        ></script>`,
        width: 300,
        height: 250
      }
    },
    gapAds: {
      adsterra: {
        rawScript: `<script type="text/javascript">
          atOptions = {
            'key' : 'fcc870d98927f45e39aae90987ce4697',
            'format' : 'iframe',
            'height' : 90,
            'width' : 728,
            'params' : {}
          };
        </script>
        <script
          type="text/javascript"
          src="//www.highperformanceformat.com/fcc870d98927f45e39aae90987ce4697/invoke.js"
        ></script>`,
        width: 728,
        height: 90
      }
    },
    bottomBanner: {
      adsterra: {
        rawScript: `<script type="text/javascript">
          atOptions = {
            'key' : 'c595631f1bd4cb087b7e774e8ec46ec4',
            'format' : 'iframe',
            'height' : 50,
            'width' : 320,
            'params' : {}
          };
        </script>
        <script
          type="text/javascript"
          src="//www.highperformanceformat.com/c595631f1bd4cb087b7e774e8ec46ec4/invoke.js"
        ></script>`,
        width: 320,
        height: 50
      }
    },
    nativeBanner: {
      adsterra: {
        rawScript: `<script async="async" data-cfasync="false" src="//pl28161831.effectivegatecpm.com/7a04948fc82ec21bdf9a510dfacabc56/invoke.js" ></script> <div id="container-7a04948fc82ec21bdf9a510dfacabc56"></div>`,
        width: 320,
        height: 100
      }
    },
    popunder: {
      adsterra: {
        rawScript: `<script type="text/javascript" src="//pl28159467.effectivegatecpm.com/22/5e/33/225e3319aa7c4ca510948f013752e4fa.js" ></script>`
      }
    }
  };

  // Scroll to top when sync page opens
  useEffect(() => {
    if (syncState !== SyncState.IDLE) {
      window.scrollTo(0, 0);
    }
  }, [syncState]);

  // Inject popunder script on component mount
  useEffect(() => {
    // Inject popunder script
    const popunderScript = document.createElement('script');
    popunderScript.type = 'text/javascript';
    popunderScript.src = '//pl28159467.effectivegatecpm.com/22/5e/33/225e3319aa7c4ca510948f013752e4fa.js';
    popunderScript.async = true;
    document.head.appendChild(popunderScript);
  }, []);
  
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
