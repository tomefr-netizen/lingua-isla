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
const versionLabel = document.querySelector("#versionLabel");
const checkUpdateButton = document.querySelector("#checkUpdateButton");
const refreshAppButton = document.querySelector("#refreshAppButton");
const updateMessage = document.querySelector("#updateMessage");
const settingsButton = document.querySelector("#settingsButton");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const settingsPanel = document.querySelector("#settingsPanel");
const providerSelect = document.querySelector("#providerSelect");
const apiKeyInput = document.querySelector("#apiKeyInput");
const apiKeyLabel = document.querySelector("#apiKeyLabel");
const voiceSelect = document.querySelector("#voiceSelect");
const libreUrlInput = document.querySelector("#libreUrlInput");
const saveSettingsButton = document.querySelector("#saveSettingsButton");
const apiKeyField = document.querySelector("#apiKeyField");
const voiceField = document.querySelector("#voiceField");
const libreUrlField = document.querySelector("#libreUrlField");
const providerNote = document.querySelector("#providerNote");

const storageKey = "lingua-isla-settings";
const APP_VERSION = "2026.06.03";
const OPENAI_TEXT_MODEL = "gpt-5-mini";
const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_OPENAI_VOICE = "coral";
const OPENAI_API_BASE = "https://api.openai.com/v1";
const voiceLanguageMap = {
  sv: "sv-SE",
  en: "en-US",
  fil: "fil-PH",
  ceb: "fil-PH",
};

const settings = loadSettings();
let recognition;
let isRecognizing = false;
let isTranslating = false;
let swRegistration = null;
let pendingVersion = null;

providerSelect.value = settings.provider;
apiKeyInput.value = getCurrentApiKey();
voiceSelect.value = settings.openaiVoice || DEFAULT_OPENAI_VOICE;
libreUrlInput.value = settings.libreUrl;
toggleProviderFields();

boot();

function boot() {
  attachEvents();
  setupSpeechRecognition();
  registerServiceWorker();
  versionLabel.textContent = `Appversion ${APP_VERSION}`;
  updateStatus("Klar att lyssna.");
  updateMessage.textContent = "";
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
  checkUpdateButton.addEventListener("click", checkForUpdates);
  refreshAppButton.addEventListener("click", applyPendingUpdate);
  inputText.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      translateCurrentText();
    }
  });
}

