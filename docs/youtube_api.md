# YouTube Captions / Transcript Retrieval (Unofficial)

Official YouTube Data API v3 `captions` endpoint requires OAuth for most operations and does not provide raw transcript content with an API key only.

For public videos with captions, transcripts can be retrieved via the timedtext endpoint without authentication:

1. List caption tracks:
   `https://video.google.com/timedtext?type=list&v=VIDEO_ID`
2. Download transcript:
   `https://video.google.com/timedtext?lang=en&v=VIDEO_ID&fmt=srv3`

This extension uses the above approach for simplicity and does **not** modify or upload captions. 