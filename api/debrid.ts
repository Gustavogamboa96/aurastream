import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// This function will handle the entire Real-Debrid process
async function getStreamingLink(magnet: string, apiKey: string) {
    const headers = { Authorization: `Bearer ${apiKey}` };

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

    // For simplicity, we'll assume we want the largest file (usually the main audio file)
    const mainFile = torrentInfoRes.data.files.reduce((prev: any, current: any) => 
        (prev.bytes > current.bytes) ? prev : current
    );
    const fileIndex = torrentInfoRes.data.files.indexOf(mainFile) + 1; // File indexes are 1-based

    // 3. Select the file to download
    await axios.post(
        `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
        { files: fileIndex.toString() },
        { headers }
    );

    // 4. Unrestrict the link to get a direct download link
    const unrestrictLinkRes = await axios.post(
        'https://api.real-debrid.com/rest/1.0/unrestrict/link',
        { link: torrentInfoRes.data.links[0] }, // Use the first link provided
        { headers }
    );

    return unrestrictLinkRes.data.download;
}

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
        const streamLink = await getStreamingLink(magnet, apiKey);
        res.status(200).json({ streamLink });
    } catch (error: any) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to get streaming link from Real-Debrid' });
    }
}
