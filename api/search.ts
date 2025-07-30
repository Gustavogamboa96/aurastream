import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import cheerio from 'cheerio';

interface Torrent {
  title: string;
  magnet: string;
  size: string;
  seeds: number;
  peers: number;
  provider: string;
}

async function searchThePirateBay(query: string): Promise<Torrent[]> {
  try {
    const url = `https://thepiratebay.org/search.php?q=${encodeURIComponent(query)}&cat=0`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const torrents: Torrent[] = [];

    $('#searchResult tr').each((i, el) => {
      if (i === 0) return; // Skip header row

      const title = $(el).find('.detName a').text();
      const magnet = $(el).find('a[href^="magnet:"]').attr('href') || '';
      const sizeInfo = $(el).find('.detDesc').text();
      const sizeMatch = sizeInfo.match(/Size (\d+\.\d+\s[A-Za-z]+)/);
      const size = sizeMatch ? sizeMatch[1] : 'N/A';
      const seeds = parseInt($(el).find('td').eq(2).text(), 10) || 0;
      const peers = parseInt($(el).find('td').eq(3).text(), 10) || 0;

      if (title && magnet) {
        torrents.push({
          title,
          magnet,
          size,
          seeds,
          peers,
          provider: 'ThePirateBay',
        });
      }
    });

    return torrents;
  } catch (error) {
    console.error('Error searching ThePirateBay:', error);
    return [];
  }
}

async function search1337x(query: string): Promise<Torrent[]> {
  try {
    const url = `https://www.1337x.to/search/${encodeURIComponent(query)}/1/`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const torrents: Torrent[] = [];

    for (const el of $('.table-list tbody tr').toArray()) {
      const title = $(el).find('.name a').text();
      const torrentLink = "https://www.1337x.to" + $(el).find('.name a').attr('href');
      const seeds = parseInt($(el).find('.seeds').text(), 10) || 0;
      const peers = parseInt($(el).find('.leeches').text(), 10) || 0;
      const size = $(el).find('.size').text().replace(/\d+.*$/, '');

      if (title && torrentLink) {
        try {
          const { data: torrentPageData } = await axios.get(torrentLink);
          const $$ = cheerio.load(torrentPageData);
          const magnet = $$('a[href^="magnet:"]').attr('href') || '';

          if (magnet) {
            torrents.push({
              title,
              magnet,
              size,
              seeds,
              peers,
              provider: '1337x',
            });
          }
        } catch (error) {
          console.error(`Error fetching magnet for ${title}:`, error);
        }
      }
    }

    return torrents;
  } catch (error) {
    console.error('Error searching 1337x:', error);
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { query } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const [tpbResults, x1337Results] = await Promise.all([
      searchThePirateBay(query),
      search1337x(query),
    ]);

    const allResults = [...tpbResults, ...x1337Results];
    res.json({ results: allResults });

  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: 'Failed to search for torrents' });
  }
}