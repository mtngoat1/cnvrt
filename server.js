import express from 'express';
import cors from 'cors';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const app = express();
const PORT = 3800;

app.use(cors());
app.use(express.json());

// Main URL Download Endpoint
app.post('/api/download', async (req, res) => {
  const { url, format = 'mp4', quality = '720' } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing target URL parameter.' });
  }

  // Create a localized temporary job workspace directory folder path
  const jobId = crypto.randomBytes(4).toString('hex');
  const jobDir = path.join(os.tmpdir(), `dl-${jobId}`);
  await fs.mkdir(jobDir, { recursive: true });

  const outputTemplate = path.join(jobDir, 'download.%(ext)s');
  
  // Configure yt-dlp flags dynamically based on UI selections
  let args = [
    '--no-playlist',
    '--no-cache-dir',
    '--restrict-filenames',
    '-o', outputTemplate,
    url
  ];

  if (format === 'mp3') {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    // Selects 720p or lower down to 480p standard formats matching quality heights
    args.push('-f', `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`, '--merge-output-format', 'mp4');
  }

  // Spawn yt-dlp execution lifecycle natively on your machine
  const child = spawn('yt-dlp', args);
  let stderr = '';

  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  child.on('close', async (code) => {
    if (code !== 0) {
      await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
      return res.status(500).json({ error: stderr.trim() || 'Extraction execution failed.' });
    }

    try {
      const files = await fs.readdir(jobDir);
      const downloadFile = files.find(f => !f.startsWith('.'));
      
      if (!downloadFile) throw new Error('File generation tracking missing.');

      const fullPath = path.join(jobDir, downloadFile);

      // Stream the extracted media file down to the browser payload windows container safely
      res.download(fullPath, downloadFile, async (err) => {
        // Clear files out of os storage blocks cleanly post stream push to prevent disk bloat
        await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
      });

    } catch (err) {
      await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});
      res.status(500).json({ error: err.message });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Private Download API Server operational at http://localhost:${PORT}`);
});

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/download.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

// Serve your frontend interface files
app.use(express.static(__dirname));

// Route your existing download file downloader script
app.post('/api/download', handler);

const PORT = process.env.PORT || 3800;
app.listen(PORT, () => console.log(`Server blasting off on port ${PORT}`));
