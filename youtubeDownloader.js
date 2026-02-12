const yts = require('yt-search');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');

class YouTubeDownloader {
    constructor() {
        this.downloadsDir = path.join(process.cwd(), 'downloads');
        fs.ensureDirSync(this.downloadsDir);
        this.downloadsDir = path.join(process.cwd(), 'downloads');
        fs.ensureDirSync(this.downloadsDir);

        // Background cleanup every 1 hour
        setInterval(() => this.scheduledCleanup(), 1000 * 60 * 60);
    }

    async scheduledCleanup() {
        console.log('[YOUTUBE] Running scheduled cleanup...');
        try {
            const files = await fs.readdir(this.downloadsDir);
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            for (const file of files) {
                const filePath = path.join(this.downloadsDir, file);
                const stats = await fs.stat(filePath);
                if (now - stats.mtimeMs > maxAge) {
                    await fs.remove(filePath);
                    console.log(`[YOUTUBE] Scheduled removal: ${file}`);
                }
            }
        } catch (err) {
            console.error('[YOUTUBE] Scheduled cleanup error:', err);
        }
    }

    async search(query) {
        console.log(`[YOUTUBE] Searching: ${query}`);
        const r = await yts(query);
        return r.videos.slice(0, 3).map(v => ({
            title: v.title,
            url: v.url,
            videoId: v.videoId,
            seconds: v.seconds,
            timestamp: v.timestamp,
            views: v.views,
            thumbnail: v.thumbnail,
            author: v.author.name
        }));
    }

    async getFormatMetadata(url) {
        return new Promise((resolve) => {
            const pythonScript = path.join(process.cwd(), 'downloader.py');
            const pythonProcess = spawn('python', [pythonScript, '--metadata', url]);

            let output = '';
            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) return resolve(null);
                try {
                    const metadata = JSON.parse(output);
                    const formats = metadata.formats;
                    const res = {
                        mp3: 'Unknown',
                        aac: 'Unknown',
                        m4a: 'Unknown',
                        v360: 'Unknown',
                        v720: 'Unknown',
                        vBest: 'Unknown'
                    };

                    const formatSize = (filter) => {
                        const f = formats.find(filter);
                        if (f && f.filesize) return `${(f.filesize / 1024 / 1024).toFixed(1)}MB`;
                        if (f && f.filesize_approx) return `~${(f.filesize_approx / 1024 / 1024).toFixed(1)}MB`;
                        return 'N/A';
                    };

                    res.m4a = formatSize(f => f.ext === 'm4a' && f.vcodec === 'none');
                    res.mp3 = res.m4a;
                    res.aac = res.m4a;

                    res.v360 = formatSize(f => f.height === 360 && f.ext === 'mp4');
                    res.v720 = formatSize(f => f.height === 720 && f.ext === 'mp4');
                    res.vBest = formatSize(f => f.ext === 'mp4');

                    resolve(res);
                } catch (e) {
                    resolve(null);
                }
            });
        });
    }

    async download(url, format = 'mp3', userId) {
        const isAudio = ['mp3', 'aac', 'm4a'].includes(format);
        const videoFormatMap = { 'mp4': 'mp4', 'avi': 'avi', 'mpeg': 'mpeg' };
        const ext = isAudio ? format : (videoFormatMap[format] || 'mp4');
        const fileName = `${userId}_${Date.now()}.${ext}`;
        const outputPath = path.join(this.downloadsDir, fileName);

        console.log(`[YOUTUBE] Downloading ${url} as ${format} to ${outputPath} via Python`);

        return new Promise((resolve, reject) => {
            const pythonScript = path.join(process.cwd(), 'downloader.py');
            const pythonProcess = spawn('python', [pythonScript, url, format, outputPath]);

            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                console.log(`[PYTHON] ${data.toString().trim()}`);
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.error(`[PYTHON-ERROR] ${data.toString().trim()}`);
            });

            pythonProcess.on('close', async (code) => {
                if (code === 0) {
                    if (await fs.pathExists(outputPath)) {
                        resolve(outputPath);
                    } else {
                        // Sometimes the filename changes slightly if postprocessors were involved
                        const dirFiles = await fs.readdir(this.downloadsDir);
                        const base = path.basename(outputPath, `.${ext}`);
                        const found = dirFiles.find(f => f.includes(base));
                        if (found) {
                            resolve(path.join(this.downloadsDir, found));
                        } else {
                            reject(new Error(`File not found after download: ${outputPath}`));
                        }
                    }
                } else {
                    reject(new Error(`Python downloader failed with code ${code}. Error: ${errorOutput}`));
                }
            });
        });
    }

    async cleanup(filePath) {
        try {
            if (filePath && await fs.pathExists(filePath)) {
                await fs.remove(filePath);
                console.log(`[YOUTUBE] Cleaned up: ${filePath}`);
            }
        } catch (err) {
            console.error('[YOUTUBE] Cleanup error:', err);
        }
    }
}

module.exports = new YouTubeDownloader();
