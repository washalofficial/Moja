export const sanitizeGitPath = (path: string): string => {
  let cleanPath = path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter(part => part && part !== '.' && part !== '..')
    .join('/');
  
  return cleanPath;
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
