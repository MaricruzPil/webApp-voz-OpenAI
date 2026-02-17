document.addEventListener("DOMContentLoaded", async () => {
  const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
  const MOCKAPI_URL = "https://698def5eaded595c25309065.mockapi.io/api/v1/apyKey";

  let OPENAI_API_KEY = null; // 🔥 ahora es dinámica

  const WAKE_WORD = "macaria";
  const IDLE_MS = 10000;

  const ALLOWED_OUTPUTS = new Set([
    "avanzar",
    "retroceder",
    "detener",
    "vuelta derecha",
    "vuelta izquierda",
    "90° derecha",
    "90° izquierda",
    "360° derecha",
    "360° izquierda",
    "Orden no reconocida",
  ]);

  const modePill = document.getElementById("modePill");
  const transcriptEl = document.getElementById("transcript");
  const commandEl = document.getElementById("command");
  const substatusEl = document.getElementById("substatus");

  function safeText(el, text) {
    if (el) el.textContent = text;
  }

  function setMode(text, cls) {
    if (!modePill) return;
    modePill.textContent = text;
    modePill.className = `pill ${cls}`;
  }

  function setSubstatus(text) {
    safeText(substatusEl, text);
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  /* =====================================================
     🔥 OBTENER API KEY DESDE MOCKAPI
  ===================================================== */
  async function getApiKeyFromMockAPI() {
    try {
      const response = await fetch(MOCKAPI_URL);
      if (!response.ok) throw new Error("No se pudo obtener API Key");

      const data = await response.json();

      // Tomar el primer registro
      if (Array.isArray(data) && data.length > 0 && data[0].apikey) {
        return data[0].apikey;
      }

      throw new Error("Formato inválido en MockAPI");
    } catch (error) {
      console.error("Error obteniendo API Key:", error);
      setMode("Error API Key", "pill-error");
      setSubstatus("No se pudo cargar la API Key desde MockAPI.");
      return null;
    }
  }

  // 🔥 Cargar API Key al iniciar
  OPENAI_API_KEY = await getApiKeyFromMockAPI();







  /* =========================
     SPEECH RECOGNITION
  ========================= */
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setMode("No compatible", "pill-error");
    setSubstatus("Tu navegador no soporta SpeechRecognition.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "es-MX";
  recognition.continuous = true;
  recognition.interimResults = false;

  let suspended = true;
  let idleTimer = null;

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      suspended = true;
      setMode("Suspendido", "pill-sleep");
      setSubstatus('Suspendido por inactividad. Di "Macario" para despertar.');
      safeText(commandEl, "—");
    }, IDLE_MS);
  }

  function safeStart() {
    try { recognition.start(); } catch (_) {}
  }

  recognition.onresult = async (event) => {
  const last = event.results[event.results.length - 1];
  const raw = last?.[0]?.transcript?.trim() || "";
  if (!raw) return;

  safeText(transcriptEl, raw);
  resetIdleTimer();

  const lower = normalize(raw);

  if (suspended) {
    if (lower.includes(WAKE_WORD)) {
      suspended = false;
      setMode("Activo", "pill-active");
      setSubstatus("Despierta. Escuchando…");
    }
    return;
  }

  if (lower.includes(WAKE_WORD)) return;

  setSubstatus("Interpretando con IA…");

  const cmd = await classifyWithOpenAI(raw);

  safeText(commandEl, cmd);

  setSubstatus(
    cmd === "Orden no reconocida"
      ? "No entendí la instrucción."
      : "Orden ejecutada."
  );
};


  recognition.onend = () => safeStart();
  recognition.onerror = (e) => {
    setMode("Error", "pill-error");
    setSubstatus(`Error STT: ${e.error}`);
  };

  setMode("Suspendido", "pill-sleep");
  setSubstatus('Sistema en reposo. Di "Macario" para activar.');
  safeStart();

async function classifyWithOpenAI(text) {

  if (!OPENAI_API_KEY) return "Orden no reconocida";

  const system = `
Eres un sistema de control de movimiento.

Tu tarea es interpretar cualquier frase en español y clasificarla
EXCLUSIVAMENTE en una de las siguientes opciones exactas:

avanzar
retroceder
detener
vuelta derecha
vuelta izquierda
90° derecha
90° izquierda
360° derecha
360° izquierda
Orden no reconocida

No expliques.
No agregues texto adicional.
No agregues puntuación.
Responde únicamente con una opción exacta.
`.trim();

  try {
    const r = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: text }
        ],
        temperature: 0
      })
    });

    if (!r.ok) return "Orden no reconocida";

    const data = await r.json();

    const output =
      data?.output_text ||
      data?.output?.[0]?.content?.map(c => c?.text).filter(Boolean).join("") ||
      "";

    const result = String(output).trim();

    return ALLOWED_OUTPUTS.has(result)
      ? result
      : "Orden no reconocida";

  } catch {
    return "Orden no reconocida";
  }
}



/* =========================
   VOZ DE BIENVENIDA ESTABLE
========================= */

let bienvenidaHablada = false;
const replayBtn = document.getElementById("replayWelcome");
replayBtn?.classList.add("blinking");

// 🔹 Función que habla
function speakWelcome() {
  replayBtn?.classList.remove("blinking");


  if (!window.speechSynthesis) return;

  speechSynthesis.cancel(); // limpia cola

  const mensaje = `
  Hola.
  Soy Macaria, tu asistente de control por voz.
  Estoy lista para ayudarte y acepto comandos como:
  avanza, detente, retrocede,
  gira a la derecha o a la izquierda,
  o vuelta completa.
  Para darme una orden, solo di mi nombre seguido de la orden. Por ejemplo: Macaria, avanza.
  Te escucho.

  `;

  const speech = new SpeechSynthesisUtterance(mensaje);

  speech.lang = "es-MX";
  speech.rate = 1.5;
  speech.pitch = 1.08;
  speech.volume = 1;

  function elegirVozFemenina() {
    const voices = speechSynthesis.getVoices();

    // Buscar voces femeninas por nombre común
    const vozFemenina =
      voices.find(v =>
        v.lang.includes("es") &&
        (
          v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("mujer") ||
          v.name.toLowerCase().includes("woman") ||
          v.name.toLowerCase().includes("paulina") ||
          v.name.toLowerCase().includes("monica") ||
          v.name.toLowerCase().includes("helena") ||
          v.name.toLowerCase().includes("sabina")
        )
      ) ||
      voices.find(v => v.lang === "es-MX") ||
      voices.find(v => v.lang.includes("es"));

    if (vozFemenina) speech.voice = vozFemenina;

    speechSynthesis.speak(speech);
  }
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = elegirVozFemenina;
  } else {
    elegirVozFemenina();
  }

  speech.onstart = () => {
    document.querySelector(".wave")?.classList.add("active");
  };

  speech.onend = () => {
    document.querySelector(".wave")?.classList.remove("active");
    replayBtn?.classList.add("blinking");

  };
}

// 🔹 Esperar 2 segundos y preparar activación
setTimeout(() => {
  document.addEventListener("click", iniciarBienvenida, { once: true });
}, 2000);

function iniciarBienvenida() {
  if (!bienvenidaHablada) {
    bienvenidaHablada = true;
    speakWelcome();
  }
}

// 🔹 Botón de recarga
replayBtn?.addEventListener("click", () => {
  speakWelcome();
});


 








});