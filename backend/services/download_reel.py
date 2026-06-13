import sys
import os
import yt_dlp

def download_reel(url, out_dir, filename, ffmpeg_path=None):
    os.makedirs(out_dir, exist_ok=True)
    out_tmpl = os.path.join(out_dir, filename)
    
    # yt-dlp options
    ydl_opts = {
        'outtmpl': out_tmpl,
        # Try to download the best mp4 video and m4a audio, or best single format
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'merge_output_format': 'mp4',
    }
    
    # If a custom ffmpeg location is provided, pass it to yt-dlp
    if ffmpeg_path and os.path.exists(ffmpeg_path):
        print(f"Using ffmpeg path: {ffmpeg_path}")
        ydl_opts['ffmpeg_location'] = ffmpeg_path
    else:
        print("No ffmpeg path provided or path does not exist, relying on system PATH.")

    print(f"Downloading from URL: {url}")
    print(f"Saving to template: {out_tmpl}")
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    
    print("Download completed successfully!")

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
