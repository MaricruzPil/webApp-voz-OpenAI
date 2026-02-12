# 🎙️ Macario Voice Controller

Aplicación web que utiliza reconocimiento de voz en español (es-MX) para interpretar comandos y clasificarlos como instrucciones de movimiento mediante procesamiento local y apoyo de OpenAI.

El sistema funciona con una palabra activadora (wake word) y muestra en pantalla:

- 🗣️ Transcripción de la instrucción
- 🤖 Comando interpretado
- 🔵 Estado del sistema (Suspendido / Activo)

---

## 🚀 Características

- ✅ Reconocimiento de voz en tiempo real (Web Speech API)
- ✅ Wake word configurable (actualmente: **"Macario"**)
- ✅ Clasificación local rápida mediante expresiones regulares
- ✅ Clasificación inteligente con OpenAI como respaldo
- ✅ Obtención dinámica de API Key desde MockAPI
- ✅ Interfaz visual moderna y reactiva
- ✅ Sistema de suspensión automática por inactividad

---

## 🧠 Comandos Soportados

El sistema puede interpretar variaciones y sinónimos de las siguientes instrucciones:

- `avanzar`
- `retroceder`
- `detener`
- `vuelta derecha`
- `vuelta izquierda`
- `90° derecha`
- `90° izquierda`
- `360° derecha`
- `360° izquierda`
- `Orden no reconocida`

Ejemplos válidos:

- "Macario, avanza"
- "Macario, puedes ir hacia enfrente"
- "Macario, no te muevas"
- "Macario, gira 90 grados a la derecha"

