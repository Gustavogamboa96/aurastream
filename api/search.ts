import type { VercelRequest, VercelResponse } from '@vercel/node';
import TorrentSearchApi from 'torrent-search-api';
import axios from 'axios';
import cheerio from 'cheerio';

// Enable 1337x provider
TorrentSearchApi.enableProvider('1337x');

interface TorrentResult {
    title: string;
    time: string;
    seeds: number;
    peers: number;
    size: string;
    desc: string;
    provider: string;
    magnet: string;
}

async function searchRuTracker(query: string): Promise<TorrentResult[]> {
    try {
        const url = `http://rutracker.org/forum/tracker.php?nm=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, { responseType: 'arraybuffer' });
        const $ = cheerio.load(data.toString('win1251'));
        const torrents: TorrentResult[] = [];

        $('tr.tCenter').each((i, el) => {
            const title = $(el).find('a.tLink').text();
            const desc = "http://rutracker.org/forum/" + $(el).find('a.tLink').attr('href');
            const size = $(el).find('a.f-dl').text();
            const seeds = parseInt($(el).find('b.seedmed').text(), 10) || 0;
            const peers = parseInt($(el).find('td').eq(5).text(), 10) || 0;
            const time = $(el).find('td').eq(6).text();

            if (title && desc) {
                torrents.push({
                    title,
                    desc,
                    size,
                    seeds,
                    peers,
                    time,
                    provider: 'RuTracker',
                    magnet: '' // RuTracker does not provide magnet links directly in search results
                });
            }
        });

        return torrents;
    } catch (error) {
        console.error('Error searching RuTracker:', error);
        return [];
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { query, suggestions } = req.query;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        const [tpbResults, ruTrackerResults] = await Promise.all([
            TorrentSearchApi.search(query, 'Music'),
            searchRuTracker(query)
        ]);

        const torrentsWithMagnets = await Promise.all(
            tpbResults.map(async (torrent) => {
                if (!torrent.magnet) {
                    try {
                        const magnet = await TorrentSearchApi.getMagnet(torrent);
                        return { ...torrent, magnet: magnet };
                    } catch (e) {
                        console.warn(`Could not fetch magnet for ${torrent.title}`);
                        return torrent;
                    }
                }
                return torrent;
            })
        );

        const finalTorrents: TorrentResult[] = torrentsWithMagnets
            .filter(t => t.magnet)
            .map(t => ({
                title: t.title,
                time: t.time,
                seeds: t.seeds || 0,
                peers: t.peers || 0,
                size: t.size,
                desc: t.desc,
                provider: t.provider,
                magnet: t.magnet || ''
            }));

        const allResults = [...finalTorrents, ...ruTrackerResults];
        allResults.sort((a, b) => b.seeds - a.seeds);

        if (suggestions) {
            return res.json({ results: allResults.slice(0, 20) });
        }

        console.log('Search results:', allResults);
        return res.json({ results: allResults });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to search for torrents' });
    }
}