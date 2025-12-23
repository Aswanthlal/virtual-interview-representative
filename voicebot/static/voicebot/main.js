document.addEventListener("DOMContentLoaded", () => {

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const pulse = document.getElementById("pulseIndicator");

const chatWindow = document.getElementById("chatWindow");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const newSessionBtn = document.getElementById("newSessionBtn");

let recognition;
let recognizing = false;
let conversations = [];
let currentConversation = [];
let currentConversationId = null;
let currentAbortController = null;
let isReplying = false;
let responseToken = 0;
let activeUtterance = null;
let isViewingHistory = false;




// ----------------------------------------
// CHAT UI
// ----------------------------------------
function addMessage(text, sender, temporary = false, skipState = false) {
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  div.textContent = text;

  if (temporary) {
    div.dataset.temporary = "true";
  }

  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  // ✅ Only push if NOT rendering history
  if (!skipState && sender !== "system") {
    currentConversation.push({ sender, text });
  }

  return div;
}




// ----------------------------------------
// SPEECH RECOGNITION
// ----------------------------------------
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    if (pulse) pulse.style.display = "block";
  };
  
  

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
  
    // Put voice text into input box (DO NOT send)
    textInput.value = (textInput.value + " " + text).trim();
  
    // Optional: focus input so user can edit immediately
    textInput.focus();
    addMessage("✍️ Review the text and press Send when ready.", "system", true);
  };
  

  recognition.onerror = () => {
    addMessage("Voice input error. Please try again.", "bot");
  };

  recognition.onend = () => {
    recognizing = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    if (pulse) pulse.style.display = "none";
  };
  
} else {
  startBtn.disabled = true;
  addMessage("Your browser does not support voice input.", "bot");
}

startBtn.onclick = () => {
  if (!recognition || recognizing) return;

  recognizing = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;

  addMessage("🎙️ Listening… speak naturally.", "system", true);

  recognition.start();
};

stopBtn.onclick = () => {
  // Invalidate ALL responses
  responseToken++;

  // Kill mic
  if (recognition) {
    try { recognition.abort(); } catch {}
  }

  // HARD STOP speech
  if (activeUtterance) {
    activeUtterance.onend = null;
    activeUtterance.onerror = null;
    activeUtterance = null;
  }
  speechSynthesis.cancel();

  // Abort fetch
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  recognizing = false;
  isReplying = false;

  stopBtn.disabled = true;
  startBtn.disabled = false;

  clearTemporarySystemMessages();
  addMessage("⏹️ Interaction stopped.", "system", true);
};






// ----------------------------------------
// SEND MESSAGE TO SERVER
// ----------------------------------------
async function sendMessageToServer(text) {
  // Invalidate any previous response
  responseToken++;

  // Abort previous fetch
  if (currentAbortController) {
    currentAbortController.abort();
  }

  currentAbortController = new AbortController();
  const myToken = responseToken;

  // Mark replying state
  isReplying = true;
  // stopBtn.disabled = false;
  // startBtn.disabled = true;

  const thinking = document.createElement("div");
  thinking.className = "message bot system";
  thinking.textContent = "Typing...";
  chatWindow.appendChild(thinking);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const res = await fetch("/api/chat/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
      signal: currentAbortController.signal
    });

    const data = await res.json();
    const reply = data.reply || data.error || "No response from server.";

    setTimeout(() => {
      if (responseToken !== myToken) {
        thinking.remove();
        return;
      }
    
      thinking.remove();
      clearTemporarySystemMessages();
      addMessage(reply, "bot");
    
      // Speak only if still valid
      if (responseToken === myToken) {
        speakText(reply);
      }
    
      isReplying = false;
      // stopBtn.disabled = true;
      // startBtn.disabled = false;
    }, 400);

  } catch (err) {
    thinking.remove();
    clearTemporarySystemMessages();

    isReplying = false;
    stopBtn.disabled = true;
    startBtn.disabled = false;

    if (err.name === "AbortError") {
      return;
    }

    addMessage("Sorry, something went wrong.", "bot");
  }
}




// ----------------------------------------
// TEXT INPUT
// ----------------------------------------
sendBtn.onclick = () => {
  const text = textInput.value.trim();
  if (isReplying) return;

  if (!text) return;

  addMessage(text, "user");
  isViewingHistory = false; //  user is now in a fresh session
  updateCurrentSessionStatus();
  textInput.value = "";
  clearTemporarySystemMessages();

  sendMessageToServer(text);
};

// Enter key support
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

