import type { VercelRequest, VercelResponse } from '@vercel/node';
import TorrentSearchApi from 'torrent-search-api';
import axios from 'axios';



// Enable 1337x provider
TorrentSearchApi.enableProvider('1337x');

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { query, suggestions } = req.query;
    const apiKey = req.headers.authorization?.split(' ')[1];

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required' });
    }
    
    

    try {
        const torrents = await TorrentSearchApi.search(query, 'Music', 20);

        const torrentsWithMagnets = await Promise.all(
            torrents.map(async (torrent) => {
                if (!torrent.magnet) {
                    try {
                        const magnet = await TorrentSearchApi.getMagnet(torrent);
                        return { ...torrent, magnet };
                    } catch (e) {
                        return torrent;
                    }
                }
                return torrent;
            })
        );

        const validTorrents = torrentsWithMagnets.filter(t => t.magnet && t.info_hash);

        const finalTorrents = validTorrents;

        if (suggestions) {
            return res.json({ results: finalTorrents.slice(0, 3) });
        }

        return res.json({ results: finalTorrents });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to search for torrents' });
    }
}
