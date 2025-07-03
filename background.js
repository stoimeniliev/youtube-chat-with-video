// background.js

const API_KEY = "AIzaSyBLUJpK9Whf3Z3ft1Ji8ZTzS8FDybwH";

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FETCH_TRANSCRIPT") {
    const { videoId } = message;
    fetchTranscript(videoId)
      .then((transcript) => {
        // Store transcript and notify popup
        chrome.storage.local.set({ [`transcript_${videoId}`]: transcript }, () => {
          sendResponse({ success: true });
        });
      })
      .catch((err) => {
        console.error("Transcript fetch error", err);
        sendResponse({ success: false, error: err.message });
      });
    // Needed for async sendResponse
    return true;
  } else if (message.type === "ASK_GEMINI") {
    const { videoId, question, chatHistory } = message;
    askGemini(question, videoId, chatHistory)
      .then((answer) => {
        sendResponse({ success: true, answer });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  } else if (message.type === "OPEN_POPUP") {
    // Programmatically open the extension's popup
    if (chrome.action && chrome.action.openPopup) {
      chrome.action.openPopup().then(() => {
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: "openPopup not supported" });
    }
    return true;
  }
});

/**
 * Attempt to fetch transcript for a YouTube video.
 * Strategy:
 *   1. Query caption list via timedtext (public, no auth).
 *   2. Fetch English transcript xml and convert to plain text.
 * Falls back to error if not available.
 */
async function fetchTranscript(videoId) {
  const endpoints = [
    // Primary (Render deployment)
    `https://tubechat-transcript-api.onrender.com/api/transcript?videoId=${videoId}`,
    // Secondary (Vercel, may fail until Python runtime enabled)
    `https://tubechat-hfwb6ypks-stoimenilievs-projects.vercel.app/api/transcript?videoId=${videoId}`,
    // Public fallback service
    `https://youtube-transcriber-api.vercel.app/v1/transcripts?id=${videoId}&lang=en&type=text`
  ];

  for (const url of endpoints) {
    try {
      console.log("[YTChat] Fetching transcript from:", url);
      const res = await fetch(url);

      if (!res.ok) {
        console.warn(`[YTChat] Transcript endpoint ${url} responded with ${res.status}`);
        continue; // Try next endpoint
      }

      const data = await res.json();
      if (!data) {
        console.warn(`[YTChat] Transcript endpoint ${url} returned empty response`);
        continue;
      }

      // Different services may use different field names
      const text = data.text || data.transcript || data.result || data?.transcripts?.[0]?.text || "";
      if (text) {
        return text;
      }
      // If API returned a message indicating subtitles disabled, treat as failure
      if (data.message) {
        console.warn(`[YTChat] ${data.message}`);
      }
    } catch (err) {
      console.warn(`[YTChat] Transcript fetch error from ${url}`, err);
      // Try next endpoint
    }
  }

  // If we reach here, try direct timedtext scraping as last resort
  try {
    return await fetchTranscriptViaTimedtext(videoId);
  } catch (err) {
    console.warn("[YTChat] Timedtext fallback failed", err);
  }

  // All methods failed
  throw new Error("All transcript endpoints failed");
}

/**
 * Fetch transcript by hitting YouTube's timedtext endpoints directly (no auth needed).
 * Returns plain text or throws if not available.
 */
async function fetchTranscriptViaTimedtext(videoId) {
  // 1) fetch caption track list
  const listUrl = `https://video.google.com/timedtext?type=list&v=${videoId}`;
  const listRes = await fetch(listUrl);
  if (!listRes.ok) throw new Error(`list fetch failed ${listRes.status}`);
  const listXml = await listRes.text();
  if (!listXml.trim()) throw new Error("no caption list");

  // Parse XML to find an English track or first available
  const parser = new DOMParser();
  const listDoc = parser.parseFromString(listXml, "application/xml");
  const tracks = Array.from(listDoc.getElementsByTagName("track"));
  if (!tracks.length) throw new Error("no tracks");
  let track = tracks.find((t) => t.getAttribute("lang_code") === "en") || tracks[0];
  const lang = track.getAttribute("lang_code");

  // 2) fetch transcript for chosen track
  const transcriptUrl = `https://video.google.com/timedtext?lang=${lang}&v=${videoId}&fmt=srv3`;
  const transRes = await fetch(transcriptUrl);
  if (!transRes.ok) throw new Error(`transcript fetch failed ${transRes.status}`);
  const transXml = await transRes.text();
  if (!transXml.trim()) throw new Error("empty transcript xml");
  const transDoc = parser.parseFromString(transXml, "application/xml");
  const texts = Array.from(transDoc.getElementsByTagName("text"));
  if (!texts.length) throw new Error("no text nodes");
  const decoded = texts.map((node) => {
    // Node textContent has entities decoded already
    return node.textContent.trim();
  }).join("\n");
  return decoded;
}

/**
 * Send user question + transcript context to Gemini.
 */
async function askGemini(question, videoId, chatHistory = []) {
  const transcriptKey = `transcript_${videoId}`;
  const { [transcriptKey]: transcript } = await chrome.storage.local.get(transcriptKey);
  if (!transcript) throw new Error("Transcript not available");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;
  const historyParts = chatHistory.map((entry) => ({ role: entry.role, parts: [{ text: entry.text }] }));

  const body = {
    contents: [
      ...historyParts,
      { role: "user", parts: [{ text: `Transcript:\n${transcript}\n\nQuestion:\n${question}` }] }
    ]
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini request failed: ${errText}`);
  }

  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content || "No answer";
  return answer;
} 