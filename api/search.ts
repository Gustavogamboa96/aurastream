import type { VercelRequest, VercelResponse } from '@vercel/node';
import TorrentSearchApi from 'torrent-search-api';

// Enable 1337x provider
TorrentSearchApi.enableProvider('1337x');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { query, suggestions } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const torrents = await TorrentSearchApi.search(query, 'Music', 20);
    
    if (suggestions) {
      // Return top 3 torrents for suggestion cards
      return res.json({ results: torrents.slice(0, 3) });
    }

    return res.json({ results: torrents });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to search for torrents' });
  }
}
