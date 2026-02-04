const yts = require('yt-search');
const { YTDlp } = require('ytdlp-nodejs');
const path = require('path');
const fs = require('fs-extra');

class YouTubeDownloader {
    constructor() {
        this.downloadsDir = path.join(process.cwd(), 'downloads');
        fs.ensureDirSync(this.downloadsDir);
        this.ytdlp = new YTDlp();
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

    async getMetadata(url) {
        try {
            const metadata = await this.ytdlp.getVideoMetadata(url);
            return metadata;
        } catch (err) {
            console.error('[YOUTUBE] Error getting metadata:', err);
            return null;
        }
    }

    async download(url, format = 'mp3', userId) {
        const fileName = `${userId}_${Date.now()}.${format}`;
        const outputPath = path.join(this.downloadsDir, fileName);

        console.log(`[YOUTUBE] Downloading ${url} as ${format} to ${outputPath}`);

        try {
            if (format === 'mp3') {
                await this.ytdlp.download(url, {
                    filter: 'audioonly',
                    output: outputPath,
                    format: 'bestaudio/best',
                    postProcess: [
                        {
                            key: 'FFmpegExtractAudio',
                            preferredcodec: 'mp3',
                            preferredquality: '192',
                        }
                    ]
                });
            } else {
                await this.ytdlp.download(url, {
                    output: outputPath,
                    format: 'bestvideo+bestaudio/best',
                    mergeOutputFormat: 'mp4'
                });
            }

            return outputPath;
        } catch (err) {
            console.error('[YOUTUBE] Download error:', err);
            throw err;
        }
    }

    async cleanup(filePath) {
        try {
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
                console.log(`[YOUTUBE] Cleaned up: ${filePath}`);
            }
        } catch (err) {
            console.error('[YOUTUBE] Cleanup error:', err);
        }
    }
}

module.exports = new YouTubeDownloader();
