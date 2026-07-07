import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
    // Enable CORS headers so your frontend can talk to it safely
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url, format, quality } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        // Select the correct format profile matching your UI selection
        const filterOption = format === 'mp3' ? 'audioonly' : 'videoandaudio';
        
        // Target an appropriate resolution tier based on the user's choice
        let qualitySetting = 'highest';
        if (format === 'mp4') {
            if (quality === '720') qualitySetting = '136'; // 720p hook
            if (quality === '480') qualitySetting = '135'; // 480p hook
        }

        // Set response headers to trigger your frontend's blob/stream downloader
        res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="download.${format}"`);

        // Pipe the live stream straight from the cloud engine down to the user's machine
        ytdl(url, { 
            filter: filterOption, 
            quality: qualitySetting 
        }).pipe(res);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to extract video data.' });
    }
}
