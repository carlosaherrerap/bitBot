import sys
import os
import yt_dlp

def download_video(url, format_type, output_path):
    print(f"Downloading {url} with format {format_type} to {output_path}")
    
    ydl_opts = {
        'outtmpl': output_path,
        'quiet': True,
        'no_warnings': True,
    }

    if format_type in ['mp3', 'aac', 'm4a']:
        ydl_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': format_type,
                'preferredquality': '192',
            }],
        })
    else:
        # MP4 logic: best compatibility for WhatsApp Mobile
        if format_type == 'mp4':
            ydl_opts.update({
                'format': 'bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                'merge_output_format': 'mp4',
                'postprocessors': [{
                    'key': 'FFmpegVideoConvertor',
                    'preferedformat': 'mp4',
                }],
                'postprocessor_args': [
                    'ffmpeg', '-vcodec', 'libx264', '-profile:v', 'baseline', '-level', '3.0', 
                    '-pix_fmt', 'yuv420p', '-acodec', 'aac', '-movflags', '+faststart'
                ],
            })
        else:
            # For AVI, MPEG, etc.
            ydl_opts.update({
                'format': 'best',
                'merge_output_format': format_type,
            })

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        print("Download completed successfully")
        return True
    except Exception as e:
        print(f"Error during download: {str(e)}", file=sys.stderr)
        return False

import json

def get_metadata(url):
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return json.dumps(info)
    except Exception as e:
        print(f"Error fetching metadata: {str(e)}", file=sys.stderr)
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python downloader.py <url> <format> <output_path> OR python downloader.py --metadata <url>")
        sys.exit(1)

    if sys.argv[1] == "--metadata":
        url = sys.argv[2]
        metadata = get_metadata(url)
        if metadata:
            print(metadata)
            sys.exit(0)
        else:
            sys.exit(1)

    if len(sys.argv) < 4:
        print("Usage: python downloader.py <url> <format> <output_path>")
        sys.exit(1)

    url = sys.argv[1]
    format_type = sys.argv[2]
    output_path = sys.argv[3]

    success = download_video(url, format_type, output_path)
    if not success:
        sys.exit(1)
