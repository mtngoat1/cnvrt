import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
    // 1. Enable Global CORS Handshakes
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

        // 2. Select the formatting rule matching your front-end choices
        const filterOption = format === 'mp3' ? 'audioonly' : 'videoandaudio';
        
        let qualitySetting = 'highest';
        if (format === 'mp4') {
            if (quality === '720') qualitySetting = '136'; 
            if (quality === '480') qualitySetting = '135'; 
        }

        // 3. Define Response Headers for Blob Streaming
        res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="download.${format}"`);

        // 4. Safely initialize stream pipelines
        const stream = ytdl(url, { 
            filter: filterOption, 
            quality: qualitySetting,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            }
        });

        // 5. Connect stream straight to downstream response
        stream.pipe(res);

        // 6. Handle internal pipeline breakages to prevent 502 server crashes
        stream.on('error', (err) => {
            console.error('YTDL Stream Error:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Streaming pipeline crashed.' });
            }
        });

    } catch (error) {
        console.error('Global Handler Error:', error.message);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to extract video data.' });
        }
    }
}
