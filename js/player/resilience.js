/*
  SbiRadio - Tu Emisora · resiliencia del stream.

  El <audio> nativo nunca reintenta: cuando el stream en vivo cae dispara
  `error` y el reproductor queda muerto sin feedback.
  Estrategia: backoff de 1s/3s con 2 intentos automáticos; si siguen
  fallando dejamos el hint para que el usuario vuelva a disparar.
*/

import { audio } from "./elements.js";
import { mediaSession } from "./media-session.js";
import {
  LIVE_TEXT,
  RETRY_HINT,
  hideStatus,
  isStatusVisible,
  showStatus,
} from "./status.js";

const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [1000, 3000];

const CONNECTING_TEXT = "Conectando…";
/* Un corte más breve que esto no amerita cartel: evita parpadeos con el
   jitter normal de un stream en vivo. */
const CONNECTING_DELAY_MS = 600;

let retries = 0;
let retryTimer = 0;
let connecting = false;
let connectingTimer = 0;

/* Cancela un reintento pendiente: si el stream se recuperó antes de
   que dispare, no debe recargarlo a la fuerza (bug de carrera). */
const clearRetry = () => {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = 0;
  }
};

/* Un gesto del usuario o la red que vuelve borran la deuda de reintentos. */
export const resetRetries = () => {
  retries = 0;
  clearRetry();
};

export const attempt = () => {
  audio.load();
  const played = audio.play();
  if (played && typeof played.catch === "function") {
    played.catch(() => showStatus(RETRY_HINT));
  }
};

export const initResilience = () => {
  if (!audio) return;

  const clearConnectingTimer = () => {
    if (connectingTimer) {
      clearTimeout(connectingTimer);
      connectingTimer = 0;
    }
  };

  /* Solo avisamos "Conectando…" si la reproducción sigue sin avanzar
     pasado el debounce; si se recupera antes, el timer se cancela. */
  const scheduleConnecting = () => {
    if (connecting || connectingTimer) return;
    connectingTimer = setTimeout(() => {
      connectingTimer = 0;
      if (audio.paused || audio.error) return;
      connecting = true;
      showStatus(CONNECTING_TEXT);
    }, CONNECTING_DELAY_MS);
  };

  /* Hay reproducción real: cualquier aviso de conexión pendiente sobra. */
  const markPlaying = () => {
    clearConnectingTimer();
    if (!connecting) return;
    connecting = false;
    showStatus(LIVE_TEXT, "live");
  };

  /* Un intento exitoso borra la deuda, el mensaje y los reintentos pendientes */
  audio.addEventListener("playing", () => {
    connecting = false;
    clearConnectingTimer();
    resetRetries();
    showStatus(LIVE_TEXT, "live");
  });

  /* Buffering de un stream en vivo: feedback mientras conecta */
  audio.addEventListener("waiting", () => {
    if (!audio.paused) scheduleConnecting();
  });

  audio.addEventListener("stalled", () => {
    if (!audio.paused) scheduleConnecting();
  });

  /* Algunos navegadores no vuelven a disparar `playing` cuando el audio se
     recupera de un corte breve: si el tiempo avanza, hay reproducción. Sin
     esto la placa se queda en "Conectando…" con el stream ya sonando. */
  audio.addEventListener("timeupdate", markPlaying);

  audio.addEventListener("pause", () => {
    /* un pause disparado por el propio error no debe tapar el mensaje de fallo */
    if (audio.error) return;
    connecting = false;
    clearConnectingTimer();
    hideStatus();
  });

  audio.addEventListener("error", () => {
    connecting = false;
    clearConnectingTimer();
    clearRetry();
    /* el lockscreen no debe seguir mostrando "reproduciendo" si el stream murió */
    if (mediaSession) mediaSession.playbackState = "none";

    if (retries >= MAX_RETRIES) {
      showStatus(RETRY_HINT);
      return;
    }
    retries += 1;
    showStatus(`Se cortó el stream. Reintentando (${retries}/${MAX_RETRIES})…`);
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      attempt();
    }, RETRY_DELAYS_MS[retries - 1] ?? 1000);
  });

  /* Gestos del usuario y red que vuelve le devuelven los intentos */
  audio.addEventListener("click", resetRetries);

  /* Solo reintenta si el reproductor está detenido por un fallo. Si sigue
     sonando, el navegador se recupera solo: recargarlo cortaría el audio. */
  window.addEventListener("online", () => {
    if (!isStatusVisible() || !audio.paused) return;
    resetRetries();
    attempt();
  });
};
