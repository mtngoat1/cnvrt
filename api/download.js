import https from 'https';

// Safely isolates the required 11-character Video ID from any standard YouTube URL string
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2] && match[2].length === 11) {
        return match[2];
    }
    const fallbackMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return fallbackMatch ? fallbackMatch[1] : null;
}

export default async function handler(req, res) {
    // 1. Enforce secure cross-origin handshakes
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

        // 2. Map path strings precisely to DataFanatic's endpoint specifications
        const options = {
            hostname: 'youtube-media-downloader.p.rapidapi.com',
            path: `/v2/video/details?videoId=${videoId}`,
            method: 'GET',
            headers: {
                'x-rapidapi-host': 'youtube-media-downloader.p.rapidapi.com',
                'x-rapidapi-key': '29acdc973cmshdeac3b02d549dd2p186299jsne660f792939e' // Your master credential key
            }
        };

        const apiRequest = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', (chunk) => body += chunk);
            
            apiRes.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    let finalDownloadUrl = null;

                    // 3. Drill down cleanly into DataFanatic's exact formats matrix tree
                    if (format === 'mp3') {
                        // Locate adaptive high-bitrate audio tokens safely
                        if (data.audios && Array.isArray(data.audios) && data.audios.length > 0) {
                            finalDownloadUrl = data.audios[0].url;
                        } else if (data.audios && data.audios.url) {
                            finalDownloadUrl = data.audios.url;
                        }
                    } else {
                        // Locate regular progressive mp4 streaming video layers
                        if (data.videos && Array.isArray(data.videos) && data.videos.length > 0) {
                            finalDownloadUrl = data.videos[0].url;
                        } else if (data.videos && data.videos.url) {
                            finalDownloadUrl = data.videos.url;
                        }
                    }

                    // Fallback to checking core streaming blocks if primary shortcuts are absent
                    if (!finalDownloadUrl && data.videos) {
                        finalDownloadUrl = data.videos.url || data.videos;
                    }

                    if (!finalDownloadUrl) {
                        return res.status(400).json({ error: 'Video fetched, but direct download parameters are unavailable.' });
                    }

                    // 4. Return clean parameter payload mapping down to index.html
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

