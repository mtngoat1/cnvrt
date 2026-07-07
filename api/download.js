import https from 'https';

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

                    // Catch explicit API-level error flags before processing download links
                    if (data.status === false || data.msg) {
                        return res.status(400).json({ error: data.msg || 'The video link could not be parsed by the extraction nodes.' });
                    }
                    
                    let finalDownloadUrl = null;

                    if (format === 'mp3') {
                        // DataFanatic provides an array of multiple audio tracks inside data.audios
                        if (data.audios && Array.isArray(data.audios) && data.audios.length > 0) {
                            // Extract the URL from the highest available quality track index
                            finalDownloadUrl = data.audios[0].url || data.audios[0];
                        } else if (data.audios && data.audios.url) {
                            finalDownloadUrl = data.audios.url;
                        }
                    } else {
                        // DataFanatic provides progressive video tracks inside data.videos
                        if (data.videos && Array.isArray(data.videos) && data.videos.length > 0) {
                            finalDownloadUrl = data.videos[0].url || data.videos[0];
                        } else if (data.videos && data.videos.url) {
                            finalDownloadUrl = data.videos.url;
                        }
                    }

                    // Global backup map check if array shortcut nodes are modified
                    if (!finalDownloadUrl && data.url) {
                        finalDownloadUrl = data.url;
                    }

                    if (!finalDownloadUrl) {
                        return res.status(400).json({ error: 'Media asset metadata fetched successfully, but direct file stream endpoints are locked.' });
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

