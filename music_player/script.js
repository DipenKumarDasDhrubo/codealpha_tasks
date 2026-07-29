/* ==================================================================
   NIGHTSHIFT MUSIC PLAYER
   Vanilla JS audio player. Tracks are synthesized in-browser as WAV
   blobs so the player is fully playable with zero external assets.
   Swap `TRACKS[i].src` for a real file/URL to use your own audio —
   the player logic does not change.
   ================================================================== */

/* ---------- 1. Tiny WAV synthesizer (demo audio only) ---------- */

const SAMPLE_RATE = 44100;

function noteToBuffer(freq, seconds, sampleRate, wave = "sine") {
  const n = Math.floor(seconds * sampleRate);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let sample;
    if (wave === "sine") sample = Math.sin(2 * Math.PI * freq * t);
    else if (wave === "triangle") sample = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t));
    else sample = Math.sin(2 * Math.PI * freq * t) * 0.6 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.2;

    // quick attack / release envelope so notes don't click
    const attack = Math.min(1, i / (sampleRate * 0.015));
    const release = Math.min(1, (n - i) / (sampleRate * 0.05));
    data[i] = sample * Math.min(attack, release) * 0.5;
  }
  return data;
}

function buildMelody(sequence, loops, sampleRate) {
  const chunks = [];
  for (let l = 0; l < loops; l++) {
    sequence.forEach(([freq, dur, wave]) => {
      chunks.push(noteToBuffer(freq, dur, sampleRate, wave));
    });
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  chunks.forEach((c) => { out.set(c, offset); offset += c.length; });
  return out;
}

function floatTo16WavBlob(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);       // PCM
  view.setUint16(22, 1, true);       // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

/* Note frequencies (Hz) for reference: A3=220 C4=261.6 D4=293.7 E4=329.6
   F4=349.2 G4=392 A4=440 C5=523.3 D5=587.3 E5=659.3 G5=784 */

const MELODIES = [
  // Midnight Circuit — moody minor arpeggio
  [[220, 0.35, "sine"], [261.6, 0.35, "sine"], [329.6, 0.35, "sine"], [392, 0.5, "sine"],
   [349.2, 0.35, "sine"], [293.7, 0.35, "sine"], [261.6, 0.5, "sine"]],
  // Analog Drift — slow triangle pads
  [[196, 0.6, "triangle"], [246.9, 0.6, "triangle"], [293.7, 0.9, "triangle"],
   [261.6, 0.6, "triangle"], [220, 0.9, "triangle"]],
  // Neon Static — brighter, quicker pulses
  [[392, 0.22, "sine"], [440, 0.22, "sine"], [523.3, 0.22, "sine"], [587.3, 0.22, "sine"],
   [523.3, 0.22, "sine"], [440, 0.22, "sine"], [392, 0.4, "sine"]],
  // Vinyl Hour — warm mixed-wave chord walk
  [[261.6, 0.5, "mix"], [329.6, 0.5, "mix"], [392, 0.5, "mix"], [440, 0.7, "mix"],
   [392, 0.5, "mix"], [329.6, 0.5, "mix"]]
];

const TRACKS = [
  { title: "Midnight Circuit", artist: "Synth Collective", initials: "MC", loops: 4, source: "demo" },
  { title: "Analog Drift",     artist: "Synth Collective", initials: "AD", loops: 3, source: "demo" },
  { title: "Neon Static",      artist: "Low Voltage",      initials: "NS", loops: 4, source: "demo" },
  { title: "Vinyl Hour",       artist: "Low Voltage",      initials: "VH", loops: 3, source: "demo" }
];

/* Build each track's audio object URL once, up front. */
TRACKS.forEach((track, i) => {
  const samples = buildMelody(MELODIES[i], track.loops, SAMPLE_RATE);
  const blob = floatTo16WavBlob(samples, SAMPLE_RATE);
  track.src = URL.createObjectURL(blob);
  track.durationSeconds = samples.length / SAMPLE_RATE;
});

/* ---------- 2. Player state + DOM references ---------- */

const audio = new Audio();
audio.volume = 0.7;

let currentIndex = 0;
let isSeeking = false;

const el = {
  disc: document.getElementById("disc"),
  tonearm: document.getElementById("tonearm"),
  discInitials: document.getElementById("discInitials"),
  trackTitle: document.getElementById("trackTitle"),
  trackArtist: document.getElementById("trackArtist"),
  trackCounter: document.getElementById("trackCounter"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime"),
  seekBar: document.getElementById("seekBar"),
  playBtn: document.getElementById("playBtn"),
  playIcon: document.getElementById("playIcon"),
  pauseIcon: document.getElementById("pauseIcon"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  volumeBar: document.getElementById("volumeBar"),
  volIcon: document.getElementById("volIcon"),
  autoplayCheck: document.getElementById("autoplayCheck"),
  playlistList: document.getElementById("playlistList"),
  playlistCount: document.getElementById("playlistCount"),

  syncDeviceBtn: document.getElementById("syncDeviceBtn"),
  deviceFileInput: document.getElementById("deviceFileInput"),
  playOnlineBtn: document.getElementById("playOnlineBtn"),
  onlineModalOverlay: document.getElementById("onlineModalOverlay"),
  onlineUrlInput: document.getElementById("onlineUrlInput"),
  onlineTitleInput: document.getElementById("onlineTitleInput"),
  onlineCancelBtn: document.getElementById("onlineCancelBtn"),
  onlineConfirmBtn: document.getElementById("onlineConfirmBtn"),
  toast: document.getElementById("toast")
};

/* ---------- 3. Helpers ---------- */

function formatTime(seconds) {
  if (seconds === null || seconds === undefined || !isFinite(seconds)) return "--:--";
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fileNameToTitle(name) {
  return name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled";
}

function urlToTitle(url) {
  try {
    const clean = decodeURIComponent(url.split("?")[0].split("/").pop() || "");
    return fileNameToTitle(clean) || "Online track";
  } catch {
    return "Online track";
  }
}

let toastTimer = null;
function showToast(message, type = "error") {
  el.toast.textContent = message;
  el.toast.hidden = false;
  el.toast.className = `toast toast--${type}`;
  // force reflow so the transition re-plays on repeated toasts
  void el.toast.offsetWidth;
  el.toast.classList.add("is-visible");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.remove("is-visible");
    setTimeout(() => { el.toast.hidden = true; }, 250);
  }, 4500);
}

function setSeekFill(inputEl, percent) {
  inputEl.style.setProperty("--fill", `${percent}%`);
}

/* ---------- 4. Playlist rendering ---------- */

function renderPlaylist() {
  el.playlistList.innerHTML = "";
  TRACKS.forEach((track, i) => {
    const li = document.createElement("li");
    li.className = "playlist-item-row";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "playlist-item" + (i === currentIndex ? " is-active" : "");
    btn.setAttribute("aria-current", i === currentIndex ? "true" : "false");
    const sourceTag = track.source && track.source !== "demo"
      ? `<span class="playlist-item-source playlist-item-source--${track.source}">${track.source}</span>`
      : "";
    btn.innerHTML = `
      <span class="playlist-item-index">${(i + 1).toString().padStart(2, "0")}</span>
      <span class="playlist-item-meta">
        <div class="playlist-item-title">${track.title}</div>
        <div class="playlist-item-artist">${track.artist}</div>
      </span>
      <span class="playlist-item-wave" aria-hidden="true"><span></span><span></span><span></span></span>
      ${sourceTag}
      <span class="playlist-item-duration">${formatTime(track.durationSeconds)}</span>
    `;
    btn.addEventListener("click", () => {
      if (i === currentIndex) {
        togglePlay();
      } else {
        loadTrack(i, true);
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "playlist-item-delete";
    deleteBtn.setAttribute("aria-label", `Delete ${track.title}`);
    deleteBtn.title = "Delete";
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7h16"/>
        <path d="M9 7V4h6v3"/>
        <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/>
        <path d="M10 11v6M14 11v6"/>
      </svg>
    `;
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTrack(i);
    });

    li.appendChild(btn);
    li.appendChild(deleteBtn);
    el.playlistList.appendChild(li);
  });
  el.playlistCount.textContent = `${TRACKS.length} track${TRACKS.length === 1 ? "" : "s"}`;
}

function deleteTrack(index) {
  if (TRACKS.length <= 1) {
    showToast("You need at least one track in the playlist.", "error");
    return;
  }

  const track = TRACKS[index];
  const wasCurrent = index === currentIndex;
  const wasPlaying = wasCurrent && !audio.paused;

  if (track.source === "device" && track.src && track.src.startsWith("blob:")) {
    URL.revokeObjectURL(track.src);
  }

  TRACKS.splice(index, 1);

  if (wasCurrent) {
    const nextIndex = index >= TRACKS.length ? TRACKS.length - 1 : index;
    loadTrack(nextIndex, wasPlaying);
  } else {
    if (index < currentIndex) currentIndex -= 1;
    renderPlaylist();
  }

  showToast(`Removed "${track.title}" from the playlist.`, "info");
}

function addTrack(trackData) {
  TRACKS.push(trackData);
  loadTrack(TRACKS.length - 1, true);
}

/* ---------- 5. Core playback ---------- */

let watchdogTimer = null;

function reportPlaybackFailure(reasonIsTimeout) {
  setPlayingUI(false);
  if (!navigator.onLine) {
    showToast("No internet connection — couldn't play this link.", "error");
  } else if (reasonIsTimeout) {
    showToast("This link is taking too long to respond — it may not be a direct audio file.", "error");
  } else {
    showToast("Couldn't recognize this link as playable audio. Check the URL.", "error");
  }
}

function attemptPlayback(track, targetIndex) {
  let settled = false;
  clearTimeout(watchdogTimer);

  audio.play().then(() => {
    settled = true;
    clearTimeout(watchdogTimer);
  }).catch(() => {
    if (settled || currentIndex !== targetIndex) return;
    settled = true;
    clearTimeout(watchdogTimer);
    reportPlaybackFailure(false);
  });

  // Online links can hang (slow host, wrong content-type, blocked request)
  // without ever firing a play()-rejection or an "error" event. Give it a
  // generous window, then tell the user instead of leaving it stuck.
  if (track.source === "online") {
    watchdogTimer = setTimeout(() => {
      if (settled || currentIndex !== targetIndex) return;
      if (audio.readyState < 2) { // below HAVE_CURRENT_DATA — nothing loaded yet
        settled = true;
        reportPlaybackFailure(true);
        audio.pause();
      }
    }, 9000);
  }
}

function loadTrack(index, autoplay) {
  currentIndex = (index + TRACKS.length) % TRACKS.length;
  const track = TRACKS[currentIndex];

  audio.src = track.src;
  el.trackTitle.textContent = track.title;
  el.trackArtist.textContent = track.artist;
  el.trackCounter.textContent = `Track ${currentIndex + 1} of ${TRACKS.length}`;
  el.discInitials.textContent = track.initials;
  el.durationTime.textContent = formatTime(track.durationSeconds);
  el.seekBar.value = 0;
  setSeekFill(el.seekBar, 0);
  el.currentTime.textContent = "0:00";

  renderPlaylist();

  if (autoplay) {
    attemptPlayback(track, currentIndex);
  }
}

function setPlayingUI(playing) {
  el.playIcon.style.display = playing ? "none" : "block";
  el.pauseIcon.style.display = playing ? "block" : "none";
  el.playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  el.disc.classList.toggle("is-spinning", playing);
  el.tonearm.classList.toggle("is-active", playing);
}

function togglePlay() {
  if (audio.paused) {
    attemptPlayback(TRACKS[currentIndex], currentIndex);
  } else {
    audio.pause();
  }
}

function playNext() {
  loadTrack(currentIndex + 1, true);
}

function playPrev() {
  // if more than 3s into the track, restart it instead of going back
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  loadTrack(currentIndex - 1, true);
}

/* ---------- 6. Event wiring ---------- */

el.playBtn.addEventListener("click", togglePlay);
el.nextBtn.addEventListener("click", playNext);
el.prevBtn.addEventListener("click", playPrev);

audio.addEventListener("play", () => setPlayingUI(true));
audio.addEventListener("pause", () => setPlayingUI(false));

audio.addEventListener("timeupdate", () => {
  if (isSeeking) return;
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  el.seekBar.value = pct;
  setSeekFill(el.seekBar, pct);
  el.currentTime.textContent = formatTime(audio.currentTime);
});

audio.addEventListener("ended", () => {
  if (el.autoplayCheck.checked) {
    playNext();
  } else {
    setPlayingUI(false);
    audio.currentTime = 0;
  }
});

el.seekBar.addEventListener("input", () => {
  isSeeking = true;
  setSeekFill(el.seekBar, el.seekBar.value);
  const target = (el.seekBar.value / 100) * (audio.duration || 0);
  el.currentTime.textContent = formatTime(target);
});

el.seekBar.addEventListener("change", () => {
  const target = (el.seekBar.value / 100) * (audio.duration || 0);
  audio.currentTime = target;
  isSeeking = false;
});

el.volumeBar.addEventListener("input", () => {
  const vol = el.volumeBar.value / 100;
  audio.volume = vol;
  setSeekFill(el.volumeBar, el.volumeBar.value);
  el.volIcon.style.opacity = vol === 0 ? 0.4 : 1;
});

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.code === "ArrowRight") playNext();
  if (e.code === "ArrowLeft") playPrev();
});

/* ---------- 6b. Sync with device ---------- */

el.syncDeviceBtn.addEventListener("click", () => el.deviceFileInput.click());

el.deviceFileInput.addEventListener("change", () => {
  const files = Array.from(el.deviceFileInput.files || []);
  if (!files.length) return;

  const startIndex = TRACKS.length;
  files.forEach((file) => {
    TRACKS.push({
      title: fileNameToTitle(file.name),
      artist: "From your device",
      initials: fileNameToTitle(file.name).slice(0, 2).toUpperCase() || "DV",
      src: URL.createObjectURL(file),
      durationSeconds: null,
      source: "device"
    });
  });

  loadTrack(startIndex, true);
  el.deviceFileInput.value = ""; // allow re-selecting the same file later
});

/* ---------- 6c. Play from an online link ---------- */

function openOnlineModal() {
  el.onlineModalOverlay.hidden = false;
  el.onlineUrlInput.value = "";
  el.onlineTitleInput.value = "";
  el.onlineUrlInput.focus();
}

function closeOnlineModal() {
  el.onlineModalOverlay.hidden = true;
}

el.playOnlineBtn.addEventListener("click", openOnlineModal);
el.onlineCancelBtn.addEventListener("click", closeOnlineModal);

el.onlineModalOverlay.addEventListener("click", (e) => {
  if (e.target === el.onlineModalOverlay) closeOnlineModal();
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && !el.onlineModalOverlay.hidden) closeOnlineModal();
});

el.onlineConfirmBtn.addEventListener("click", () => {
  const url = el.onlineUrlInput.value.trim();
  if (!url) {
    el.onlineUrlInput.focus();
    return;
  }

  if (!navigator.onLine) {
    showToast("No internet connection. Connect and try again.", "error");
    return;
  }

  try {
    new URL(url);
  } catch {
    showToast("That doesn't look like a valid link. Check the URL and try again.", "error");
    return;
  }

  const title = el.onlineTitleInput.value.trim() || urlToTitle(url);

  addTrack({
    title,
    artist: "Streamed link",
    initials: title.slice(0, 2).toUpperCase() || "NT",
    src: url,
    durationSeconds: null,
    source: "online"
  });

  closeOnlineModal();
});

/* Fill in duration once real audio metadata is available (device/online tracks) */
audio.addEventListener("loadedmetadata", () => {
  const track = TRACKS[currentIndex];
  if (track && track.durationSeconds == null && isFinite(audio.duration)) {
    track.durationSeconds = audio.duration;
    el.durationTime.textContent = formatTime(track.durationSeconds);
    renderPlaylist();
  }
});

/* If an online track fails to load or play, tell the user why: no
   connection, or the link just isn't a recognizable/playable audio source. */
audio.addEventListener("error", () => {
  const track = TRACKS[currentIndex];
  if (!track || track.source !== "online") return;
  clearTimeout(watchdogTimer);
  reportPlaybackFailure(false);
});

/* Streaming stalls mid-playback (e.g. connection drops while a link is playing) */
audio.addEventListener("stalled", () => {
  const track = TRACKS[currentIndex];
  if (track && track.source === "online" && !navigator.onLine) {
    showToast("Connection lost — playback paused.", "error");
  }
});

/* Global connectivity changes */
window.addEventListener("offline", () => {
  showToast("You're offline. Online tracks won't play until it's back.", "error");
});
window.addEventListener("online", () => {
  showToast("Back online.", "info");
});

/* ---------- 7. Init ---------- */

setSeekFill(el.volumeBar, el.volumeBar.value);
loadTrack(0, false);
