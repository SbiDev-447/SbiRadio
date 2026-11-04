/*
  SbiRadio - Tu Emisora
  Copyright (C) 2026 SbiDev

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

(() => {
  "use strict";

  const audio = document.getElementById("radio-player");
  const status = document.getElementById("stream-status");
  if (!audio || !status) return;

  /* ── Resiliencia del stream ─────────────────────────────────────
     El <audio> nativo nunca reintenta: cuando el stream en vivo cae
     dispara `error` y el reproductor queda muerto sin feedback.
     Estrategia: backoff de 1s/3s con 2 intentos automáticos; si siguen
     fallando dejamos el hint para que el usuario vuelva a disparar. */

  const MAX_RETRIES = 2;
  const RETRY_DELAYS_MS = [1000, 3000];
  const LIVE = "EN VIVO";
  const HINT = "Stream no disponible. Tocá reproducir para reintentar.";

  let retries = 0;
  let retryTimer = 0;

  const showStatus = (text, variant) => {
    status.textContent = text;
    status.classList.toggle("is-live", variant === "live");
    status.hidden = false;
  };

  const hideStatus = () => {
    status.hidden = true;
    status.classList.remove("is-live");
  };

  /* Cancela un reintento pendiente: si el stream se recuperó antes de
     que dispare, no debe recargarlo a la fuerza (bug de carrera). */
  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = 0;
    }
  };

  const attempt = () => {
    audio.load();
    const played = audio.play();
    if (played && typeof played.catch === "function") {
      played.catch(() => showStatus(HINT));
    }
  };

  /* Un intento exitoso borra la deuda, el mensaje y los reintentos pendientes */
  audio.addEventListener("playing", () => {
    retries = 0;
    clearRetry();
    showStatus(LIVE, "live");
  });

  /* Buffering de un stream en vivo: feedback mientras conecta */
  audio.addEventListener("waiting", () => {
    if (!audio.paused) showStatus("Conectando…");
  });

  audio.addEventListener("stalled", () => {
    if (!audio.paused) showStatus("Conectando…");
  });

  audio.addEventListener("pause", () => {
    /* un pause disparado por el propio error no debe tapar el mensaje de fallo */
    if (audio.error) return;
    hideStatus();
  });

  audio.addEventListener("error", () => {
    clearRetry();
    /* el lockscreen no debe seguir mostrando "reproduciendo" si el stream murió */
    if (session) session.playbackState = "none";

    if (retries >= MAX_RETRIES) {
      showStatus(HINT);
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
  audio.addEventListener("click", () => {
    retries = 0;
    clearRetry();
  });

  window.addEventListener("online", () => {
    if (status.hidden) return;
    retries = 0;
    clearRetry();
    attempt();
  });

  /* ── Volumen persistente ──────────────────────────────────────── */

  const STORAGE_KEY = "sbiradio:audio";

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (typeof saved.volume === "number") {
      audio.volume = Math.min(1, Math.max(0, saved.volume));
    }
    if (typeof saved.muted === "boolean") audio.muted = saved.muted;
  } catch {
    /* sin almacenamiento disponible (incógnito, file://): defaults del navegador */
  }

  audio.addEventListener("volumechange", () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ volume: audio.volume, muted: audio.muted }),
      );
    } catch {
      /* sin persistencia en este contexto */
    }
  });

  /* ── Media Session: identidad en pantalla bloqueada ───────────── */

  const session =
    "mediaSession" in navigator && typeof MediaMetadata === "function"
      ? navigator.mediaSession
      : null;

  if (session) {
    const setMetadata = () => {
      try {
        session.metadata = new MediaMetadata({
          title: "SbiRadio - Tu Emisora",
          artist: "Radio Comunitaria",
          artwork: [
            {
              src: "./assets/img/disco.webp",
              sizes: "1307x736",
              type: "image/webp",
            },
          ],
        });
      } catch {
        /* el artwork no es crítico: se degrada en silencio */
      }
    };

    setMetadata();
    /* algunos browsers requieren metadata cerca del inicio de reproducción */
    audio.addEventListener("play", setMetadata);

    try {
      session.setActionHandler("play", () => {
        const played = audio.play();
        if (played && typeof played.catch === "function") played.catch(() => {});
      });
      session.setActionHandler("pause", () => audio.pause());
      session.setActionHandler("stop", () => audio.pause());
    } catch {
      /* acciones no soportadas: los controles nativos siguen operando */
    }

    audio.addEventListener("playing", () => {
      session.playbackState = "playing";
    });

    audio.addEventListener("pause", () => {
      session.playbackState = "paused";
    });
  }
})();
