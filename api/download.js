import https from 'https';

function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match.length === 11) {
        return match[2]; // Safely isolates the 11-digit string ID
    }
    const fallbackMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return fallbackMatch ? fallbackMatch[1] : null;
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
        if (!videoId) return res.status(400).json({ error: 'Could not resolve a valid 11-digit YouTube ID.' });

        const options = {
            hostname: 'youtube-media-downloader.p.rapidapi.com',
            path: `/v2/video/details?videoId=${videoId}`,
            method: 'GET',
            headers: {
                'x-rapidapi-host': 'youtube-media-downloader.p.rapidapi.com',
                'x-rapidapi-key': '29acdc973cmshdeac3b02d549dd2p186299jsne660f792939e'
            }
        };

        const apiRequest = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', (chunk) => body += chunk);
            
            apiRes.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    let finalDownloadUrl = null;

                 if (format === 'mp3') {
    if (data.audios && Array.isArray(data.audios) && data.audios.length > 0) {
        finalDownloadUrl = data.audios[0].url; // Added [0] here
    } else if (data.audios && data.audios.url) {
        finalDownloadUrl = data.audios.url;
    }
} else {
    if (data.videos && Array.isArray(data.videos) && data.videos.length > 0) {
        finalDownloadUrl = data.videos[0].url; // Added [0] here
    } else if (data.videos && data.videos.url) {
        finalDownloadUrl = data.videos.url;
    }
}

                    // Deep format tree scan fallback if structure varies
                    if (!finalDownloadUrl && data.formats && Array.isArray(data.formats)) {
                        const fallBackTrack = format === 'mp3'
                            ? data.formats.find(f => f.mimeType && f.mimeType.includes('audio'))
                            : data.formats.find(f => f.mimeType && f.mimeType.includes('video'));
                        if (fallBackTrack) finalDownloadUrl = fallBackTrack.url;
                    }

                    if (!finalDownloadUrl) {
                        return res.status(400).json({ error: 'Unable to extract the stream URL from the data array.' });
                    }

                    return res.status(200).json({ downloadUrl: finalDownloadUrl });

                } catch (e) {
                    return res.status(500).json({ error: 'Failed to process upstream response schemas.' });
                }
            });
        });

        apiRequest.on('error', () => {
            return res.status(500).json({ error: 'Upstream gateway transaction aborted.' });
        });

        apiRequest.end();

    } catch (error) {
        return res.status(500).json({ error: 'Internal runtime processor fault.' });
    }
}

