import random
import sys
import time
import os
from typing import List

from youtube_transcript_api import YouTubeTranscriptApi
try:
    from youtube_transcript_api.proxies import WebshareProxyConfig, GenericProxyConfig  # type: ignore
except ImportError:
    # Newer versions of youtube_transcript_api removed the proxies helper.
    WebshareProxyConfig = None  # type: ignore
    GenericProxyConfig = None  # type: ignore
try:
    from youtube_transcript_api._errors import YouTubeRequestFailed, RequestBlocked
except ImportError:
    # Older/newer versions may rename or omit RequestBlocked. Provide a shim.
    from youtube_transcript_api._errors import YouTubeRequestFailed  # type: ignore

    class RequestBlocked(YouTubeRequestFailed):  # type: ignore
        """Fallback placeholder when RequestBlocked is absent in library version."""
        pass

# -------------------------------
# Webshare credential (provided by user)
# -------------------------------
_PROXY_USERNAME = os.getenv("WS_PROXY_USER", "")
_PROXY_PASSWORD = os.getenv("WS_PROXY_PASS", "")

# Pool of residential proxies (host, port)
# These are rotated randomly for each request so we spread traffic and avoid IP blocks.
_PROXY_POOL = [
    ("38.154.227.167", 5868),
    ("198.23.239.134", 6540),
    ("207.244.217.165", 6712),
    ("107.172.163.27", 6543),
    ("216.10.27.159", 6837),
    ("136.0.207.84", 6661),
    ("64.64.118.149", 6732),
    ("142.147.128.93", 6593),
    ("104.239.105.125", 6655),
    ("206.41.172.74", 6634),
]

# How many total attempts before giving up
_MAX_RETRIES = 10
# Base delay (seconds) for exponential back-off between retries
_BASE_DELAY_SEC = 1.0


def _build_client() -> YouTubeTranscriptApi:
    """Instantiate YouTubeTranscriptApi with Webshare rotating residential proxies (if supported).

    For youtube-transcript-api>=1.1 we prefer WebshareProxyConfig which automatically rotates
    through the residential pool. If that class isn't available we fall back to a random static
    proxy from `_PROXY_POOL` via GenericProxyConfig. As a last resort (no proxy classes found)
    we instantiate the client without proxies (may be blocked by YouTube)."""

    # Prefer built-in Webshare helper when present
    if WebshareProxyConfig is not None:
        try:
            cfg = WebshareProxyConfig(
                proxy_username=_PROXY_USERNAME,
                proxy_password=_PROXY_PASSWORD,
            )
            return YouTubeTranscriptApi(proxy_config=cfg)
        except Exception:
            # fall back below on any error
            pass

    # Older versions – roll our own rotation using GenericProxyConfig
    if GenericProxyConfig is not None:
        host, port = random.choice(_PROXY_POOL)
        proxy_url = f"http://{_PROXY_USERNAME}:{_PROXY_PASSWORD}@{host}:{port}"
        return YouTubeTranscriptApi(proxy_config=GenericProxyConfig(proxy_url))

    # No proxy support – hope for the best
    return YouTubeTranscriptApi()


def fetch_transcript_text(video_id: str, languages: List[str] | None = None) -> str:
    """Fetch the transcript for *video_id* and return it as a plain-text string.

    Parameters
    ----------
    video_id : str
        The YouTube video ID (not the full URL).
    languages : list[str] | None
        Preferred languages in order of priority.  Defaults to English.

    Raises
    ------
    youtube_transcript_api._errors.TranscriptsDisabled
        If captions are disabled by the uploader.
    youtube_transcript_api._errors.NoTranscriptFound
        If no transcript in the requested languages exists.
    youtube_transcript_api._errors.RequestBlocked
        If YouTube blocked the request (IP black-listed).
    youtube_transcript_api._errors.AgeRestricted
        If the video is age-restricted and requires authentication.
    """

    if languages is None:
        languages = ["en"]

    # We might hit HTTP 429 (Too Many Requests) or RequestBlocked errors if a proxy
    # is rate-limited or otherwise black-listed. In that case we will rotate the
    # proxy and retry with exponential back-off.

    attempt = 0
    while attempt < _MAX_RETRIES:
        attempt += 1
        client = _build_client()
        try:
            # youtube_transcript_api >=1.1 provides `.fetch()` on instance, whereas
            # older versions expose `get_transcript()` (static/class method).
            if hasattr(client, "fetch"):
                fetched = client.fetch(video_id, languages=languages)
            else:
                # Fallback for versions <1.0 (e.g., 0.6.x)
                fetched = YouTubeTranscriptApi.get_transcript(video_id, languages=languages)  # type: ignore
            # Success → return the concatenated text immediately.
            return "\n".join(snippet["text"] for snippet in fetched)
        except (YouTubeRequestFailed, RequestBlocked) as e:
            # Only retry on 429 or when explicitly blocked.
            if isinstance(e, RequestBlocked) or (
                isinstance(e, YouTubeRequestFailed) and "429" in str(e)
            ):
                sleep_time = _BASE_DELAY_SEC * (2 ** (attempt - 1)) + random.uniform(0, 1)
                print(
                    f"[Warning] Attempt {attempt}/{_MAX_RETRIES} failed with {type(e).__name__}: {e}. "
                    f"Rotating proxy and retrying in {sleep_time:.1f}s…",
                    file=sys.stderr,
                )
                time.sleep(sleep_time)
                continue
            # All other exceptions are propagated immediately.
            raise

    # If we reach here, all attempts failed.
    raise RuntimeError(
        f"Failed to fetch transcript for video_id={video_id!r} after {_MAX_RETRIES} attempts. "
        "All proxies appear to be rate-limited or blocked."
    )


if __name__ == "__main__":
    import sys
    vid = sys.argv[1] if len(sys.argv) > 1 else "dQw4w9WgXcQ"
    print(fetch_transcript_text(vid)) 