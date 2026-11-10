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
  const statusText = document.getElementById("stream-status-text");
  if (!audio || !status || !statusText) return;

  /* Media Session disponible (o null). Se declara antes de los listeners
     porque el de `error` lo consulta para limpiar el estado del sistema. */
  const session =
    "mediaSession" in navigator && typeof MediaMetadata === "function"
      ? navigator.mediaSession
      : null;

  /* ── Resiliencia del stream ─────────────────────────────────────
     El <audio> nativo nunca reintenta: cuando el stream en vivo cae
     dispara `error` y el reproductor queda muerto sin feedback.
     Estrategia: backoff de 1s/3s con 2 intentos automáticos; si siguen
     fallando dejamos el hint para que el usuario vuelva a disparar. */

  const MAX_RETRIES = 2;
  const RETRY_DELAYS_MS = [1000, 3000];
  const LIVE = "EN VIVO";
  const HINT = "Stream no disponible. Pulsa reproducir para reintentar.";

  let retries = 0;
  let retryTimer = 0;

  let statusVisible = false;

  /* Desplazamiento tipo radio de auto: si el mensaje no entra en la placa,
     se mueve de lado a lado en lugar de cortarse. Con movimiento reducido
     no se anima y el CSS cae a puntos suspensivos. */
  const updateMarquee = () => {
    status.classList.remove("is-scrolling");
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      return;
    }

    const style = getComputedStyle(status);
    const innerWidth =
      status.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    const distance = Math.ceil(statusText.scrollWidth - innerWidth);
    if (distance <= 1) return;

    status.style.setProperty("--marquee-distance", `-${distance}px`);
    status.style.setProperty(
      "--marquee-duration",
      `${Math.min(14, Math.max(6, distance / 40))}s`,
    );
    status.classList.add("is-scrolling");
  };

  const showStatus = (text, variant) => {
    statusText.textContent = text;
    status.classList.toggle("is-live", variant === "live");
    statusVisible = true;
    updateMarquee();
  };

  const hideStatus = () => {
    statusText.textContent = "";
    status.classList.remove("is-live", "is-scrolling");
    statusVisible = false;
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

  /* Solo reintenta si el reproductor está detenido por un fallo. Si sigue
     sonando, el navegador se recupera solo: recargarlo cortaría el audio. */
  window.addEventListener("online", () => {
    if (!statusVisible || !audio.paused) return;
    retries = 0;
    clearRetry();
    attempt();
  });

  /* ── Oyentes del stream ─────────────────────────────────────────
     Icecast publica las conexiones activas de cada mount en su endpoint
     de estadísticas. Cada <audio> reproduciendo cuenta como una conexión
     más, igual que un reproductor externo: el número es el total del
     stream, no solo el de esta página.
     Si no hay datos (mount caído, red sin respuesta) el contador se
     oculta: nunca inventamos un cero. */

  const STATS_URL = "https://radios.yanapak.org/status-json.xsl";
  const STREAM_MOUNT = "/SbiRadio";
  const LISTENERS_POLL_MS = 20000;
  const LISTENERS_TIMEOUT_MS = 10000;

  const listeners = document.getElementById("listener-count");
  const listenersValue = listeners?.querySelector(".listeners__value");

  if (listeners && listenersValue) {
    const formatListeners = new Intl.NumberFormat("es");

    let listenersInFlight = false;

    const renderListeners = (count) => {
      /* el espacio ya está reservado en el layout: solo cambia la visibilidad */
      listeners.classList.toggle("is-visible", count !== null);
      if (count === null) return;
      listenersValue.textContent = formatListeners.format(count);
    };

    /* Soporta la forma filtrada (objeto) y la global (array de mounts) */
    const readListeners = (icestats) => {
      const source = Array.isArray(icestats?.source)
        ? icestats.source.find((item) => item.listenurl?.endsWith(STREAM_MOUNT))
        : icestats?.source;
      if (!source || !Number.isInteger(source.listeners)) return null;
      return source.listeners;
    };

    const fetchListeners = async () => {
      if (listenersInFlight || document.hidden || !navigator.onLine) return;
      listenersInFlight = true;

      const controller = new AbortController();
      const abortTimer = setTimeout(
        () => controller.abort(),
        LISTENERS_TIMEOUT_MS,
      );

      try {
        const url = `${STATS_URL}?mount=${encodeURIComponent(STREAM_MOUNT)}`;
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`stats ${response.status}`);
        renderListeners(readListeners((await response.json()).icestats));
      } catch {
        renderListeners(null);
      } finally {
        clearTimeout(abortTimer);
        listenersInFlight = false;
      }
    };

    fetchListeners();
    window.setInterval(fetchListeners, LISTENERS_POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) fetchListeners();
    });
    window.addEventListener("online", fetchListeners);
    /* el propio cliente se suma al mount al arrancar: refresca al instante */
    audio.addEventListener("playing", fetchListeners);
  }

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

  /* ── Controles propios ──────────────────────────────────────────
     Progressive enhancement: sin JS el <audio controls> nativo queda
     como fallback; con JS se oculta y se muestra la placa custom. */

  const controls = document.getElementById("player-controls");
  const playToggle = document.getElementById("play-toggle");
  const volumeInput = document.getElementById("volume");
  const muteToggle = document.getElementById("mute-toggle");

  if (controls && playToggle && volumeInput && muteToggle) {
    audio.removeAttribute("controls");
    controls.hidden = false;

    const setToggleState = (playing) => {
      playToggle.dataset.state = playing ? "playing" : "paused";
      playToggle.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
    };

    /* mute lógico: flag nativo o volumen en cero */
    const isMuted = () => audio.muted || audio.volume === 0;

    /* volumen al que volver si el usuario desmutea desde cero */
    let lastVolume = audio.volume > 0 ? audio.volume : 0.8;

    const setMuteState = () => {
      const muted = isMuted();
      muteToggle.dataset.state = muted ? "muted" : "on";
      muteToggle.setAttribute(
        "aria-label",
        muted ? "Activar sonido" : "Silenciar",
      );
    };

    setToggleState(!audio.paused);
    setMuteState();

    playToggle.addEventListener("click", () => {
      if (!audio.paused) {
        audio.pause();
        return;
      }

      /* Reintento manual: descarta reintentos pendientes y, si el stream
         quedó en error, recarga la fuente antes de reproducir. */
      retries = 0;
      clearRetry();
      if (audio.error) {
        attempt();
        return;
      }

      const played = audio.play();
      if (played && typeof played.catch === "function") {
        played.catch(() => showStatus(HINT));
      }
    });

    muteToggle.addEventListener("click", () => {
      if (isMuted()) {
        audio.muted = false;
        if (audio.volume === 0) audio.volume = lastVolume;
      } else {
        lastVolume = audio.volume;
        audio.muted = true;
      }
      setMuteState();
    });

    audio.addEventListener("play", () => setToggleState(true));
    audio.addEventListener("pause", () => setToggleState(false));

    volumeInput.value = String(audio.volume);
    volumeInput.addEventListener("input", () => {
      audio.muted = false; /* mover el slider devuelve el sonido */
      audio.volume = Number(volumeInput.value);
      setMuteState();
    });

    /* sincroniza slider y botón si el volumen/mute cambia por fuera */
    audio.addEventListener("volumechange", () => {
      if (volumeInput.value !== String(audio.volume)) {
        volumeInput.value = String(audio.volume);
      }
      if (audio.volume > 0) lastVolume = audio.volume;
      setMuteState();
    });
  }

  /* ── Media Session: identidad en pantalla bloqueada ───────────── */

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

/* ── Compartir ────────────────────────────────────────────────────
   Botón opcional: usa la hoja nativa del sistema cuando existe y cae a
   copiar el enlace. Sin JS, o sin ninguna de las dos APIs, el botón
   queda oculto y la sección sigue funcionando con los enlaces normales. */

(() => {
  "use strict";

  const button = document.getElementById("share-button");
  const status = document.getElementById("share-status");
  if (!button) return;

  const canShare = typeof navigator.share === "function";
  const canCopy =
    typeof navigator.clipboard?.writeText === "function" &&
    window.isSecureContext;

  if (!canShare && !canCopy) return;

  button.hidden = false;

  let resetTimer = 0;
  const announce = (message) => {
    if (!status) return;
    status.textContent = message;
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      status.textContent = "";
    }, 3000);
  };

  button.addEventListener("click", async () => {
    const url = window.location.href;

    try {
      if (canShare) {
        await navigator.share({
          title: document.title,
          text: "Escucha SbiRadio",
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      announce("Enlace copiado");
    } catch (error) {
      /* cancelar la hoja nativa no es un error */
      if (error && error.name === "AbortError") return;
      announce("No se pudo compartir. Copia el enlace de la barra.");
    }
  });
})();
