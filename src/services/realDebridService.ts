import { RealDebridInfo, DownloadOptions } from '../types/realdebrid';

const POLL_INTERVAL = 1000; // 1 second

export class RealDebridService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.real-debrid.com/rest/1.0';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Real-Debrid API error: ${response.statusText}`);
    }

    return response.json();
  }

  async addMagnet(magnet: string): Promise<string> {
    const response = await this.fetchWithAuth('/torrents/addMagnet', {
      method: 'POST',
      body: JSON.stringify({ magnet }),
    });
    return response.id;
  }

  async selectFiles(torrentId: string, files: number[]): Promise<void> {
    await this.fetchWithAuth(`/torrents/selectFiles/${torrentId}`, {
      method: 'POST',
      body: JSON.stringify({ files }),
    });
  }

  async getTorrentInfo(torrentId: string): Promise<RealDebridInfo> {
    return this.fetchWithAuth(`/torrents/info/${torrentId}`);
  }

  async getUnrestrictedLink(link: string): Promise<string> {
    const response = await this.fetchWithAuth('/unrestrict/link', {
      method: 'POST',
      body: JSON.stringify({ link }),
    });
    return response.download;
  }

  async monitorDownload(torrentId: string, onProgress: (info: RealDebridInfo) => void): Promise<RealDebridInfo> {
    while (true) {
      const info = await this.getTorrentInfo(torrentId);
      onProgress(info);

      if (info.status === 'downloaded' || info.status === 'error') {
        return info;
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  async processDownload(options: DownloadOptions, onProgress: (info: RealDebridInfo) => void): Promise<string> {
    // If specific file is selected
    if (options.fileId) {
      await this.selectFiles(options.torrentId, [options.fileId]);
    }

    // Monitor download progress
    const downloadedInfo = await this.monitorDownload(options.torrentId, onProgress);

    // Get unrestricted link for the first available link
    if (!downloadedInfo.links?.[0]) {
      throw new Error('No download links available');
    }

    const unrestrictedLink = await this.getUnrestrictedLink(downloadedInfo.links[0]);
    return unrestrictedLink;
  }
}
