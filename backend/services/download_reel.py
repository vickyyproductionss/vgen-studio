import sys
import os
import urllib.request
import json
import yt_dlp

CLOUD_RUN_SERVER = os.getenv('CLOUD_RUN_SERVER_URL', 'https://video-generator-750759284790.us-central1.run.app')

def clean_instagram_url(url):
    if 'instagram.com' in url and '?' in url:
        url = url.split('?')[0]
    if 'instagram.com' in url and not url.endswith('/'):
        url += '/'
    return url

def download_reel(url, out_dir, filename, ffmpeg_path=None):
    os.makedirs(out_dir, exist_ok=True)
    out_tmpl = os.path.join(out_dir, filename)
    clean_url = clean_instagram_url(url)
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }

    ydl_opts = {
        'outtmpl': out_tmpl,
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'merge_output_format': 'mp4',
        'http_headers': headers,
        'quiet': False,
        'no_warnings': False,
    }
    
    cookie_file = os.path.join(os.path.dirname(__file__), '..', 'cookies.txt')
    if os.path.exists(cookie_file):
        print(f"Using cookies file: {cookie_file}")
        ydl_opts['cookiefile'] = cookie_file
    
    if ffmpeg_path and os.path.exists(ffmpeg_path):
        ydl_opts['ffmpeg_location'] = ffmpeg_path

    print(f"Downloading from URL: {clean_url}")
    print(f"Saving to template: {out_tmpl}")
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([clean_url])
        print("Download completed successfully locally!")
        return
    except Exception as local_err:
        print(f"[Local Downloader] Local IP blocked by Instagram ({local_err}). Trying Cloud Run fallback...")
        
        try:
            req_data = json.dumps({'url': clean_url}).encode('utf-8')
            req = urllib.request.Request(
                f"{CLOUD_RUN_SERVER}/api/cloud-download-reel",
                data=req_data,
                headers={'Content-Type': 'application/json', 'User-Agent': 'V-Gen-Local-Studio'}
            )
            with urllib.request.urlopen(req, timeout=120) as response:
                with open(out_tmpl, 'wb') as f:
                    f.write(response.read())
            print("Download completed successfully via Cloud Run fallback!")
            return
        except Exception as cloud_err:
            print(f"[Cloud Downloader Fallback Error]: {cloud_err}")
            raise local_err

if __name__ == '__main__':
    # Usage: python download_reel.py <url> <out_dir> <filename> [ffmpeg_path]
    if len(sys.argv) < 4:
        print("Usage: python download_reel.py <url> <out_dir> <filename> [ffmpeg_path]")
        sys.exit(1)
        
    url = sys.argv[1]
    out_dir = sys.argv[2]
    filename = sys.argv[3]
    ffmpeg_path = sys.argv[4] if len(sys.argv) > 4 else None
    
    try:
        download_reel(url, out_dir, filename, ffmpeg_path)
    except Exception as e:
        print(f"Error downloading reel: {e}", file=sys.stderr)
        sys.exit(1)
