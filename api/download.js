import https from 'https';

// Clean logic to extract the singular 11-character Video ID from standard YouTube links
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2] && match[2].length === 11) {
        return match[2];
    }
    const matchFallback = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return matchFallback ? matchFallback[1] : null;
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
        if (!videoId) return res.status(400).json({ error: 'Could not parse a valid 11-digit YouTube Video ID.' });

        // TARGETING THE EXPLICIT DOWNLOAD PATH INSTEAD OF THE DETAILS PATH
        const options = {
            hostname: '://rapidapi.com',
            path: `/v2/video/downloads?videoId=${videoId}`,
            method: 'GET',
            headers: {
                'x-rapidapi-host': '://rapidapi.com',
                'x-rapidapi-key': '29acdc973cmshdeac3b02d549dd2p186299jsne660f792939e' // Your validated token
            }
        };

        const apiRequest = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', (chunk) => body += chunk);
            
            apiRes.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    let downloadLink = null;

                    if (format === 'mp3') {
                        // Extract the high-quality adaptive audio stream link directly
                        if (data.audios && data.audios.items && data.audios.items.length > 0) {
                            downloadLink = data.audios.items[0].url;
                        } else if (data.audios && data.audios.url) {
                            downloadLink = data.audios.url;
                        }
                    } else {
                        // Extract the progressive mp4 video stream link directly
                        if (data.videos && data.videos.items && data.videos.items.length > 0) {
                            downloadLink = data.videos.items[0].url;
                        } else if (data.videos && data.videos.url) {
                            downloadLink = data.videos.url;
                        }
                    }

                    if (!downloadLink) {
                        return res.status(400).json({ error: 'The download links array was empty for this track.' });
                    }

                    return res.status(200).json({ downloadUrl: downloadLink });

                } catch (e) {
                    return res.status(500).json({ error: 'Failed to process download link arrays.' });
                }
            });
        });

        apiRequest.on('error', (error) => {
            return res.status(500).json({ error: 'RapidAPI service connection timeout.' });
        });

        apiRequest.end();

    } catch (error) {
        return res.status(500).json({ error: 'Internal system gateway breakdown.' });
    }
}

