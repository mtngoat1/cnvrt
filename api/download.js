import https from 'https';

// Helper to pull the required YouTube Video ID out of a raw user link
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { url, format } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const videoId = extractVideoId(url);
        if (!videoId) return res.status(400).json({ error: 'Could not extract YouTube Video ID from link.' });

        // Build the correct media-processing request string matching DataFanatic's spec
        const options = {
            hostname: 'youtube-media-downloader.p.rapidapi.com',
            path: `/v2/video/details?videoId=${videoId}&urlAccess=normal&videos=auto&audios=auto`,
            method: 'GET',
            headers: {
                'x-rapidapi-host': 'youtube-media-downloader.p.rapidapi.com',
                'x-rapidapi-key': '29acdc973cmshdeac3b02d549dd2p186299jsne660f792939e' // Your master token
            }
        };

        const apiRequest = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', (chunk) => body += chunk);
            
            apiRes.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    
                    if (format === 'mp3') {
                        // Extract the high-bitrate audio link array from the response object
                        const audioLink = data.audios && data.audios[0] ? data.audios[0].url : null;
                        if (!audioLink) return res.status(400).json({ error: 'Audio stream unavailable for this track.' });
                        return res.status(200).json({ downloadUrl: audioLink });
                    } else {
                        // Extract the primary progressive MP4 video video link stream
                        const videoLink = data.videos && data.videos[0] ? data.videos[0].url : null;
                        if (!videoLink) return res.status(400).json({ error: 'Video stream unavailable at this resolution.' });
                        return res.status(200).json({ downloadUrl: videoLink });
                    }
                } catch (e) {
                    return res.status(500).json({ error: 'Failed to parse media token headers.' });
                }
            });
        });

        apiRequest.on('error', (error) => {
            return res.status(500).json({ error: 'RapidAPI gateway timeout.' });
        });

        apiRequest.end();

    } catch (error) {
        return res.status(500).json({ error: 'Internal server breakdown.' });
    }
}
