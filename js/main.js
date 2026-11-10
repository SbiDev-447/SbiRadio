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

/*
  Punto de entrada del sitio. Cada pieza del reproductor vive en su
  propio módulo y aquí solo se decide el orden de arranque.

  El orden importa:
  1. la placa de estado y la resiliencia registran primero sus listeners;
  2. el contador de oyentes se engancha al arranque del stream;
  3. el volumen se restaura antes de montar los controles (leen
     `audio.volume` al inicializarse);
  4. Media Session va al final, cuando el reproductor ya funciona.
*/

import { audio } from "./player/elements.js";
import { initStatus } from "./player/status.js";
import { initResilience } from "./player/resilience.js";
import { initListeners } from "./listeners.js";
import { initVolume } from "./player/volume.js";
import { initControls } from "./player/controls.js";
import { initMediaSession } from "./player/media-session.js";
import { initShare } from "./share.js";

const statusReady = initStatus();

/* Sin <audio> o sin placa de estado no hay reproductor que inicializar. */
if (audio && statusReady) {
  initResilience();
  initListeners();
  initVolume();
  initControls();
  initMediaSession();
}

initShare();
