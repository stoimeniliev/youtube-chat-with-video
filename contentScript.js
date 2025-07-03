// contentScript.js

(function injectButton() {
  let btn = document.getElementById("yt-chat-with-video-btn");
  if (btn) return; // already injected

  btn = document.createElement("button");
  btn.id = "yt-chat-with-video-btn";
  btn.textContent = "Chat with Video";

  Object.assign(btn.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: 9999,
    padding: "10px 16px",
    backgroundColor: "#cc0000",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
  });

  btn.addEventListener("click", onChatClick);
  document.body.appendChild(btn);
})();

// Ensure button exists on SPA navigations
window.addEventListener("yt-navigate-finish", () => {
  setTimeout(() => {
    // Remove if not watch page
    if (!location.href.includes("/watch")) {
      const btn = document.getElementById("yt-chat-with-video-btn");
      if (btn) btn.remove();
      return;
    }
    injectButton();
  }, 300);
});

function onChatClick() {
  const videoId = getYouTubeVideoId(window.location.href);
  if (!videoId) {
    alert("Unable to detect YouTube video ID.");
    return;
  }

  // Ask background to fetch transcript (if not already)
  chrome.runtime.sendMessage({ type: "FETCH_TRANSCRIPT", videoId }, (response) => {
    if (!response?.success) {
      alert(`Transcript error: ${response.error || "unknown"}`);
      return;
    }
    // Open the extension popup programmatically
    chrome.runtime.sendMessage({ type: "OPEN_POPUP", videoId });
  });
}

function getYouTubeVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      return u.searchParams.get("v");
    }
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1);
    }
  } catch (e) {
    return null;
  }
  return null;
} 