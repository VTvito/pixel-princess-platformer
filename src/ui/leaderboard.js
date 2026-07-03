// leaderboard.js (UI) — the DOM overlay for the global leaderboard.
//
// Pure DOM (like the other overlays), opened from the finale (submit mode) and the menu
// (read-only standings). It owns the small amount of logic — fetching, submitting, rendering —
// and leans on the graceful client (src/leaderboard.js): if the store is unavailable the list
// just shows a friendly "non disponibile" and nothing breaks. Markup lives in index.html.

import { fetchTop, submitScore } from "../leaderboard.js";
import { getNickname, setNickname } from "../state.js";
import { formatDuration } from "../format.js";

let overlay = null;
let form = null;
let scoreEl = null;
let timeEl = null;
let input = null;
let submitBtn = null;
let listEl = null;
let statusEl = null;
let closeBtn = null;

function els() {
  overlay ||= document.getElementById("leaderboard-overlay");
  form ||= document.getElementById("lb-form");
  scoreEl ||= document.getElementById("lb-score");
  timeEl ||= document.getElementById("lb-time");
  input ||= document.getElementById("nickname-input");
  submitBtn ||= document.getElementById("lb-submit");
  listEl ||= document.getElementById("lb-list");
  statusEl ||= document.getElementById("lb-status");
  closeBtn ||= document.getElementById("lb-close");
}

// Paint the standings. `list` is the array from the client, or null when unavailable.
function renderTop(list) {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!Array.isArray(list)) {
    if (statusEl) statusEl.textContent = "Classifica non disponibile. Riprova più tardi.";
    return;
  }
  if (list.length === 0) {
    if (statusEl) statusEl.textContent = "Ancora nessun punteggio. Sii la prima!";
    return;
  }
  const me = getNickname();
  list.forEach((row, i) => {
    const li = document.createElement("li");
    if (row.name === me) li.className = "lb-me"; // highlight the player's own line
    const rank = document.createElement("span");
    rank.className = "lb-rank";
    rank.textContent = `${i + 1}`;
    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = row.name;
    // Time-attack: the rank is BY time (fastest first), so the time is the emphasised column;
    // the run's score rides along as a secondary stat.
    const time = document.createElement("span");
    time.className = "lb-time";
    time.textContent = `${formatDuration(row.time)} ⏱`;
    const pts = document.createElement("span");
    pts.className = "lb-pts";
    pts.textContent = `${row.score ?? 0} ★`;
    li.append(rank, name, time, pts);
    listEl.appendChild(li);
  });
}

/**
 * Open in SUBMIT mode (finale): prefill the nickname, show the form with the run's time + score,
 * list current standings. The classifica ranks by fastest time (time-attack).
 */
export function openLeaderboard({ score, timeMs }) {
  els();
  if (!overlay) return;
  overlay.hidden = false;
  if (form) form.hidden = false;
  if (scoreEl) scoreEl.textContent = String(score);
  if (timeEl) timeEl.textContent = formatDuration(timeMs);
  if (input) input.value = getNickname();
  if (statusEl) statusEl.textContent = "Caricamento…";
  if (listEl) listEl.innerHTML = "";

  const send = async () => {
    const nickname = (input?.value || "").trim();
    if (!nickname) {
      if (statusEl) statusEl.textContent = "Scrivi un nome per entrare in classifica.";
      input?.focus();
      return;
    }
    setNickname(nickname);
    if (submitBtn) submitBtn.disabled = true;
    if (statusEl) statusEl.textContent = "Invio…";
    const top = await submitScore({ nickname, score, timeMs });
    if (submitBtn) submitBtn.disabled = false;
    if (top) {
      if (form) form.hidden = true; // sent — collapse the form, show the standings
      if (statusEl) statusEl.textContent = "Punteggio inviato! 🎉";
      renderTop(top);
    } else if (statusEl) {
      statusEl.textContent = "Classifica non raggiungibile. Riprova più tardi.";
    }
  };
  if (submitBtn) submitBtn.onclick = send;
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        send();
      }
    };
  }
  if (closeBtn) closeBtn.onclick = hideLeaderboard;

  // Show the current standings underneath the form right away.
  fetchTop().then((top) => {
    if (overlay.hidden) return; // closed before the fetch resolved
    if (statusEl && statusEl.textContent === "Caricamento…") statusEl.textContent = "";
    if (top) renderTop(top);
    else if (statusEl) statusEl.textContent = "Classifica non disponibile. Riprova più tardi.";
  });
}

/** Open in READ-ONLY mode (menu): just the standings, no submit form. */
export function openLeaderboardReadOnly() {
  els();
  if (!overlay) return;
  overlay.hidden = false;
  if (form) form.hidden = true;
  if (statusEl) statusEl.textContent = "Caricamento…";
  if (listEl) listEl.innerHTML = "";
  if (closeBtn) closeBtn.onclick = hideLeaderboard;
  fetchTop().then((top) => {
    if (overlay.hidden) return;
    if (statusEl && statusEl.textContent === "Caricamento…") statusEl.textContent = "";
    if (top) renderTop(top);
    else if (statusEl) statusEl.textContent = "Classifica non disponibile. Riprova più tardi.";
  });
}

/** Hide the overlay (also called defensively when entering other scenes). */
export function hideLeaderboard() {
  els();
  if (overlay) overlay.hidden = true;
}
