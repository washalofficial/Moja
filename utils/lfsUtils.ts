export interface FileSizeAnalysis {
  normal: Array<{ path: string; size: number }>;
  lfs: Array<{ path: string; size: number }>;
  blocked: Array<{ path: string; size: number }>;
  empty: Array<{ path: string }>;
}

export interface LFSStats {
  normalCount: number;
  lfsCount: number;
  blockedCount: number;
  emptyCount: number;
  totalNormalSize: number;
  totalLFSSize: number;
}

const NORMAL_LIMIT = 100 * 1024 * 1024;
const LFS_LIMIT = 500 * 1024 * 1024;

export const analyzeLargeFiles = (files: Array<{ path: string; file: File }>): FileSizeAnalysis => {
  const analysis: FileSizeAnalysis = {
    normal: [],
    lfs: [],
    blocked: [],
    empty: []
  };

  for (const item of files) {
    const size = item.file.size;

    if (size === 0) {
      analysis.empty.push({ path: item.path });
    } else if (size > LFS_LIMIT) {
      analysis.blocked.push({ path: item.path, size });
    } else if (size > NORMAL_LIMIT) {
      analysis.lfs.push({ path: item.path, size });
    } else {
      analysis.normal.push({ path: item.path, size });
    }
  }

  return analysis;
};

export const generateLFSStats = (analysis: FileSizeAnalysis): LFSStats => {
  const totalNormalSize = analysis.normal.reduce((sum, f) => sum + f.size, 0);
  const totalLFSSize = analysis.lfs.reduce((sum, f) => sum + f.size, 0);

  return {
    normalCount: analysis.normal.length,
    lfsCount: analysis.lfs.length,
    blockedCount: analysis.blocked.length,
    emptyCount: analysis.empty.length,
    totalNormalSize,
    totalLFSSize
  };
};

export const shouldUseLFS = (fileSize: number): boolean => {
  return fileSize > NORMAL_LIMIT && fileSize <= LFS_LIMIT;
};

export const isBlockedFile = (fileSize: number): boolean => {
  return fileSize > LFS_LIMIT;
};

export const isEmptyFile = (fileSize: number): boolean => {
  return fileSize === 0;
};

export const getLFSPattern = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const lfsPatterns: { [key: string]: string } = {
    mp4: '*.mp4', avi: '*.avi', mov: '*.mov', mkv: '*.mkv', wmv: '*.wmv',
    zip: '*.zip', rar: '*.rar', '7z': '*.7z', tar: '*.tar', gz: '*.gz',
    iso: '*.iso', dmg: '*.dmg', exe: '*.exe', msi: '*.msi', apk: '*.apk',
    psd: '*.psd', ai: '*.ai', pdf: '*.pdf', jar: '*.jar', mp3: '*.mp3'
  };
  return lfsPatterns[ext] || `*.${ext}`;
};
