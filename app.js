document.addEventListener("DOMContentLoaded", async () => {

  const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
  const MOCKAPI_URL = "https://698def5eaded595c25309065.mockapi.io/api/v1/apyKey";

  let OPENAI_API_KEY = null; // 🔥 ahora es dinámica

  const WAKE_WORD = "Macario";
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
     Mapeo local
  ========================= */
  function localMapCommand(t) {
    const s = normalize(t);

    if (/(^|\b)(adelante|avanza|avance|avanzar)(\b|$)/.test(s)) return "avanzar";
    if (/(^|\b)(atrás|atras|retrocede|retroceder)(\b|$)/.test(s)) return "retroceder";
    if (/(^|\b)(alto|detente|detener|stop|parar)(\b|$)/.test(s)) return "detener";

    if (/(derecha)/.test(s) && /(90|noventa)/.test(s)) return "90° derecha";
    if (/(izquierda)/.test(s) && /(90|noventa)/.test(s)) return "90° izquierda";
    if (/(derecha)/.test(s) && /(360|trescientos sesenta)/.test(s)) return "360° derecha";
    if (/(izquierda)/.test(s) && /(360|trescientos sesenta)/.test(s)) return "360° izquierda";

    if (/(vuelta|gira|girar)/.test(s) && /derecha/.test(s)) return "vuelta derecha";
    if (/(vuelta|gira|girar)/.test(s) && /izquierda/.test(s)) return "vuelta izquierda";

    return null;
  }

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
        setSubstatus("Despierto. Escuchando órdenes…");
      }
      return;
    }

    if (lower.includes(WAKE_WORD)) return;

    const localCmd = localMapCommand(lower);
    if (localCmd) {
      safeText(commandEl, localCmd);
      setSubstatus("Orden reconocida (local).");
      return;
    }

    setSubstatus("Procesando con IA…");
    const cmd = await classifyWithOpenAI(raw);

    safeText(commandEl, cmd);
    setSubstatus(cmd === "Orden no reconocida"
      ? "No se reconoció una orden válida."
      : "Orden reconocida.");
  };

  recognition.onend = () => safeStart();
  recognition.onerror = (e) => {
    setMode("Error", "pill-error");
    setSubstatus(`Error STT: ${e.error}`);
  };

  setMode("Suspendido", "pill-sleep");
  setSubstatus('Sistema en reposo. Di "Macario" para activar.');
  safeStart();

  /* =========================
     OpenAI Clasificador
  ========================= */
  async function classifyWithOpenAI(text) {

    if (!OPENAI_API_KEY) return "Orden no reconocida";

    const system = `
Eres un clasificador de comandos.
Responde ÚNICAMENTE con una de estas opciones exactas:
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

      const out =
        data?.output_text ||
        data?.output?.[0]?.content?.map(c => c?.text).filter(Boolean).join("") ||
        "";

      const result = String(out).trim();
      return ALLOWED_OUTPUTS.has(result)
        ? result
        : "Orden no reconocida";

    } catch {
      return "Orden no reconocida";
    }
  }

});
