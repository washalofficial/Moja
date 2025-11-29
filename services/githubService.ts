import { GitTreeItem } from '../types';

const BASE_URL = 'https://api.github.com';
const MAX_TREE_SIZE = 100000;
const TREE_BATCH_SIZE = 1000;

export class GitHubService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  public async request(endpoint: string, options: RequestInit = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `GitHub API Error: ${response.status}`);
    }

    return response.json();
  }

  async validateToken(): Promise<string> {
    const user = await this.request('/user');
    return user.login;
  }

  async getRepo(owner: string, repo: string) {
    return this.request(`/repos/${owner}/${repo}`);
  }

  async getRef(owner: string, repo: string, branch: string) {
    try {
      return await this.request(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    } catch (e) {
      throw new Error(`Branch '${branch}' not found.`);
    }
  }

  async isRepositoryEmpty(owner: string, repo: string): Promise<boolean> {
    try {
      const contents = await this.request(`/repos/${owner}/${repo}/contents`);
      return Array.isArray(contents) && contents.length === 0;
    } catch (e) {
      // If we get a 404 or any error, treat as empty
      return true;
    }
  }

  async createRef(owner: string, repo: string, branch: string, sha: string) {
    try {
      return await this.request(`/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha,
        }),
      });
    } catch (e) {
      const errorMsg = (e as Error).message;
      if (errorMsg.includes('already exists') || errorMsg.includes('Reference already exists')) {
        // If ref already exists, force update it
        return await this.updateRef(owner, repo, branch, sha, true);
      }
      throw e;
    }
  }

  async getTreeRecursive(owner: string, repo: string, treeSha: string): Promise<{ tree: GitTreeItem[], truncated: boolean }> {
    return this.request(`/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);
  }

  async createBlob(owner: string, repo: string, contentBase64: string): Promise<string> {
    const data = await this.request(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: contentBase64,
        encoding: 'base64',
      }),
    });
    return data.sha;
  }

  async createTree(owner: string, repo: string, tree: any[], baseTreeSha?: string): Promise<string> {
    if (tree.length === 0) {
      throw new Error('Cannot create tree with no items');
    }

    const validateTree = (items: any[]) => {
      for (const item of items) {
        if (!item.path || typeof item.path !== 'string') {
          throw new Error(`Invalid tree item: missing or invalid path - ${JSON.stringify(item)}`);
        }
        if (!/^[\w\-\.\/]+$/.test(item.path)) {
          throw new Error(`Invalid path format: ${item.path}`);
        }
        if (!item.mode) {
          throw new Error(`Invalid tree item: missing mode for ${item.path}`);
        }
        if (!item.type) {
          throw new Error(`Invalid tree item: missing type for ${item.path}`);
        }
        if (item.type === 'blob' && !item.sha) {
          throw new Error(`Invalid blob: missing sha for ${item.path}`);
        }
      }
    };

    validateTree(tree);

    const MAX_ITEMS_PER_REQUEST = 300;
    
    if (tree.length <= MAX_ITEMS_PER_REQUEST) {
      const body: any = { tree };
      if (baseTreeSha) {
        body.base_tree = baseTreeSha;
      }

      const data = await this.request(`/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return data.sha;
    }

    let currentBaseSha = baseTreeSha;
    for (let i = 0; i < tree.length; i += MAX_ITEMS_PER_REQUEST) {
      const batch = tree.slice(i, i + MAX_ITEMS_PER_REQUEST);
      const body: any = { tree: batch };
      
      if (currentBaseSha) {
        body.base_tree = currentBaseSha;
      }

      const data = await this.request(`/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      currentBaseSha = data.sha;
    }

    return currentBaseSha!;
  }

  async createCommit(owner: string, repo: string, message: string, treeSha: string, parentSha: string | null): Promise<string> {
    const parents = parentSha ? [parentSha] : [];
    const data = await this.request(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: treeSha,
        parents,
      }),
    });
    return data.sha;
  }

  async updateRef(owner: string, repo: string, branch: string, commitSha: string, force: boolean = false) {
    return this.request(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({
        sha: commitSha,
        force: force,
      }),
    });
  }
}
