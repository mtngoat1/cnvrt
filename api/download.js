export default async function handler(req, res) {
    // 1. Handle global CORS authorization
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

        // 2. Fetch the stream link using the global extraction API endpoint
        const targetType = format === 'mp3' ? 'mp3' : 'mp4';
        const apiResponse = await fetch(`https://cobalt.tools`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                filenamePattern: 'classic',
                downloadMode: targetType
            })
        });

        const data = await apiResponse.json();

        // 3. Return the secure stream pointer back down to the frontend user
        if (data.status === 'stream' || data.status === 'redirect') {
            return res.status(200).json({ downloadUrl: data.url });
        } else if (data.status === 'picker') {
            // Fallback selection profile if multiple resolution states return
            return res.status(200).json({ downloadUrl: data.picker[0].url });
        } else {
            return res.status(400).json({ error: data.text || 'Extraction pipeline failed.' });
        }

    } catch (error) {
        console.error('Core Engine Exception:', error.message);
        return res.status(500).json({ error: 'Internal extraction server fault.' });
    }
}