//

function clearTemporarySystemMessages() {
  const tempMessages = document.querySelectorAll(
    '.message.system[data-temporary="true"]'
  );
  tempMessages.forEach(msg => msg.remove());
}
//

// ----------------------------------------
// NEW SESSION
// ----------------------------------------
newSessionBtn.onclick = async () => {
  // ✅ Save ONLY if this is a REAL new session
  const hasUserMessage =
    !isViewingHistory &&
    currentConversation.some(msg => msg.sender === "user");

  if (hasUserMessage) {
    conversations.push({
      id: conversations.length + 1,
      messages: JSON.parse(JSON.stringify(currentConversation))
    });
    renderHistory();
  }

  // Reset everything
  chatWindow.innerHTML = "";
  currentConversation = [];
  currentConversationId = null;
  isViewingHistory = false; // ✅ reset

  addMessage(
    "🔄 New interview started.\nYou can freely ask interview questions, or say “start structured interview” to begin a guided round.",
    "system",
    true
  );

  addMessage(
    "Hi, I’m Aswanth. You can start by asking an interview question.",
    "bot"
  );

  await fetch("/api/reset-session/", { method: "POST" });
  speechSynthesis.cancel();
};



function updateCurrentSessionStatus() {
  const el = document.getElementById("currentSessionStatus");
  if (!el) return;

  if (isViewingHistory) {
    el.textContent = "Viewing previous interview (read-only)";
    return;
  }

  const userCount = currentConversation.filter(
    m => m.sender === "user"
  ).length;

  el.textContent =
    userCount === 0
      ? "New interview (no messages yet)"
      : `${userCount} message${userCount > 1 ? "s" : ""} in this interview`;
}



function loadConversationById(id) {
  const interview = conversations.find(c => c.id === id);
  if (!interview) return;

  chatWindow.innerHTML = "";
  currentConversation = [...interview.messages];
  currentConversationId = id;

  isViewingHistory = true; // ✅ IMPORTANT

  currentConversation.forEach(msg => {
    addMessage(msg.text, msg.sender, false, true);
  });
}




function renderHistory() {
  const historyList = document.getElementById("historyList");
  if (!historyList) return;

  historyList.innerHTML = "<h3>Previous Interviews</h3>";

  // newest first
  [...conversations].reverse().forEach(interview => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.textContent = `Interview ${interview.id}`;

    item.style.cursor = "pointer";
    item.style.padding = "0.4rem 0.6rem";
    item.style.borderRadius = "6px";
    item.style.marginBottom = "0.3rem";

    if (currentConversationId === interview.id) {
      item.style.background = "rgba(255,255,255,0.2)";
    }

    item.onclick = () => loadConversationById(interview.id);
    updateCurrentSessionStatus();

    historyList.appendChild(item);
  });
}






// ----------------------------------------
// TEXT TO SPEECH
// ----------------------------------------
let selectedVoice = null;

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;

  const maleKeywords = ["david", "mark", "alex", "male"];

  selectedVoice =
    // 1️⃣ Explicit known male voices
    voices.find(v =>
      v.lang === "en-US" &&
      maleKeywords.some(k => v.name.toLowerCase().includes(k))
    ) ||
    // 2️⃣ Any en-US voice as fallback
    voices.find(v => v.lang === "en-US") ||
    // 3️⃣ Absolute fallback
    voices[0];
}



speechSynthesis.onvoiceschanged = () => {
  loadVoices();
};


function speakText(text) {
  if (!selectedVoice) loadVoices();

  // Cancel anything already speaking
  speechSynthesis.cancel();
  activeUtterance = null;

  const utterance = new SpeechSynthesisUtterance(text);
  activeUtterance = utterance;

  utterance.voice = selectedVoice;
  utterance.rate = 0.97;
  utterance.pitch = 0.8;
  utterance.volume = 1;

  // 🔓 Stop MUST be enabled during speech
  stopBtn.disabled = false;
  startBtn.disabled = true;

  addMessage("🗣️ Responding as Aswanth…", "system", true);

  utterance.onstart = () => {
    stopBtn.disabled = false;
  };

  utterance.onend = () => {
    activeUtterance = null;
    stopBtn.disabled = true;
    startBtn.disabled = false;
    clearTemporarySystemMessages();
  };

  utterance.onerror = () => {
    activeUtterance = null;
    stopBtn.disabled = true;
    startBtn.disabled = false;
    clearTemporarySystemMessages();
  };

  speechSynthesis.speak(utterance);
}

});