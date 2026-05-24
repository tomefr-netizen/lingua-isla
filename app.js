const sourceLanguage = document.querySelector("#sourceLanguage");
const targetLanguage = document.querySelector("#targetLanguage");
const swapLanguages = document.querySelector("#swapLanguages");
const micButton = document.querySelector("#micButton");
const micLabel = document.querySelector("#micLabel");
const speechHint = document.querySelector("#speechHint");
const inputText = document.querySelector("#inputText");
const outputText = document.querySelector("#outputText");
const translateButton = document.querySelector("#translateButton");
const speakButton = document.querySelector("#speakButton");
const clearButton = document.querySelector("#clearButton");
const speakToggle = document.querySelector("#speakToggle");
const statusMessage = document.querySelector("#statusMessage");
const settingsButton = document.querySelector("#settingsButton");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const settingsPanel = document.querySelector("#settingsPanel");
const providerSelect = document.querySelector("#providerSelect");
const apiKeyInput = document.querySelector("#apiKeyInput");
const libreUrlInput = document.querySelector("#libreUrlInput");
const saveSettingsButton = document.querySelector("#saveSettingsButton");
const apiKeyField = document.querySelector("#apiKeyField");
const libreUrlField = document.querySelector("#libreUrlField");

const storageKey = "lingua-isla-settings";
const voiceLanguageMap = {
  sv: "sv-SE",
  en: "en-US",
  fil: "fil-PH",
  ceb: "fil-PH",
};

const synthesisLanguageMap = {
  sv: "sv-SE",
  en: "en-US",
  fil: "fil-PH",
  ceb: "fil-PH",
};

const settings = loadSettings();
let recognition;
let deferredPrompt = null;
let isRecognizing = false;
let isTranslating = false;

providerSelect.value = settings.provider;
apiKeyInput.value = settings.googleApiKey;
libreUrlInput.value = settings.libreUrl;
toggleProviderFields();

boot();

function boot() {
  attachEvents();
  setupSpeechRecognition();
  registerServiceWorker();
  updateStatus("Klar att lyssna.");
}

function attachEvents() {
  translateButton.addEventListener("click", translateCurrentText);
  speakButton.addEventListener("click", () => speakText(outputText.value, targetLanguage.value));
  clearButton.addEventListener("click", clearAll);
  micButton.addEventListener("click", toggleMicrophone);
  swapLanguages.addEventListener("click", swapSelectedLanguages);
  settingsButton.addEventListener("click", () => setSettingsOpen(true));
  closeSettingsButton.addEventListener("click", () => setSettingsOpen(false));
  saveSettingsButton.addEventListener("click", saveSettings);
  providerSelect.addEventListener("change", toggleProviderFields);
  inputText.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      translateCurrentText();
    }
  });
}

function loadSettings() {
  const fallback = {
    provider: "google",
    googleApiKey: "",
    libreUrl: "",
  };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return { ...fallback, ...saved };
  } catch {
    return fallback;
  }
}

function saveSettings() {
  settings.provider = providerSelect.value;
  settings.googleApiKey = apiKeyInput.value.trim();
  settings.libreUrl = libreUrlInput.value.trim();
  localStorage.setItem(storageKey, JSON.stringify(settings));
  toggleProviderFields();
  setSettingsOpen(false);
  updateStatus("Inställningarna sparades lokalt i webbläsaren.");
}

function toggleProviderFields() {
  const usingGoogle = providerSelect.value === "google";
  apiKeyField.classList.toggle("is-hidden", !usingGoogle);
  libreUrlField.classList.toggle("is-hidden", usingGoogle);
}

function setSettingsOpen(open) {
  settingsPanel.classList.toggle("is-open", open);
  settingsPanel.setAttribute("aria-hidden", String(!open));
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    micButton.disabled = true;
    speechHint.textContent =
      "Din webbläsare saknar stöd för Web Speech API. Du kan fortfarande skriva manuellt.";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("start", () => {
    isRecognizing = true;
    micButton.classList.add("is-listening");
    micButton.setAttribute("aria-pressed", "true");
    micLabel.textContent = "Lyssnar nu";
    updateStatus("Lyssnar...");
  });

  recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join(" ");

    inputText.value = transcript.trim();

    if (event.results[event.results.length - 1].isFinal) {
      updateStatus("Röst mottagen. Översätter...");
      translateCurrentText();
    }
  });

  recognition.addEventListener("end", () => {
    isRecognizing = false;
    micButton.classList.remove("is-listening");
    micButton.setAttribute("aria-pressed", "false");
    micLabel.textContent = "Tryck och prata";
    if (!isTranslating) {
      updateStatus("Klar att lyssna.");
    }
  });

  recognition.addEventListener("error", (event) => {
    isRecognizing = false;
    micButton.classList.remove("is-listening");
    micButton.setAttribute("aria-pressed", "false");
    micLabel.textContent = "Tryck och prata";
    updateStatus(`Röstinmatning misslyckades: ${event.error}`);
  });
}

