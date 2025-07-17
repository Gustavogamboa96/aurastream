import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { torrentId, fileId, link } = req.body;
    const apiKey = req.headers.authorization?.split(' ')[1];

    if (!torrentId || !fileId || !link || !apiKey) {
        return res.status(400).json({ error: 'torrentId, fileId, link, and API key are required' });
    }

    const headers = { Authorization: `Bearer ${apiKey}` };

    try {
        // 1. Select the file to download
        await axios.post(
            `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
            { files: fileId.toString() },
            { headers }
        );

        // 2. Unrestrict the link to get a direct download link
        const unrestrictLinkRes = await axios.post(
            'https://api.real-debrid.com/rest/1.0/unrestrict/link',
            { link },
            { headers }
        );

        res.status(200).json({ streamLink: unrestrictLinkRes.data.download });
    } catch (error: any) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to get streaming link from Real-Debrid' });
    }
}
