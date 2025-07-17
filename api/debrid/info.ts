import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { magnet } = req.body;
    const apiKey = req.headers.authorization?.split(' ')[1];

    if (!magnet || !apiKey) {
        return res.status(400).json({ error: 'Magnet link and API key are required' });
    }

    const headers = { Authorization: `Bearer ${apiKey}` };

    try {
        // 1. Add magnet link to Real-Debrid
        const addMagnetRes = await axios.post(
            'https://api.real-debrid.com/rest/1.0/torrents/addMagnet',
            { magnet },
            { headers }
        );
        const torrentId = addMagnetRes.data.id;

        // 2. Get torrent info to find the file list
        const torrentInfoRes = await axios.get(
            `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
            { headers }
        );

        res.status(200).json({ files: torrentInfoRes.data.files, torrentId: torrentId, links: torrentInfoRes.data.links });
    } catch (error: any) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to get torrent info from Real-Debrid' });
    }
}
