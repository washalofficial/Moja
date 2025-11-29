# GitSync Mobile

A powerful, mobile-first web tool to sync local folders directly to GitHub repositories while preserving directory structure WITHOUT creating wrapper folders.

## Overview

GitSync Mobile allows users to:
- ✅ Connect to GitHub repositories using Personal Access Tokens
- ✅ Select local folders and sync ONLY the folder contents (NOT the folder itself)
- ✅ Files and subfolders sync directly to repo root with proper structure
- ✅ NO wrapper folder created - files appear openly in repo
- ✅ Smart sync that only uploads changed files (uses SHA comparison)
- ✅ Optional AI-generated commit messages using Google Gemini
- ✅ Delete remote files that no longer exist locally
- ✅ Admin panel for ad configuration
- ✅ Support for large files via GitHub LFS (100-500MB)
- ✅ Full Unicode support (international characters, CJK, etc.)

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (via CDN)
- **Icons**: Lucide React
- **AI**: Google Gemini API (optional, for commit messages)

## Project Structure

```
├── App.tsx                 # Main application component
├── index.tsx               # React entry point
├── index.html              # HTML template
├── types.ts                # TypeScript type definitions
├── vite.config.ts          # Vite configuration
├── components/
│   ├── Logger.tsx          # Terminal-style log display
│   ├── PrivacyPolicyModal.tsx  # Privacy policy modal
│   └── ConsentBanner.tsx   # Cookie consent banner
├── services/
│   ├── githubService.ts    # GitHub API client
│   └── geminiService.ts    # Gemini AI integration
└── utils/
    ├── fileUtils.ts        # File utilities (base64, SHA, path sanitization)
    └── lfsUtils.ts         # Large file handling (LFS categorization)
```

## Running the App

The development server runs on port 5000:

```bash
npm run dev
```

## Environment Variables

For deployment, add these environment variables:

- `VITE_ADMIN_PASSWORD`: Admin panel password (required for admin access)
- `VITE_GEMINI_API_KEY` (optional): Google Gemini API key for AI-generated commit messages

## Features

1. **✅ Bulletproof Folder Flattening**: Syncs folder contents to repo root WITHOUT wrapper
   - Select: `MyFolder/components/App.tsx`
   - Result: `repo-root/components/App.tsx` (NOT `repo-root/MyFolder/...`)

2. **✅ Universal GitHub Integration**: Works with ALL repository types
   - Public repositories ✅
   - Private repositories ✅ (with token 'repo' permissions)
   - Empty repositories ✅
   - Repositories with or without README ✅
   - Any branch configuration ✅

3. **Smart Sync**: Computes Git blob SHA to skip unchanged files

4. **Branch Support**: Target any branch, creates new branches if needed

5. **Target Path**: Sync to a specific subfolder in the repository

6. **Delete Missing**: Option to remove files from remote that don't exist locally

7. **AI Commit Messages**: Uses Gemini to generate descriptive commit messages

8. **Admin Panel**: Configure ad placements and networks (password protected)

9. **LFS Support**: Automatic GitHub LFS for files 100-500MB

10. **Full Structure Preservation**: All subfolders, empty files, nested structures maintained

11. **Unicode Support**: Handles any language/character encoding

12. **✅ PWA Installation**: Install as mobile app on iOS and Android devices

13. **✅ Sync Mode Selection**: Choose between "Empty Repository" or "Update Files" modes

## How It Works

### Syncing a Folder

1. **Select Folder**: User selects a folder (e.g., "Gitsync-Mobile-plus-PC-1")
2. **Root Detection**: Tool identifies the root folder name
3. **Aggressive Stripping**: Removes root folder name from ALL file paths
4. **Root Sync**: Contents sync to repo root WITHOUT wrapper folder

### Path Processing

```
Input File: MyFolder/components/Logger.tsx
↓
Root Detected: MyFolder
↓
Strip Root: components/Logger.tsx
↓
GitHub Result: repo-root/components/Logger.tsx ✅
```

### Large Files

- **<100MB**: Normal upload
- **100-500MB**: GitHub LFS (automatic)
- **>500MB**: Blocked with error message

## Recent Changes

