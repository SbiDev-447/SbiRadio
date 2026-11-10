/*
  SbiRadio - Tu Emisora · volumen y mute persistentes.

  Guarda volumen y mute en localStorage para que la próxima visita
  arranque como la dejó el oyente. Sin almacenamiento disponible
  (incógnito, file://) se usan los defaults del navegador.
*/

import { audio } from "./elements.js";

const STORAGE_KEY = "sbiradio:audio";

export const initVolume = () => {
  if (!audio) return;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (typeof saved.volume === "number") {
      audio.volume = Math.min(1, Math.max(0, saved.volume));
    }
    if (typeof saved.muted === "boolean") audio.muted = saved.muted;
  } catch {
    /* sin almacenamiento disponible: defaults del navegador */
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
};
