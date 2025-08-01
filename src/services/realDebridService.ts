import { RealDebridInfo, DownloadOptions } from '../types/realdebrid';
import axios from 'axios';
import qs from 'qs';

const POLL_INTERVAL = 1000; // 1 second
const POLL_MAX_RETRIES = 5;

export class RealDebridService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.real-debrid.com/rest/1.0';
  private readonly headers: { [key: string]: string };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  private async makeRequest(endpoint: string, method: string = 'GET', data?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      method,
      url,
      headers: this.headers,
      data: data ? qs.stringify(data) : undefined
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      throw new Error(`Real-Debrid API error: ${error.response?.data?.error || error.message}`);
    }
  }

  async addMagnet(magnet: string): Promise<string> {
    const response = await this.makeRequest('/torrents/addMagnet', 'POST', { magnet });
    return response.id;
  }

  private async selectAllFiles(torrentId: string): Promise<void> {
    await this.makeRequest(`/torrents/selectFiles/${torrentId}`, 'POST', { files: "all" });
  }

  async getTorrentInfo(torrentId: string, retries = POLL_MAX_RETRIES): Promise<RealDebridInfo> {
    const response = await this.makeRequest(`/torrents/info/${torrentId}`);
    
    // If files array is empty and we have retries left, wait and try again
    if ((!response.files || response.files.length === 0) && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      return this.getTorrentInfo(torrentId, retries - 1);
    }
    
    return response;
  }

  async getUnrestrictedLink(link: string): Promise<string> {
    const response = await this.makeRequest('/unrestrict/link', 'POST', { link });
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

  async processDownload(options: DownloadOptions, onProgress: (info: RealDebridInfo) => void): Promise<Record<string, string>> {
    // Always select all files
    await this.selectAllFiles(options.torrentId);

    // Monitor download progress
    const downloadedInfo = await this.monitorDownload(options.torrentId, onProgress);

    // Get unrestricted links for all files
    if (!downloadedInfo.links?.length) {
      throw new Error('No download links available');
    }

    const streamUrls: Record<string, string> = {};
    
    // Convert all links to unrestricted links
    await Promise.all(
      downloadedInfo.links.map(async (link, index) => {
        const unrestrictedLink = await this.getUnrestrictedLink(link);
        // Use the file name as the key if available, otherwise use the index
        const key = downloadedInfo.files[index]?.path.split('/').pop() || `track-${index}`;
        streamUrls[key] = unrestrictedLink;
      })
    );

    return streamUrls;
  }
}
