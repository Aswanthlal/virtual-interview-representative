// const startBtn = document.getElementById("startBtn");
// const stopBtn = document.getElementById("stopBtn");
// const transcriptDiv = document.getElementById("transcript");
// const replyDiv = document.getElementById("reply");

// let recognition;
// let recognizing = false;

// const pulse = document.getElementById("pulseIndicator");

// const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// if (!SpeechRecognition) {
//   transcriptDiv.innerHTML = "<strong>Your browser does not support voice input.</strong>";
//   startBtn.disabled = true;
// } else {
//   recognition = new SpeechRecognition();
//   recognition.lang = "en-US";
//   recognition.interimResults = false;
//   recognition.maxAlternatives = 1;

//   recognition.onstart = () => {
//     recognizing = true;
//     startBtn.disabled = true;
//     stopBtn.disabled = false;
//     transcriptDiv.textContent = "Listening...";
//     pulse.style.display = "block";

//   };

//   recognition.onresult = (event) => {
//     const text = event.results[0][0].transcript;
//     transcriptDiv.textContent = `You said: "${text}"`;
//     sendMessageToServer(text);
//   };

//   recognition.onerror = (event) => {
//     transcriptDiv.textContent = "Error: " + event.error;
//   };

//   recognition.onend = () => {
//     recognizing = false;
//     startBtn.disabled = false;
//     stopBtn.disabled = true;
//     pulse.style.display = "none";

//   };
// }

// startBtn.onclick = () => recognition && !recognizing && recognition.start();
// stopBtn.onclick = () => recognition && recognizing && recognition.stop();


// let selectedVoice = null;

// function loadVoices() {
//   const voices = speechSynthesis.getVoices();

//   // Prefer a consistent natural-sounding male voice
//   selectedVoice =
//     voices.find(v => v.name === "Google US English") ||
//     voices.find(v => v.name.includes("Google") && v.lang === "en-US") ||
//     voices.find(v => v.lang === "en-US") ||
//     voices[0];
// }

// // Voices load asynchronously in many browsers
// speechSynthesis.onvoiceschanged = loadVoices;
// loadVoices();


// // ----------------------------------------
// // SEND MESSAGE TO SERVER
// // ----------------------------------------
// async function sendMessageToServer(text) {
//   replyDiv.textContent = "Thinking...";

//   try {
//     const res = await fetch("/api/chat/", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ message: text }),
//     });

//     if (!res.ok) {
//       throw new Error("Server error " + res.status);
//     }

//     const data = await res.json();

//     replyDiv.innerHTML += `<p><strong>Bot:</strong> ${data.reply}</p>`;
//     speakText(data.reply);

//   } catch (err) {
//     console.error("Error:", err);
//     replyDiv.innerHTML += `<p><strong>Bot:</strong> Sorry, something went wrong.</p>`;
//   }
// }


// // ----------------------------------------
// // TTS – Bot Speaks the Reply
// // ----------------------------------------
// function speakText(text) {
//   if (!selectedVoice) loadVoices();

//   const utterance = new SpeechSynthesisUtterance(text);
//   utterance.voice = selectedVoice;

//   utterance.rate = 1.02;
//   utterance.pitch = 1.0;
//   utterance.volume = 1;

//   speechSynthesis.cancel(); // stop overlapping speech
//   speechSynthesis.speak(utterance);
// }





const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const transcriptDiv = document.getElementById("transcript");
const replyDiv = document.getElementById("reply");

let recognition;
let recognizing = false;

const pulse = document.getElementById("pulseIndicator");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  transcriptDiv.innerHTML = "<strong>Your browser does not support voice input.</strong>";
  startBtn.disabled = true;
} else {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognizing = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    transcriptDiv.textContent = "Listening...";
    pulse.style.display = "block";

  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    transcriptDiv.textContent = `You said: "${text}"`;
    sendMessageToServer(text);
  };

  recognition.onerror = (event) => {
    transcriptDiv.textContent = "Error: " + event.error;
  };

  recognition.onend = () => {
    recognizing = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    pulse.style.display = "none";

  };
}

startBtn.onclick = () => recognition && !recognizing && recognition.start();
stopBtn.onclick = () => recognition && recognizing && recognition.stop();

// ----------------------------------------
// SEND MESSAGE TO SERVER
// ----------------------------------------
async function sendMessageToServer(text) {
  replyDiv.textContent = "Thinking...";

  try {
      const res = await fetch("/api/chat/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();

    replyDiv.innerHTML += `<p><strong>Bot:</strong> ${data.reply}</p>`;

    speakText(data.reply);

  } catch (err) {
    console.error("Error:", err);
    replyDiv.innerHTML += `<p><strong>Bot:</strong> Sorry, something went wrong.</p>`;
  }
}


// ----------------------------------------
// TTS – Bot Speaks the Reply
// ----------------------------------------
function speakText(text) {
  if (!selectedVoice) loadVoices();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = selectedVoice;

  utterance.rate = 1.02;
  utterance.pitch = 1.0;
  utterance.volume = 1;

  speechSynthesis.cancel(); // prevent overlap
  speechSynthesis.speak(utterance);
}

