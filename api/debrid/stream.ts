import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import qs from 'qs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { torrentId, fileId } = req.body;
    const apiKey = req.headers.authorization?.split(' ')[1];

    if (!torrentId || !fileId || !apiKey) {
        return res.status(400).json({ error: 'torrentId, fileId, and API key are required' });
    }

    const headers = { Authorization: `Bearer ${apiKey}` };

    try {
        // 1. Select the file to download
        await axios.post(
            `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
            qs.stringify({ files: fileId.toString() }),
            { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        // 2. Poll for links to be available
        let pollLinks = [];
        let pollTries = 0;
        while (pollLinks.length === 0 && pollTries < 20) {
            const infoRes = await axios.get(
                `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
                { headers }
            );
            pollLinks = infoRes.data.links || [];
            if (pollLinks.length > 0) break;
            await new Promise((resolve) => setTimeout(resolve, 2000));
            pollTries++;
        }
        if (pollLinks.length === 0) {
            return res.status(500).json({ error: 'No links available for streaming from Real-Debrid.' });
        }

        // 3. Unrestrict the first link to get a direct download link
        const unrestrictLinkRes = await axios.post(
            'https://api.real-debrid.com/rest/1.0/unrestrict/link',
            qs.stringify({ link: pollLinks[0] }),
            { headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        res.status(200).json({ streamLink: unrestrictLinkRes.data.download });
    } catch (error: any) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to get streaming link from Real-Debrid' });
    }
}
