import https from 'https';

// Clean logic to extract the singular 11-character string Video ID from standard YouTube link strings
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
        if (!videoId) return res.status(400).json({ error: 'Could not extract a valid 11-digit YouTube Video ID from link.' });

        // Query the explicit video specifications mapping parameters matching DataFanatic's endpoints
        const options = {
            hostname: 'youtube-media-downloader.p.rapidapi.com',
            path: `/v2/video/details?videoId=${videoId}`,
            method: 'GET',
            headers: {
                'x-rapidapi-host': 'youtube-media-downloader.p.rapidapi.com',
                'x-rapidapi-key': '29acdc973cmshdeac3b02d549dd2p186299jsne660f792939e' // Your validated token
            }
        };

        const apiRequest = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', (chunk) => body += chunk);
            
            apiRes.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    
                    // Comprehensive object mapping to find the extraction stream links safely inside DataFanatic's payload tree
                    let downloadLink = null;

                    if (format === 'mp3') {
                        // Locate the highest adaptive bitrate audio tracks
                        if (data.audios && data.audios.url) {
                            downloadLink = data.audios.url;
                        } else if (data.audios && data.audios[0]) {
                            downloadLink = data.audios[0].url || data.audios[0];
                        }
                        
                        if (!downloadLink) {
                            return res.status(400).json({ error: 'Audio extraction block triggered. No direct MP3 asset layer found.' });
                        }
                    } else {
                        // Locate the primary video stream links
                        if (data.videos && data.videos.url) {
                            downloadLink = data.videos.url;
                        } else if (data.videos && data.videos[0]) {
                            downloadLink = data.videos[0].url || data.videos[0];
                        }

                        if (!downloadLink) {
                            return res.status(400).json({ error: 'Video extraction block triggered. No direct MP4 progressive layer found.' });
                        }
                    }

                    // Return the data directly to the frontend interface
                    return res.status(200).json({ downloadUrl: downloadLink });

                } catch (e) {
                    return res.status(500).json({ error: 'Failed to parse JSON response headers from API grid.' });
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
