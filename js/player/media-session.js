/*
  SbiRadio - Tu Emisora · Media Session (identidad en pantalla bloqueada).
*/

import { audio } from "./elements.js";

/* Media Session disponible (o null). Se resuelve al cargar el módulo
   porque la resiliencia lo consulta para limpiar el estado del sistema. */
export const mediaSession =
  "mediaSession" in navigator && typeof MediaMetadata === "function"
    ? navigator.mediaSession
    : null;

export const initMediaSession = () => {
  if (!mediaSession || !audio) return;

  const setMetadata = () => {
    try {
      mediaSession.metadata = new MediaMetadata({
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
    mediaSession.setActionHandler("play", () => {
      const played = audio.play();
      if (played && typeof played.catch === "function") played.catch(() => {});
    });
    mediaSession.setActionHandler("pause", () => audio.pause());
    mediaSession.setActionHandler("stop", () => audio.pause());
  } catch {
    /* acciones no soportadas: los controles nativos siguen operando */
  }

  audio.addEventListener("playing", () => {
    mediaSession.playbackState = "playing";
  });

  audio.addEventListener("pause", () => {
    mediaSession.playbackState = "paused";
  });
};