function toggleMicrophone() {
  if (!recognition) {
    updateStatus("Röstinmatning stöds inte i den här webbläsaren.");
    return;
  }

  if (isRecognizing) {
    recognition.stop();
    return;
  }

  recognition.lang = voiceLanguageMap[sourceLanguage.value] || "sv-SE";
  try {
    recognition.start();
  } catch (error) {
    updateStatus("Mikrofonen kunde inte startas just nu. Försök igen.");
    console.error(error);
  }
}

function swapSelectedLanguages() {
  const previousSource = sourceLanguage.value;
  sourceLanguage.value = targetLanguage.value;
  targetLanguage.value = previousSource;

  const previousInput = inputText.value;
  inputText.value = outputText.value;
  outputText.value = previousInput;
}

async function translateCurrentText() {
  const text = inputText.value.trim();

  if (!text) {
    updateStatus("Skriv eller spela in något först.");
    return;
  }

  if (sourceLanguage.value === targetLanguage.value) {
    outputText.value = text;
    maybeSpeak();
    updateStatus("Käll- och målspråk är samma, så texten kopierades.");
    return;
  }

  translateButton.disabled = true;
  translateButton.textContent = "Jobbar...";
  isTranslating = true;

  try {
    const translated = await translateText(text, sourceLanguage.value, targetLanguage.value);
    outputText.value = translated;
    maybeSpeak();
    updateStatus("Översättningen är klar.");
  } catch (error) {
    console.error(error);
    outputText.value = "";
    updateStatus(error.message || "Något gick fel under översättningen.");
  } finally {
    isTranslating = false;
    translateButton.disabled = false;
    translateButton.textContent = "Översätt";
  }
}

async function translateText(text, source, target) {
  const provider = settings.provider || providerSelect.value;

  if (provider === "google") {
    if (!settings.googleApiKey) {
      throw new Error(
        "Lägg till en Google API-nyckel i inställningarna för att översätta till eller från Bisaya."
      );
    }

    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
        settings.googleApiKey
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: text,
          source,
          target,
          format: "text",
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Google Translation svarade inte som vantat.");
    }

    const payload = await response.json();
    return decodeHtmlEntities(payload?.data?.translations?.[0]?.translatedText?.trim() || "");
  }

  if (!settings.libreUrl) {
    throw new Error("Ange URL till en LibreTranslate-kompatibel server i inställningarna.");
  }

  if (source === "ceb" || target === "ceb") {
    throw new Error("LibreTranslate-läget saknar normalt stöd för Bisaya/Cebuano.");
  }

  const response = await fetch(settings.libreUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: text,
      source,
      target,
      format: "text",
    }),
  });

  if (!response.ok) {
    throw new Error("LibreTranslate-servern svarade inte som vantat.");
  }

  const payload = await response.json();
  return decodeHtmlEntities(payload?.translatedText?.trim() || "");
}

function maybeSpeak() {
  if (speakToggle.checked) {
    speakText(outputText.value, targetLanguage.value);
  }
}

function speakText(text, language) {
  if (!text.trim()) {
    updateStatus("Det finns ingen översättning att spela upp.");
    return;
  }

  if (!("speechSynthesis" in window)) {
    updateStatus("Den här webbläsaren kan inte läsa upp text.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = synthesisLanguageMap[language] || "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function clearAll() {
  inputText.value = "";
  outputText.value = "";
  updateStatus("Falten ar tomma igen.");
}

function updateStatus(message) {
  statusMessage.textContent = message;
}

function decodeHtmlEntities(text) {
  const parser = new DOMParser();
  return parser.parseFromString(text, "text/html").documentElement.textContent || text;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.error("Service worker registration failed", error);
  }
}
