import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import qs from 'qs';

interface UnrestrictRequest {
    links: string[];
    files: Array<{
        id: number;
        path: string;
        bytes: number;
        selected: number;
    }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { links, files } = req.body as UnrestrictRequest;
    const apiKey = req.headers.authorization?.split(' ')[1];

    if (!links?.length || !files?.length || !apiKey) {
        return res.status(400).json({ 
            error: 'Links array, files array, and API key are required' 
        });
    }

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${apiKey}`
    };

    try {
        // Filter to only audio files and create a mapping
        const audioFiles = files.filter(file => 
            file.path.toLowerCase().endsWith('.mp3') || 
            file.path.toLowerCase().endsWith('.flac')
        );

        const streamUrls: Record<string, string> = {};

        // Process each link in sequence to maintain order
        for (let i = 0; i < links.length; i++) {
            const file = files[i];
            
            // Only process if it's an audio file
            if (file.path.toLowerCase().endsWith('.mp3') || 
                file.path.toLowerCase().endsWith('.flac')) {
                try {
                    // Get unrestricted link
                    const unrestrictResponse = await axios.post(
                        'https://api.real-debrid.com/rest/1.0/unrestrict/link',
                        qs.stringify({ link: links[i] }),
                        { headers }
                    );

                    // Map the download URL to the filename
                    const fileName = file.path.split('/').pop();
                    if (fileName) {
                        streamUrls[fileName] = unrestrictResponse.data.download;
                    }
                } catch (error) {
                    console.error(`Failed to unrestrict link for ${file.path}:`, error);
                    // Continue with other files even if one fails
                }
            }
        }

        if (Object.keys(streamUrls).length === 0) {
            throw new Error('No audio files were successfully processed');
        }

        res.status(200).json({ 
            streamUrls,
            totalProcessed: Object.keys(streamUrls).length,
            totalAudioFiles: audioFiles.length
        });
    } catch (error: any) {
        console.error('Failed to process unrestricted links:', error);
        res.status(500).json({ 
            error: 'Failed to process unrestricted links',
            message: error.message 
        });
    }
}
