/*
  SbiRadio - Tu Emisora · compartir.

  Botón opcional: usa la hoja nativa del sistema cuando existe y cae a
  copiar el enlace. Sin JS, o sin ninguna de las dos APIs, el botón
  queda oculto y la sección sigue funcionando con los enlaces normales.
*/

import { shareButton, shareStatus } from "./player/elements.js";

export const initShare = () => {
  if (!shareButton) return;

  const canShare = typeof navigator.share === "function";
  const canCopy =
    typeof navigator.clipboard?.writeText === "function" &&
    window.isSecureContext;

  if (!canShare && !canCopy) return;

  shareButton.hidden = false;

  let resetTimer = 0;
  const announce = (message) => {
    if (!shareStatus) return;
    shareStatus.textContent = message;
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      shareStatus.textContent = "";
    }, 3000);
  };

  shareButton.addEventListener("click", async () => {
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
};
