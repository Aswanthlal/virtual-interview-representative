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


// ----------------------------------------
// CHAT UI
// ----------------------------------------
function addMessage(text, sender) {
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  div.textContent = text;

  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  //  Track message
  currentConversation.push({ sender, text });
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
    recognizing = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    if (pulse) pulse.style.display = "block";
  };
  

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
  
    // Put voice text into input box (DO NOT send)
    textInput.value = (textInput.value + " " + text).trim();
  
    // Optional: focus input so user can edit immediately
    textInput.focus();
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

startBtn.onclick = () => recognition && !recognizing && recognition.start();
stopBtn.onclick = () => recognition && recognizing && recognition.stop();

// ----------------------------------------
// SEND MESSAGE TO SERVER
// ----------------------------------------
async function sendMessageToServer(text) {
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
    });

    const data = await res.json();
    const reply = data.reply || data.error || "No response from server.";

    setTimeout(() => {
      thinking.remove();
      addMessage(reply, "bot");
      speakText(reply);
    }, 400);

  } catch (err) {
    thinking.remove();
    addMessage("Sorry, something went wrong.", "bot");
  }
}


// ----------------------------------------
// TEXT INPUT
// ----------------------------------------
sendBtn.onclick = () => {
  const text = textInput.value.trim();
  if (!text) return;

  addMessage(text, "user");
  textInput.value = "";
  sendMessageToServer(text);
};

// Enter key support
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

// ----------------------------------------
// NEW SESSION
// ----------------------------------------
newSessionBtn.onclick = async () => {
  if (currentConversation.length > 0) {
    conversations.push([...currentConversation]);
  }

  chatWindow.innerHTML = `
    <div class="message bot system">
      🔄 New interview started — previous context cleared.
    </div>
    <div class="message bot">
      Hi, I’m Aswanth. You can start by asking an interview question.
    </div>
  `;

  currentConversation = [];

  await fetch("/api/reset-session/", { method: "POST" });
  speechSynthesis.cancel();

  renderHistory(); // now works
};


function renderHistory() {
  const historyList = document.getElementById("historyList");
  if (!historyList) return;
  historyList.innerHTML = "<h3>Previous Interviews</h3>";

  conversations.forEach((conv, index) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.textContent = `Interview ${index + 1}`;
    item.style.cursor = "pointer";
    item.style.padding = "0.4rem 0.6rem";
    item.style.borderRadius = "6px";
    item.style.marginBottom = "0.3rem";

    // Highlight currently loaded interview
    if (currentConversation === conv) {
      item.style.background = "rgba(255,255,255,0.2)";
    } else {
      item.style.background = "transparent";
    }

    item.onmouseover = () => (item.style.background = "rgba(255,255,255,0.15)");
    item.onmouseout = () => {
      item.style.background = currentConversation === conv ? "rgba(255,255,255,0.2)" : "transparent";
    };

    item.onclick = () => loadConversation(index);
    historyList.appendChild(item);
  });
  historyList.scrollTop = historyList.scrollHeight;

}


function loadConversation(index) {
  chatWindow.innerHTML = ""; // clear current UI
  currentConversation = [...conversations[index]];

  currentConversation.forEach(msg => {
    addMessage(msg.text, msg.sender);
  });
}



// ----------------------------------------
// TEXT TO SPEECH
// ----------------------------------------
let selectedVoice = null;

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  selectedVoice =
    voices.find(v => v.name === "Google US English") ||
    voices.find(v => v.lang === "en-US") ||
    voices[0];
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speakText(text) {
  if (!selectedVoice) loadVoices();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = selectedVoice;
  utterance.rate = 1.02;
  utterance.pitch = 1.0;
  utterance.volume = 1;

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

});