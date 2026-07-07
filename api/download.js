import play from 'play-dl';

export default async function handler(req, res) {
    // 1. Establish global CORS access
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
        const { url, format } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        // 2. Stream target check validation
        const videoType = play.yt_validate(url);
        if (!videoType) {
            return res.status(400).json({ error: 'Invalid or unsupported link source.' });
        }

        // 3. Extract the high-speed media stream network pointers
        let stream;
        if (format === 'mp3') {
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
            stream = await play.stream(url, { quality: 2 }); // High quality audio stream profile
        } else {
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
            stream = await play.stream(url, { quality: 1 }); // Standard video and audio configuration
        }

        // 4. Pipe data straight down to user response stream
        stream.stream.pipe(res);

        // 5. Catch internal drops to prevent 502/500 gateway breaks
        stream.stream.on('error', (err) => {
            console.error('Core Pipeline Stream Drop:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Media conversion pipeline disconnected.' });
            }
        });

    } catch (error) {
        console.error('Global Processor Exception:', error.message);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Internal extraction server fault.' });
        }
    }
}
