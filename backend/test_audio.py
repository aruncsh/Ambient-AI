import sys
import os

try:
    from pydub import AudioSegment
    print("pydub imported successfully")
except ImportError as e:
    print(f"Failed to import pydub: {e}")
    sys.exit(1)

try:
    # Check if ffmpeg is available to pydub
    from pydub.utils import which
    ffmpeg_path = which("ffmpeg")
    if ffmpeg_path:
        print(f"ffmpeg found at: {ffmpeg_path}")
    else:
        print("ffmpeg NOT found in PATH. pydub will not be able to decode MP3 files.")
except Exception as e:
    print(f"Error checking ffmpeg: {e}")
