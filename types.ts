export interface SyncConfig {
  token: string;
  repoUrl: string;
  branch: string;
  targetPath: string;
  deleteMissing: boolean;
  autoCommitMessage: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface FileToSync {
  path: string;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'error' | 'skipped';
}

export enum SyncState {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  ANALYZING = 'ANALYZING',
  UPLOADING = 'UPLOADING',
  COMMITTING = 'COMMITTING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface RepoDetails {
  owner: string;
  repo: string;
}

export interface GitTreeItem {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
  url?: string;
}
