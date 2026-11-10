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
  Referencias al DOM de la página. Cada módulo consulta aquí lo que
  necesita y se protege por su cuenta: en el HTML hay piezas opcionales
  (controles custom, contador de oyentes, botón de compartir) y el sitio
  debe seguir funcionando aunque falte alguna.
*/

export const audio = document.getElementById("radio-player");

export const statusBoard = document.getElementById("stream-status");
export const statusText = document.getElementById("stream-status-text");

export const listenerCount = document.getElementById("listener-count");
export const listenerValue = listenerCount?.querySelector(".listeners__value");

export const controls = document.getElementById("player-controls");
export const playToggle = document.getElementById("play-toggle");
export const volumeInput = document.getElementById("volume");
export const muteToggle = document.getElementById("mute-toggle");

export const shareButton = document.getElementById("share-button");
export const shareStatus = document.getElementById("share-status");
