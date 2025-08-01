export interface RealDebridFile {
  id: number;
  path: string;
  bytes: number;
  selected: number;
}

export interface RealDebridInfo {
  id: string;
  filename: string;
  original_filename: string;
  hash: string;
  bytes: number;
  original_bytes: number;
  host: string;
  split: number;
  progress: number;
  status: 'downloading' | 'downloaded' | 'waiting' | 'error';
  added: string;
  files: RealDebridFile[];
  links: string[];
  ended?: string;
}

export interface DownloadOptions {
  torrentId: string;
  fileId?: number;  // Optional: for selecting specific files from a torrent
  stream?: boolean; // Whether to stream or download
}
