const yts = require('yt-search');
const { YtDlp } = require('ytdlp-nodejs');
const path = require('path');
const fs = require('fs-extra');

class YouTubeDownloader {
    constructor() {
        this.downloadsDir = path.join(process.cwd(), 'downloads');
        fs.ensureDirSync(this.downloadsDir);
        this.ytdlp = new YtDlp();

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
        try {
            const metadata = await this.ytdlp.getVideoMetadata(url);
            // We want to return some estimated sizes
            // We'll pick best audio and best video at 360p, 720p
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
            res.mp3 = res.m4a; // Approximate
            res.aac = res.m4a;

            res.v360 = formatSize(f => f.height === 360 && f.ext === 'mp4');
            res.v720 = formatSize(f => f.height === 720 && f.ext === 'mp4');
            res.vBest = formatSize(f => f.ext === 'mp4');

            return res;
        } catch (e) {
            return null;
        }
    }

    async download(url, format = 'mp3', userId) {
        const isAudio = ['mp3', 'aac', 'm4a'].includes(format);
        const videoFormatMap = { '360p': 'mp4', '720p': 'mp4', 'mejormp4': 'mp4', 'avi': 'avi', 'mpeg': 'mpeg' };
        const ext = isAudio ? format : (videoFormatMap[format] || 'mp4');
        const fileName = `${userId}_${Date.now()}.${ext}`;
        const outputPath = path.join(this.downloadsDir, fileName);

        console.log(`[YOUTUBE] Downloading ${url} as ${format} to ${outputPath}`);

        try {
            if (isAudio) {
                await this.ytdlp.download(url, {
                    filter: 'audioonly',
                    output: outputPath,
                    format: 'bestaudio/best',
                    postProcess: [
                        {
                            key: 'FFmpegExtractAudio',
                            preferredcodec: format,
                            preferredquality: '192',
                        }
                    ]
                });
            } else {
                let ytdlpFormat = 'bestvideo+bestaudio/best';
                if (format === '360p') ytdlpFormat = 'bestvideo[height<=360]+bestaudio/best[height<=360]';
                else if (format === '720p') ytdlpFormat = 'bestvideo[height<=720]+bestaudio/best[height<=720]';

                await this.ytdlp.download(url, {
                    output: outputPath,
                    format: ytdlpFormat,
                    mergeOutputFormat: ext === 'mp4' ? 'mp4' : ext
                });
            }

            if (!(await fs.pathExists(outputPath))) {
                const dirFiles = await fs.readdir(this.downloadsDir);
                const base = path.basename(outputPath, `.${ext}`);
                const found = dirFiles.find(f => f.includes(base));
                if (found) return path.join(this.downloadsDir, found);
                throw new Error(`File not found: ${outputPath}`);
            }

            return outputPath;
        } catch (err) {
            console.error('[YOUTUBE] Download error:', err);
            throw err;
        }
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
