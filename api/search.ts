import type { VercelRequest, VercelResponse } from '@vercel/node';
import TorrentSearch from 'torrent-search';

// Initialize TorrentSearch instance
const torrentSearch = new TorrentSearch();

// Enable providers
torrentSearch.enableProvider('1337x');
torrentSearch.enableProvider('ThePirateBay');
torrentSearch.enableProvider('Limetorrents');
torrentSearch.enableProvider('KickassTorrents');

torrentSearch.enablePublicProviders();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { query, suggestions } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const torrents = await torrentSearch.search(query, 'Music', 20);

    // Actively fetch magnet links if they are not included in the search result.
    const torrentsWithMagnets = await Promise.all(
      torrents.map(async (torrent) => {
        if (!torrent.magnet) {
          try {
            const magnet = await torrentSearch.getMagnet(torrent);
            // Return a new object with the magnet link included
            return { ...torrent, magnet: magnet };
          } catch (e) {
            // If getting the magnet fails, return the original torrent
            console.warn(`Could not fetch magnet for ${torrent.title}`);
            return torrent;
          }
        }
        return torrent;
      })
    );

    // Only return torrents that we could find a magnet link for.
    const finalTorrents = torrentsWithMagnets.filter(t => t.magnet);

    if (suggestions) {
      // Return top 3 torrents for suggestion cards
      return res.json({ results: finalTorrents.slice(0, 10) });
    }
    console.log('Search results:', finalTorrents);
    return res.json({ results: finalTorrents });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to search for torrents' });
  }
}
