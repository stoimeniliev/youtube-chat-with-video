const chatBox = document.getElementById("chat-box");
const chatForm = document.getElementById("chat-form");
const questionInput = document.getElementById("question-input");

let videoId = null;
let chatHistory = [];

// Get the active tab to determine videoId
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (tab && tab.url && (tab.url.includes("youtube.com/watch") || tab.url.includes("youtu.be"))) {
    videoId = getYouTubeVideoId(tab.url);
    if (videoId) {
      loadChatHistory();
      loadTranscriptStatus();
    }
  } else {
    chatBox.textContent = "Navigate to a YouTube video and click Chat with Video.";
  }
});

function loadTranscriptStatus() {
  if (!videoId) return;
  const key = `transcript_${videoId}`;
  chrome.storage.local.get(key, (res) => {
    if (res[key]) {
      appendSystemMsg("Transcript ready. Ask your question!");
    } else {
      appendSystemMsg("Fetching transcript...");
      // Trigger background fetch if not done yet
      chrome.runtime.sendMessage({ type: "FETCH_TRANSCRIPT", videoId }, (response) => {
        if (response?.success) {
          appendSystemMsg("Transcript fetched. Ask away!");
        } else {
          appendSystemMsg(`Error: ${response?.error || "Unable to fetch transcript."}`);
        }
      });
    }
  });
}

function loadChatHistory() {
  const key = `chat_${videoId}`;
  chrome.storage.local.get(key, (res) => {
    chatHistory = res[key] || [];
    // Render
    chatHistory.forEach((entry) => {
      if (entry.role === "user") {
        appendUserMsg(entry.text, false);
      } else if (entry.role === "model") {
        appendAiMsg(entry.text, false);
      }
    });
  });
}

function saveChatHistory() {
  const key = `chat_${videoId}`;
  chrome.storage.local.set({ [key]: chatHistory });
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!videoId) return;
  const question = questionInput.value.trim();
  if (!question) return;
  questionInput.value = "";

  appendUserMsg(question, true);
  chrome.runtime.sendMessage({ type: "ASK_GEMINI", videoId, question, chatHistory }, (response) => {
    if (!response?.success) {
      appendSystemMsg(`Gemini error: ${response.error}`);
      return;
    }
    const answer = response.answer;
    appendAiMsg(answer, true);
  });
});

function appendUserMsg(text, push = true) {
  const div = document.createElement("div");
  div.className = "message user";
  div.textContent = `You: ${text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  if (push) {
    chatHistory.push({ role: "user", text });
    saveChatHistory();
  }
}

function appendAiMsg(text, push = true) {
  const div = document.createElement("div");
  div.className = "message ai";
  div.textContent = `Gemini: ${text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  if (push) {
    chatHistory.push({ role: "model", text });
    saveChatHistory();
  }
}

function appendSystemMsg(text) {
  const div = document.createElement("div");
  div.className = "message ai";
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
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