- November 29, 2025: **UNIVERSAL REPOSITORY SUPPORT COMPLETE** ✅
  - Works with PUBLIC repositories ✅
  - Works with PRIVATE repositories (token 'repo' permissions) ✅
  - Works with EMPTY repositories ✅
  - Works with repositories WITH or WITHOUT README ✅
  - Smart sync mode selection: "Empty Repository" vs "Update Files" modes
  - Intelligent force push for empty repo conflicts
  - Clear error messages for all repository types
- November 29, 2025: **SYNC MODE SELECTION MODAL** ✅
  - Beautiful modal popup when clicking "START SYNC"
  - Option 1: Empty Repository - upload all files to empty repos
  - Option 2: Update Files - sync and update existing repositories
  - Mobile-friendly with smooth animations
- November 29, 2025: **EMPTY REPOSITORY SUPPORT** ✅
  - Explicit empty repo detection
  - Automatic force push for empty repo branch conflicts
  - Handles "Update is not a fast forward" errors gracefully
- November 29, 2025: **PWA INSTALLATION** ✅
  - Install App button in menu
  - Android native install prompt
  - iOS "Add to Home Screen" support
- November 28, 2025: **BULLETPROOF ANTI-WRAPPER SYSTEM COMPLETE** ✅
  - Files sync ONLY as contents, NEVER with wrapper folder
  - Triple-layer validation and error handling
- November 28, 2025: Full folder structure preservation, LFS support, Unicode support

## Technical Implementation

### Bulletproof Folder Stripping Algorithm

**Three-Layer Protection Against Wrapper Folders:**

```javascript
// LAYER 1: Root Detection
const rootPrefix = firstPath.split('/')[0]; // "MyFolder"
setRootFolderName(rootPrefix); // Track for validation

// LAYER 2: Aggressive Path Stripping using substring()
if (filePath.startsWith(rootPrefix + '/')) {
  filePath = filePath.substring(rootPrefix.length + 1);
}
// "MyFolder/components/App.tsx" → "components/App.tsx"

// LAYER 3: Pre-Sync Guardian Validation
if (rootFolderName) {
  const badPaths = files.filter(f => 
    f.path.includes(rootFolderName) || 
    f.path.startsWith(rootFolderName + '/') ||
    f.path === rootFolderName
  );
  if (badPaths.length > 0) {
    // BLOCK SYNC - show error to user
    return;
  }
}

// Result: Only clean files sync to GitHub at repo root ✅
```

**Key Features:**
- Atomic `substring()` operation - cannot fail
- Detects root folder from FIRST file with path structure
- Strips root prefix from EVERY SINGLE FILE
- Pre-sync validation blocks upload if ANY file contains folder name
- Triple-check with case-insensitive matching
- Files appear directly in repo without wrapper

## Troubleshooting

### Files Still Appearing in Wrapper Folder

This should no longer happen with the new bulletproof algorithm. If it does:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Select a folder and look for:
   - `✅ ROOT FOLDER DETECTED: [FolderName]`
   - Path transformation logs
4. Verify paths show as `components/App.tsx` (not `FolderName/components/App.tsx`)

### Debug Logs

When you select a folder, console will show:
```
✅ ROOT FOLDER DETECTED: Gitsync-Mobile-plus-PC-1
📁 TOTAL FILES: 42
  [0] Gitsync-Mobile-plus-PC-1/App.tsx → App.tsx
  [1] Gitsync-Mobile-plus-PC-1/components/Logger.tsx → components/Logger.tsx
  [2] Gitsync-Mobile-plus-PC-1/services/githubService.ts → services/githubService.ts
```

## User Preferences & Guarantees

### Folder Wrapper Prevention
- **Koi bi folder upload krne par us folder ki only files will sync, folder show nahi hoga** ✅
- Any folder you upload → ONLY its files sync to GitHub
- Folder name NEVER appears in repository
- Files appear directly at repo root without wrapper
- 100% bulletproof three-layer validation system

### User Experience
- Folder stripping is transparent and automatic
- All operations logged to terminal for full visibility
- Simple, direct sync without extra steps or options
- Files sync directly to repo root with full structure preserved
- Pre-sync validation ensures files are clean before upload

## Deployment

Ready to deploy to Vercel at `gitsync-mobile-plus-pc.vercel.app`

1. Push to your GitHub repository
2. Connect to Vercel
3. Deploy with environment variables configured
4. All features work seamlessly!
