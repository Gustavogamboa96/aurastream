import type { VercelRequest, VercelResponse } from '@vercel/node';
import { RealDebridService } from '../../src/services/realDebridService';
import { RealDebridService } from '../../src/services/realDebridService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { magnet } = req.body;
    const apiKey = req.headers.authorization?.split(' ')[1];

    if (!magnet || !apiKey) {
        return res.status(400).json({ error: 'Magnet link and API key are required' });
    }

    try {
        const rdService = new RealDebridService(apiKey);
        console.log('Adding magnet link to Real-Debrid...');
        
        // 1. Add magnet link to Real-Debrid
        const torrentId = await rdService.addMagnet(magnet);
        console.log(`Real-Debrid torrent added with ID: ${torrentId}`);

        // 2. Get torrent info with automatic retries
        console.log('Fetching torrent info...');
        const torrentInfo = await rdService.getTorrentInfo(torrentId);
        console.log('Torrent info retrieved successfully');

        res.status(200).json({ 
            files: torrentInfo.files, 
            torrentId: torrentId, 
            links: torrentInfo.links,
            filename: torrentInfo.filename
        });
    } catch (error: any) {
        console.error('Real-Debrid API error:', error.message);
        res.status(500).json({ error: 'Failed to get torrent info from Real-Debrid' });
    }
}