function loadSettings() {
  const fallback = {
    provider: "openai",
    openaiApiKey: "",
    openaiVoice: DEFAULT_OPENAI_VOICE,
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
  if (settings.provider === "openai") {
    settings.openaiApiKey = apiKeyInput.value.trim();
    settings.openaiVoice = voiceSelect.value;
  }

  if (settings.provider === "google") {
    settings.googleApiKey = apiKeyInput.value.trim();
  }

  settings.libreUrl = libreUrlInput.value.trim();
  localStorage.setItem(storageKey, JSON.stringify(settings));
  toggleProviderFields();
  setSettingsOpen(false);
  updateStatus("Inställningarna sparades lokalt i webbläsaren.");
}

function toggleProviderFields() {
  const provider = providerSelect.value;
  const usingLibre = provider === "libre";
  const usingOpenAI = provider === "openai";
  const usingGoogle = provider === "google";

  apiKeyField.classList.toggle("is-hidden", usingLibre);
  voiceField.classList.toggle("is-hidden", !usingOpenAI);
  libreUrlField.classList.toggle("is-hidden", !usingLibre);

  if (usingOpenAI) {
    apiKeyLabel.textContent = "OpenAI API-nyckel";
    apiKeyInput.value = settings.openaiApiKey || "";
    voiceSelect.value = settings.openaiVoice || DEFAULT_OPENAI_VOICE;
    providerNote.textContent =
      "Din OpenAI-nyckel och valda röst sparas bara lokalt på den här enheten. Varje användare behöver ange sin egen nyckel.";
  } else if (usingGoogle) {
    apiKeyLabel.textContent = "Google API-nyckel";
    apiKeyInput.value = settings.googleApiKey || "";
    providerNote.textContent =
      "Din Google-nyckel sparas bara lokalt på den här enheten. Google-spåret kan vara användbart om du vill jämföra kvalitet.";
  } else {
    providerNote.textContent =
      "LibreTranslate kräver ingen nyckel här, men du behöver en kompatibel serveradress.";
  }
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

  if (provider === "openai") {
    if (!settings.openaiApiKey) {
      throw new Error(
        "Lägg till en OpenAI API-nyckel i inställningarna för att använda OpenAI på den här enheten."
      );
    }

    const response = await fetch(`${OPENAI_API_BASE}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_TEXT_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are a precise translation engine for a family language app. Translate the user's text from the source language to the target language. Preserve meaning, tone, and short conversational style. Return only the translated text with no explanation.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Source language: ${getLanguageName(source)}\nTarget language: ${getLanguageName(
                  target
                )}\nText:\n${text}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("OpenAI svarade inte som väntat. Kontrollera API-nyckeln och försök igen.");
    }

    const payload = await response.json();
    const translated = extractOpenAIText(payload).trim();

    if (!translated) {
      throw new Error("OpenAI returnerade ingen översättning.");
    }

    return translated;
  }

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

async function speakText(text, language) {
  if (!text.trim()) {
    updateStatus("Det finns ingen översättning att spela upp.");
    return;
  }

  if ((settings.provider || providerSelect.value) === "openai" && settings.openaiApiKey) {
    try {
      updateStatus("Skapar AI-röst...");
      await speakWithOpenAI(text, language);
      updateStatus("Läser upp med AI-röst.");
      return;
    } catch (error) {
      console.error(error);
      updateStatus("OpenAI-rösten misslyckades. Faller tillbaka till webbläsarröst.");
    }
  }

  if (!("speechSynthesis" in window)) {
    updateStatus("Den här webbläsaren kan inte läsa upp text.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voiceLanguageMap[language] || "en-US";
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
    swRegistration = await navigator.serviceWorker.register("./sw.js");
    bindServiceWorkerEvents(swRegistration);
    await checkForUpdates({ silent: true });
  } catch (error) {
    console.error("Service worker registration failed", error);
  }
}

function bindServiceWorkerEvents(registration) {
  if (registration.waiting) {
    showUpdateAvailable();
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;

    if (!newWorker) {
      return;
    }

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        showUpdateAvailable();
      }
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

async function checkForUpdates(options = {}) {
  const silent = options.silent === true;

  if (!silent) {
    updateMessage.textContent = "Söker efter ny version...";
  }

  try {
    const response = await fetch(`./version.json?ts=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json();
    pendingVersion = payload.version || null;

    if (pendingVersion && pendingVersion !== APP_VERSION) {
      updateMessage.textContent = `Ny version ${pendingVersion} finns. Tryck på Uppdatera appen.`;
      showUpdateAvailable();
    } else if (swRegistration) {
      await swRegistration.update();

      if (swRegistration.waiting) {
        updateMessage.textContent = "En ny version är nedladdad och redo att aktiveras.";
        showUpdateAvailable();
      } else if (!silent) {
        hideUpdateButton();
        updateMessage.textContent = "Du har redan den senaste versionen.";
      }
    } else if (!silent) {
      hideUpdateButton();
      updateMessage.textContent = "Du har redan den senaste versionen.";
    }
  } catch (error) {
    console.error(error);
    if (!silent) {
      updateMessage.textContent = "Kunde inte kontrollera uppdateringar just nu.";
    }
  }
}

function showUpdateAvailable() {
  refreshAppButton.classList.remove("is-hidden");
}

function hideUpdateButton() {
  refreshAppButton.classList.add("is-hidden");
}

async function applyPendingUpdate() {
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    return;
  }

  await checkForUpdates();

  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    return;
  }

  window.location.reload();
}

async function speakWithOpenAI(text, language) {
  const response = await fetch(`${OPENAI_API_BASE}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: settings.openaiVoice || DEFAULT_OPENAI_VOICE,
      input: text,
      instructions: `Speak naturally in ${getLanguageName(language)}. This is an AI-generated voice for a language learning app.`,
      format: "mp3",
    }),
  });

  if (!response.ok) {
    throw new Error("OpenAI kunde inte skapa ljud just nu.");
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);

  audio.addEventListener("ended", () => URL.revokeObjectURL(audioUrl), { once: true });
  audio.addEventListener("error", () => URL.revokeObjectURL(audioUrl), { once: true });

  await audio.play();
}

function extractOpenAIText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return decodeHtmlEntities(payload.output_text);
  }

  const collected = [];

  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") {
        collected.push(content.text);
      } else if (content.type === "output_text" && typeof content.text === "string") {
        collected.push(content.text);
      }
    }
  }

  return decodeHtmlEntities(collected.join("\n").trim());
}

function getCurrentApiKey() {
  if (settings.provider === "google") {
    return settings.googleApiKey || "";
  }

  if (settings.provider === "openai") {
    return settings.openaiApiKey || "";
  }

  return "";
}

function getLanguageName(code) {
  const names = {
    sv: "Swedish",
    en: "English",
    fil: "Tagalog / Filipino",
    ceb: "Cebuano / Bisaya",
  };

  return names[code] || code;
}
