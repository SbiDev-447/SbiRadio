/*
  SbiRadio - Tu Emisora · placa de estado del stream.

  Desplazamiento tipo radio de auto: si el mensaje no entra en la placa,
  se mueve de lado a lado en lugar de cortarse. Con movimiento reducido
  no se anima y el CSS cae a puntos suspensivos.
*/

import { statusBoard, statusText } from "./elements.js";

export const LIVE_TEXT = "EN VIVO";
export const RETRY_HINT =
  "Stream no disponible. Pulsa reproducir para reintentar.";

let visible = false;

const updateMarquee = () => {
  statusBoard.classList.remove("is-scrolling");
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    return;
  }

  const style = getComputedStyle(statusBoard);
  const innerWidth =
    statusBoard.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight);
  const distance = Math.ceil(statusText.scrollWidth - innerWidth);
  if (distance <= 1) return;

  statusBoard.style.setProperty("--marquee-distance", `-${distance}px`);
  statusBoard.style.setProperty(
    "--marquee-duration",
    `${Math.min(14, Math.max(6, distance / 40))}s`,
  );
  statusBoard.classList.add("is-scrolling");
};

export const showStatus = (text, variant) => {
  if (!statusBoard || !statusText) return;
  statusText.textContent = text;
  statusBoard.classList.toggle("is-live", variant === "live");
  visible = true;
  updateMarquee();
};

export const hideStatus = () => {
  if (!statusBoard || !statusText) return;
  statusText.textContent = "";
  statusBoard.classList.remove("is-live", "is-scrolling");
  visible = false;
};

export const isStatusVisible = () => visible;

/* Devuelve false si la página no tiene placa de estado: en ese caso el
   resto del reproductor no se inicializa (mismo comportamiento previo). */
export const initStatus = () => Boolean(statusBoard && statusText);
