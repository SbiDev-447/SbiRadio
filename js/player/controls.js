/*
  SbiRadio - Tu Emisora · controles propios.

  Progressive enhancement: sin JS el <audio controls> nativo queda
  como fallback; con JS se oculta y se muestra la placa custom.
*/

import {
  audio,
  controls,
  muteToggle,
  playToggle,
  volumeInput,
} from "./elements.js";
import { attempt, resetRetries } from "./resilience.js";
import { RETRY_HINT, showStatus } from "./status.js";

export const initControls = () => {
  if (!audio || !controls || !playToggle || !volumeInput || !muteToggle) return;

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
    resetRetries();
    if (audio.error) {
      attempt();
      return;
    }

    const played = audio.play();
    if (played && typeof played.catch === "function") {
      played.catch(() => showStatus(RETRY_HINT));
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
};
