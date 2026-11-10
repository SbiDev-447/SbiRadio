/*
  SbiRadio - Tu Emisora · contador de oyentes.

  Icecast publica las conexiones activas de cada mount en su endpoint
  de estadísticas. Cada <audio> reproduciendo cuenta como una conexión
  más, igual que un reproductor externo: el número es el total del
  stream, no solo el de esta página.
  Si no hay datos (mount caído, red sin respuesta) el contador se
  oculta: nunca inventamos un cero.
*/

import { audio, listenerCount, listenerValue } from "./player/elements.js";

const STATS_URL = "https://radios.yanapak.org/status-json.xsl";
const STREAM_MOUNT = "/SbiRadio";
const LISTENERS_POLL_MS = 20000;
const LISTENERS_TIMEOUT_MS = 10000;

export const initListeners = () => {
  if (!listenerCount || !listenerValue) return;

  const formatListeners = new Intl.NumberFormat("es");

  let inFlight = false;

  const renderListeners = (count) => {
    /* el espacio ya está reservado en el layout: solo cambia la visibilidad */
    listenerCount.classList.toggle("is-visible", count !== null);
    if (count === null) return;
    listenerValue.textContent = formatListeners.format(count);
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
    if (inFlight || document.hidden || !navigator.onLine) return;
    inFlight = true;

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
      inFlight = false;
    }
  };

  fetchListeners();
  window.setInterval(fetchListeners, LISTENERS_POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) fetchListeners();
  });
  window.addEventListener("online", fetchListeners);
  /* el propio cliente se suma al mount al arrancar: refresca al instante */
  if (audio) audio.addEventListener("playing", fetchListeners);
};
