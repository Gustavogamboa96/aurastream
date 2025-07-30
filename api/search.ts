import type { VercelRequest, VercelResponse } from '@vercel/node';
import TorrentSearchApi from 'torrent-search-api';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface NormalizedTorrent {
  title: string;
  time?: string;
  seeds?: number;
  peers?: number;
  size?: string;
  desc?: string;
  provider: string;
  magnet?: string;
}

// Enable 1337x provider for torrent-search-api
TorrentSearchApi.enableProvider('1337x');

// Nyaa.si scraper
async function searchNyaa(query: string): Promise<NormalizedTorrent[]> {
  try {
    const response = await axios.get(`https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(query)}`);
    const $ = cheerio.load(response.data);
    const results: NormalizedTorrent[] = [];

    $('tr.default').each((_, row) => {
      const $row = $(row);
      const title = $row.find('td:nth-child(2) a:last-child').text().trim();
      const magnet = $row.find('td:nth-child(3) a[href^="magnet:"]').attr('href');
      const size = $row.find('td:nth-child(4)').text().trim();
      const time = $row.find('td:nth-child(5)').text().trim();
      const seeds = parseInt($row.find('td:nth-child(6)').text().trim(), 10);
      const peers = parseInt($row.find('td:nth-child(7)').text().trim(), 10);
      
      if (title && magnet) {
        results.push({
          title,
          magnet,
          size,
          time,
          seeds,
          peers,
          provider: 'Nyaa'
        });
      }
    });

    return results;
  } catch (error) {
    console.error('Error searching Nyaa:', error);
    return [];
  }
}

// Additional torrent providers can be added here

// Torlock scraper
async function searchTorlock(query: string): Promise<NormalizedTorrent[]> {
  try {
    const response = await axios.get(`https://www.torlock.com/music/${encodeURIComponent(query)}/1/`);
    const $ = cheerio.load(response.data);
    const results: NormalizedTorrent[] = [];

    $('.table tbody tr').each((_, row) => {
      const $row = $(row);
      const title = $row.find('td:nth-child(1) b').text().trim();
      const size = $row.find('td:nth-child(3)').text().trim();
      const time = $row.find('td:nth-child(2)').text().trim();
      const seeds = parseInt($row.find('td:nth-child(4)').text().trim(), 10);
      const peers = parseInt($row.find('td:nth-child(5)').text().trim(), 10);
      const desc = 'https://www.torlock.com' + $row.find('td:nth-child(1) a').attr('href');
      
      if (title) {
        results.push({
          title,
          size,
          time,
          seeds,
          peers,
          desc,
          provider: 'Torlock'
        });
      }
    });

    // Fetch magnet links for each result
    const resultsWithMagnets = await Promise.all(
      results.map(async (result) => {
        if (result.desc) {
          try {
            const detailResponse = await axios.get(result.desc);
            const $detail = cheerio.load(detailResponse.data);
            const magnet = $detail('a[href^="magnet:"]').attr('href');
            return { ...result, magnet };
          } catch (error) {
            console.error(`Error fetching magnet for ${result.title}:`, error);
            return result;
          }
        }
        return result;
      })
    );

    return resultsWithMagnets;
  } catch (error) {
    console.error('Error searching Torlock:', error);
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { query, suggestions } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    // Search all sources in parallel
    const [torrentsApi, nyaaTorrents, torlockTorrents] = await Promise.all([
      TorrentSearchApi.search(query, 'Music'),
      searchNyaa(query),
      searchTorlock(query)
    ]);
    
    // Normalize torrent-search-api results
    const normalizedApiTorrents = await Promise.all(
      torrentsApi.map(async (torrent) => {
        if (!torrent.magnet) {
          try {
            const magnet = await TorrentSearchApi.getMagnet(torrent);
            return {
              title: torrent.title,
              magnet,
              size: torrent.size,
              seeds: torrent.seeds,
              peers: torrent.peers,
              desc: torrent.desc,
              provider: torrent.provider,
              time: torrent.time
            };
          } catch (error) {
            console.warn(`Could not fetch magnet for ${torrent.title}:`, error);
            return null;
          }
        }
        return {
          title: torrent.title,
          magnet: torrent.magnet,
          size: torrent.size,
          seeds: torrent.seeds,
          peers: torrent.peers,
          desc: torrent.desc,
          provider: torrent.provider,
          time: torrent.time
        };
      })
    );

    // Combine all results
    const allTorrents = [
      ...normalizedApiTorrents.filter((t): t is NormalizedTorrent => t !== null),
      ...nyaaTorrents,
      ...torlockTorrents
    ];

    // Filter out torrents without magnet links and normalize data
    const validTorrents = allTorrents
      .filter(t => t.magnet)
      .map(t => ({
        ...t,
        seeds: t.seeds || 0,
        peers: t.peers || 0,
        size: t.size || 'Unknown'
      }));

    // Sort torrents by the number of seeders in descending order
    validTorrents.sort((a, b) => b.seeds - a.seeds);

    // For suggestions, prioritize high-seeder torrents and ensure good quality
    if (suggestions) {
      const suggestedTorrents = validTorrents
        .filter(t => {
          // Filter for likely high-quality music torrents
          const title = t.title.toLowerCase();
          return (
            t.seeds >= 5 && // Has some seeds
            (title.includes('mp3') || 
             title.includes('flac') || 
             title.includes('wav') ||
             title.includes('album') ||
             title.includes('discography'))
          );
        })
        .slice(0, 10); // Get top 10 suggestions

      return res.json({ results: suggestedTorrents });
    }

    console.log('Search results:', validTorrents);
    return res.json({ results: validTorrents });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to search for torrents' });
  }
}
