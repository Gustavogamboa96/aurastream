import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import qs from 'qs';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// This function will poll the torrent info endpoint until it's ready
async function getTorrentInfoWhenReady(torrentId: string, apiKey: string) {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const maxRetries = 5;
    const retryDelay = 2000; // 2 seconds

    for (let i = 0; i < maxRetries; i++) {
        console.log(`Real-Debrid torrent info request URL: https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`);
        console.log('Real-Debrid torrent info request headers:', headers);
        const torrentInfoRes = await axios.get(
            `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
            { headers }
        );

        console.log(`Real-Debrid torrent info response:`, torrentInfoRes.data);

        const { status, files } = torrentInfoRes.data;

        // If the file list is available and populated, we are good to go.
        // 'waiting_for_file_selection' is the status when RD has the file list.
        if (files.length > 0) {
            console.log(`got to having more than 0 files`);
            return torrentInfoRes.data;

        }
        
        // If not ready, wait and try again
        await wait(retryDelay);
    }

    throw new Error(`Torrent information was not available after ${maxRetries} retries.`);
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

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${apiKey}`
    };

    try {
        const data = {
            magnet: magnet
        };
        

        // 1. Add magnet link to Real-Debrid
        const addMagnetRes = await axios.post(
            'https://api.real-debrid.com/rest/1.0/torrents/addMagnet',
            qs.stringify(data), // Use qs to format the data correctly
            { headers }
        );
        const torrentId = addMagnetRes.data.id;
        console.log(`Real-Debrid torrent added with ID: ${torrentId}`);

        // 2. Poll for torrent info until it's ready
        const torrentInfo = await getTorrentInfoWhenReady(torrentId, apiKey);

        res.status(200).json({ 
            files: torrentInfo.files, 
            torrentId: torrentId, 
            links: torrentInfo.links,
            filename: torrentInfo.filename
        });
    } catch (error: any) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to get torrent info from Real-Debrid' });
    }
}
