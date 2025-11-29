import { GitTreeItem, RepoDetails } from '../types';

const BASE_URL = 'https://api.github.com';

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
    // Try to get specific branch ref
    try {
      return await this.request(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    } catch (e) {
      // If branch doesn't exist, might be empty repo or different main branch
      throw new Error(`Branch '${branch}' not found.`);
    }
  }

  async createRef(owner: string, repo: string, branch: string, sha: string) {
    return this.request(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha,
      }),
    });
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

  async updateRef(owner: string, repo: string, branch: string, commitSha: string) {
    return this.request(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({
        sha: commitSha,
        force: false,
      }),
    });
  }
}