import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

interface TorrentInfo {
  id: string;
  title: string;
  url: string;
  magnet?: string;
  size?: string;
  seeds?: number;
  provider: string;
}

// Function to search 1337x
async function search1337x(query: string): Promise<TorrentInfo[]> {
  try {
    const response = await axios.get(`https://1337x.to/search/${encodeURIComponent(query)}/1/`);
    const html = response.data;
    
    const torrents: TorrentInfo[] = [];
    const regex = /<a href="\/torrent\/(\d+)\/([^"]+)">([^<]+)<\/a>/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      torrents.push({
        id: match[1],
        title: match[3],
        url: `https://1337x.to/torrent/${match[1]}/${match[2]}/`,
        provider: '1337x'
      });
    }
    
    return torrents;
  } catch (error) {
    console.error('Error searching 1337x:', error);
    return [];
  }
}

// Function to search The Pirate Bay
async function searchPirateBay(query: string): Promise<TorrentInfo[]> {
  try {
    const response = await axios.get(`https://thepiratebay.org/search/${encodeURIComponent(query)}/1/99/0`);
    const html = response.data;
    
    const torrents: TorrentInfo[] = [];
    const regex = /<a href="\/torrent\/(\d+)\/([^"]+)".*?>(.*?)<\/a>/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      torrents.push({
        id: match[1],
        title: match[3],
        url: `https://thepiratebay.org/torrent/${match[1]}`,
        provider: 'ThePirateBay'
      });
    }
    
    return torrents;
  } catch (error) {
    console.error('Error searching The Pirate Bay:', error);
    return [];
  }
}

// Function to search KickassTorrents
async function searchKickass(query: string): Promise<TorrentInfo[]> {
  try {
    const response = await axios.get(`https://kickasstorrents.to/search/${encodeURIComponent(query)}`);
    const html = response.data;
    
    const torrents: TorrentInfo[] = [];
    const regex = /<a href="\/torrent\/([^"]+)".*?>(.*?)<\/a>/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      torrents.push({
        id: match[1],
        title: match[2],
        url: `https://kickasstorrents.to/torrent/${match[1]}`,
        provider: 'KickassTorrents'
      });
    }
    
    return torrents;
  } catch (error) {
    console.error('Error searching KickassTorrents:', error);
    return [];
  }
}

// Function to get magnet link from torrent page
async function getMagnet(url: string) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    
    // Extract magnet link from the page
    const magnetMatch = html.match(/href="(magnet:\?xt=urn:btih:[^"]+)"/);
    return magnetMatch ? magnetMatch[1] : null;
  } catch (error) {
    console.error('Error getting magnet:', error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { query, suggestions } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    // Search all providers in parallel
    const [results1337x, resultsPirateBay, resultsKickass] = await Promise.all([
      search1337x(query),
      searchPirateBay(query),
      searchKickass(query)
    ]);
    
    // Combine all results
    const searchResults = [...results1337x, ...resultsPirateBay, ...resultsKickass];
    
    // Fetch magnet links for each torrent
    const torrentsWithMagnets = await Promise.all(
      searchResults.map(async (torrent) => {
        try {
          const magnet = await getMagnet(torrent.url);
          if (magnet) {
            return {
              ...torrent,
              magnet,
              size: 'Unknown', // You might want to extract this from the torrent page
              seeds: 0 // You might want to extract this from the torrent page
            };
          }
          return null;
        } catch (error) {
          console.error(`Error getting magnet for ${torrent.title}:`, error);
          return null;
        }
      })
    );

    // Filter out null results and those without magnet links
    const finalTorrents = torrentsWithMagnets.filter((t): t is NonNullable<typeof t> => t !== null);

    if (suggestions) {
      // Return top 10 torrents for suggestion cards
      return res.json({ results: finalTorrents.slice(0, 10) });
    }

    console.log('Search results:', finalTorrents);
    return res.json({ results: finalTorrents });
  } catch (error) {
    console.error('Search failed:', error);
    return res.status(500).json({ error: 'Failed to search for torrents' });
  }
}
