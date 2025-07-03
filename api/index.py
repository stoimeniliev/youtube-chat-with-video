from fastapi import FastAPI, HTTPException, Query
# Mangum is used when running on AWS Lambda / Vercel but isn't required on Render
try:
    from mangum import Mangum  # type: ignore
except ImportError:
    Mangum = None
from fastapi.middleware.cors import CORSMiddleware
from webshare_transcript import fetch_transcript_text

app = FastAPI(title="YouTube Transcript via Webshare Proxies")

# Allow all origins (browser extensions are served from chrome-extension://)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if Mangum is not None:
    handler = Mangum(app)


@app.get("/")
@app.get("/transcript")  # alias when running locally
@app.get("/api/transcript")
def get_transcript(videoId: str = Query(..., alias="videoId")):
    """Return the transcript for *videoId* using rotating Webshare proxies.

    Query Params
    ------------
    videoId : str
        YouTube video ID (the `v` parameter in the URL).
    """
    try:
        return {"videoId": videoId, "text": fetch_transcript_text(videoId)}
    except Exception as e:
        # Bubble up as 500 so the extension can surface message to user.
        raise HTTPException(status_code=500, detail=str(e)) 