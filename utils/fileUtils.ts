export const sanitizeGitPath = (path: string): string => {
  let cleanPath = path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split('/')
    .map(part => {
      if (!part || part === '.' || part === '..') return null;
      return part
        .replace(/[\x00-\x1f\x7f]/g, '')
        .replace(/[^\w.\-\u0080-\uffff]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/^\.+/, '')
        .trim();
    })
    .filter((part): part is string => part !== null && part.length > 0)
    .join('/');
  
  if (!cleanPath) return 'file';
  return cleanPath;
};

export const validateGitPath = (path: string): { valid: boolean; error?: string } => {
  if (!path) return { valid: false, error: 'Path is empty' };
  if (path.includes('//')) return { valid: false, error: 'Path contains double slashes' };
  if (path.startsWith('/') || path.endsWith('/')) return { valid: false, error: 'Path has leading/trailing slashes' };
  if (path.length > 1000) return { valid: false, error: 'Path exceeds maximum length' };
  
  const parts = path.split('/');
  for (const part of parts) {
    if (!part) return { valid: false, error: 'Path has empty components' };
    if (/[\x00-\x1f]/.test(part)) return { valid: false, error: 'Path contains control characters' };
    if (part.length > 255) return { valid: false, error: 'Path component exceeds GitHub limit' };
  }
  
  return { valid: true };
};

export const validateFileSize = (file: File): { valid: boolean; error?: string; sizeMB: number } => {
  const sizeMB = file.size / (1024 * 1024);
  const SOFT_LIMIT_MB = 100;
  const HARD_LIMIT_MB = 500;
  
  if (file.size === 0) {
    return { valid: false, error: 'File is empty', sizeMB };
  }
  
  if (sizeMB > HARD_LIMIT_MB) {
    return { valid: false, error: `File exceeds GitHub limit (${HARD_LIMIT_MB}MB max)`, sizeMB };
  }
  
  if (sizeMB > SOFT_LIMIT_MB) {
    return { valid: true, error: `⚠️ Large file (${sizeMB.toFixed(1)}MB) - GitHub recommends max 100MB`, sizeMB };
  }
  
  return { valid: true, sizeMB };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};

export const computeGitBlobSha = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const size = buffer.byteLength;
  const header = `blob ${size}\0`;
  const headerBuffer = new TextEncoder().encode(header);
  
  const combined = new Uint8Array(headerBuffer.byteLength + size);
  combined.set(headerBuffer);
  combined.set(new Uint8Array(buffer), headerBuffer.byteLength);

  const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const parseRepoUrl = (url: string): { owner: string; repo: string } | null => {
  try {
    if (!url) return null;
    let cleanUrl = url.trim();

    while (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    if (cleanUrl.endsWith('.git')) {
      cleanUrl = cleanUrl.slice(0, -4);
    }
    
    while (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    
    if (!cleanUrl) return null;

    if (cleanUrl.startsWith('github.com/')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    if (!cleanUrl.startsWith('http')) {
      const parts = cleanUrl.split('/');
      if (parts.length === 2) {
        return { owner: parts[0], repo: parts[1] };
      }
      return null;
    }

    const urlObj = new URL(cleanUrl);
    if (!urlObj.hostname.includes('github.com')) return null;
    
    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
    
    return null;
  } catch (e) {
    return null;
  }
};
