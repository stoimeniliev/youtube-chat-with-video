# Background and Motivation
The user wants a Chrome extension that allows them to chat with the transcript of any YouTube video they visit.  
When a YouTube page is opened, the extension should:
1. Detect the video ID from the current tab's URL.  
2. Retrieve the video's transcript using the YouTube Data API v3 (captions endpoint).  
3. Send the transcript to Gemini 2.0 Flash Lite and enable an interactive chat so the user can ask questions about the video.  
4. Display the chat UI within the extension's popup or a side panel.  
5. Inject a "Chat with Video" button directly on the YouTube page that kicks off steps 1-4 when clicked.

This solution will let users gain insights or summaries from any video quickly, enhancing accessibility and productivity.

# Key Challenges and Analysis
- **Transcript Retrieval**: YouTube Data API's captions endpoint normally requires OAuth2 and that the video has public captions. We must handle cases where captions aren't available.  
- **API Authentication**: Both YouTube and Gemini calls share the same API key provided by the user; we must secure it in extension code (using `chrome.storage` + environment variables during build).  
- **Chrome Extension Architecture**: Decide on Manifest v3, service worker background, content vs. popup scripts, and messaging between them.  
- **Rate Limits & Quotas**: Both APIs have quota limits; we need lightweight requests and caching.
- **User Experience**: Provide a clean UI for the chat, transcript status, and error handling.  

# High-level Task Breakdown
1. **Set up project scaffolding**  
   • Create a new Chrome extension project using Manifest v3.  
   • Success Criteria: Extension can load in developer mode and shows a basic popup.
2. **Inject "Chat with Video" button**  
   • Write a content script that runs on YouTube watch pages and renders a floating button labeled "Chat with Video" beneath the video title or player.  
   • Success Criteria: Button appears on every YouTube video page when the extension is enabled.
3. **Detect video ID & handle click**  
   • On button click, parse the current page URL to obtain the video ID and send a message to the background/service worker.  
   • Success Criteria: Background script logs the correct video ID upon button click.
4. **Fetch & store API docs (@web)**  
   • Use web search to pull official docs for YouTube Captions API and Gemini Flashing Lite REST API.  
   • Store each doc in its own markdown file (`docs/youtube_api.md`, `docs/gemini_api.md`).  
   • Success Criteria: Docs are saved locally with key endpoints and example requests.
5. **Transcript retrieval**  
   • Background script calls YouTube Captions endpoint with the video ID and API key.  
   • Handle missing-caption edge cases.  
   • Success Criteria: Transcript text is stored or error message shown if unavailable.
6. **Gemini integration module**  
   • Create a helper that sends transcript + user question as context to Gemini 2.0 Flash Lite.  
   • Success Criteria: Receive a valid answer from Gemini in JSON format.
7. **Popup / side-panel chat UI**  
   • Build a simple chat interface that opens when the button is clicked.  
   • Support multiple Q&A turns (maintain chat history).  
   • Success Criteria: User can enter a question and see Gemini's response.
8. **State management & storage**  
   • Cache transcripts and chat history per video in `chrome.storage.local`.  
   • Success Criteria: On reopening the popup, previous chat with the same video reloads.
9. **Packaging & deployment**  
   • Produce `README.md` with install & build steps and Vercel (if applicable for any backend).  
   • Success Criteria: Extension passes Chrome Web Store validation locally.

# Project Status Board
- [x] 1 Project scaffolding (extension loads)  
- [x] 2 Button injection  
- [x] 3 Video ID detection on click  
- [x] 4 Docs fetched & saved  
- [x] 5 Transcript retrieval  
- [x] 6 Gemini integration  
- [x] 7 Chat UI  
- [x] 8 State management  
- [ ] 9 Packaging & docs

# Current Status / Progress Tracking
Switched transcript retrieval to external service (youtube-transcriber-api.vercel.app) that is powered by the python `youtube-transcript-api` package [[websearch]]. This removes all YouTube Data API logic.

# Executor's Feedback or Assistance Requests
_(Executor update 2024-07-03b): Updated fallback URL to correct `/v1/transcripts` path and improved error parsing._

_(Executor update 2024-07-03c): Added direct timedtext scraping fallback in `background.js` (no CORS needed). Should fetch captions for videos that actually have subtitles.)

_(Executor update 2024-07-03d): Added `render.yaml` and root `requirements.txt` (includes uvicorn) for Render deployment of FastAPI backend. After Render build completes, update `background.js` endpoint list with the new Render service URL.)

_(Executor update 2024-07-03e): Patched `webshare_transcript.py` to gracefully skip proxy imports when `youtube_transcript_api.proxies` is absent. Render deploy should now succeed.)

_(Executor update 2024-07-03f): Wrapped import of RequestBlocked in try/except and created fallback shim in `webshare_transcript.py` to support versions where it's missing._

_(Executor update 2024-07-03g): Configured `background.js` to use new Render backend at `https://tubechat-transcript-api.onrender.com/api/transcript`. Added as primary endpoint.
)_

_(Executor update 2024-07-03h): webshare_transcript.py now detects older youtube-transcript-api versions: if `.fetch` missing, falls back to `YouTubeTranscriptApi.get_transcript`. Should fix 500 error.)

_(Executor update 2024-07-03i): Upgraded `youtube-transcript-api` to 1.1.0 in `api/requirements.txt` (adds proxy support and RequestBlocked). Removed explicit mangum pin.)

_(Executor update 2024-07-03j): Made Mangum import optional in `api/index.py`. Render deploy no longer requires `mangum` package.)

_(Executor update 2024-07-03k): `_build_client` now uses `WebshareProxyConfig` when available (yt-transcript-api>=1.1) for proper rotating proxies._

_(Executor update 2024-07-03l): `webshare_transcript.py` now reads `WS_PROXY_USER` and `WS_PROXY_PASS` from environment; `render.yaml` now attaches envVarGroups [proxies]._

_(Executor update 2024-07-03m): Corrected `render.yaml` – link env group via `- fromGroup: proxies` inside `envVars` instead of invalid `envVarGroups` field.)

# Lessons
_(Record recurring fixes or learnings here.)_ 