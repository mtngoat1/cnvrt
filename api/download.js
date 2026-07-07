import https from 'https';

// Helper to pull the required YouTube Video ID out of a raw user link string
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2] && match[2].length === 11) {
        return match[2];
    }
    // Fallback if regex picks different array placement
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
        if (!videoId) return res.status(400).json({ error: 'Could not extract an 11-digit Video ID.' });

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
                    // Log out raw response text data into Render server panels for instant tracking
                    console.log("RAW DATAFANATIC RESPONSE:", body);
                    const data = JSON.parse(body);
                    
                    let downloadLink = null;

                    if (format === 'mp3') {
                        // Check if audios is an array and extract the first index item URL
                        if (data.audios && Array.isArray(data.audios) && data.audios.length > 0) {
                            downloadLink = data.audios[0].url || data.audios[0];
                        } else if (data.audios && data.audios.url) {
                            downloadLink = data.audios.url;
                        } else if (data.audios && typeof data.audios === 'string') {
                            downloadLink = data.audios;
                        }
                    } else {
                        // Check if videos is an array and extract the first index item URL
                        if (data.videos && Array.isArray(data.videos) && data.videos.length > 0) {
                            downloadLink = data.videos[0].url || data.videos[0];
                        } else if (data.videos && data.videos.url) {
                            downloadLink = data.videos.url;
                        } else if (data.videos && typeof data.videos === 'string') {
                            downloadLink = data.videos;
                        }
                    }

                    // Fallback to searching formats mapping patterns if specific audio/video keys are missing
                    if (!downloadLink && data.formats && Array.isArray(data.formats)) {
                        const targetTrack = format === 'mp3' 
                            ? data.formats.find(f => f.mimeType && f.mimeType.includes('audio'))
                            : data.formats.find(f => f.mimeType && f.mimeType.includes('video'));
                        if (targetTrack) downloadLink = targetTrack.url;
                    }

                    if (!downloadLink) {
                        return res.status(400).json({ error: 'Media links found inside data response but mapping values failed.' });
                    }

                    return res.status(200).json({ downloadUrl: downloadLink });

                } catch (e) {
                    return res.status(500).json({ error: 'Parsing failure on data formats.' });
                }
            });
        });

        apiRequest.on('error', (error) => {
            return res.status(500).json({ error: 'RapidAPI extraction connection dropped.' });
        });

        apiRequest.end();

    } catch (error) {
        return res.status(500).json({ error: 'Global gateway failure.' });
    }
}
