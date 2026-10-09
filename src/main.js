// Point d'entrée : relie la caméra, la détection, le moteur d'exercice et l'affichage.

import { startCamera, stopCamera } from "./camera.js";
import { createDetector } from "./poseDetector.js";
import { ExerciseEngine } from "./exerciseEngine.js";
import { SessionRecorder } from "./sessionSummary.js";
import { clearOverlay, drawPose } from "./drawing.js";

const $ = (id) => document.getElementById(id);
const video = $("video");
const canvas = $("overlay");
const ctx = canvas.getContext("2d");

const ui = {
  status: $("status"),
  reps: $("reps"),
  angleMain: $("angle-main"),
  angleOther: $("angle-other"),
  message: $("message"),
  side: $("side"),
  start: $("start"),
  stop: $("stop"),
  reset: $("reset"),
  export: $("export"),
};

let config = null;
let detector = null;
let engine = null;
let recorder = null;
let running = false;
let lastVideoTime = -1;
let shownMessage = "";
let messageUntil = 0;

async function loadConfig() {
  const response = await fetch("./config/exercises/elbow_flexion.json");
  if (!response.ok) throw new Error("Impossible de charger la fiche d'exercice.");
  return response.json();
}

function setStatus(text) {
  ui.status.textContent = text;
}

function explain(err) {
  if (err.message === "INSECURE_CONTEXT") {
    return "La caméra demande une connexion sécurisée (HTTPS). Ouvrez la page avec https:// ou sur localhost.";
  }
  if (err.name === "NotAllowedError") return "Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur.";
  if (err.name === "NotFoundError") return "Aucune caméra trouvée sur cet appareil.";
  if (err.name === "NotReadableError") return "La caméra est utilisée par une autre application.";
  return `Erreur : ${err.message}`;
}

async function start() {
  try {
    ui.start.disabled = true;
    setStatus("Chargement du modèle de détection…");
    config = config ?? (await loadConfig());
    detector = detector ?? (await createDetector());
    await startCamera(video);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    engine = new ExerciseEngine(config, ui.side.value);
    recorder = new SessionRecorder(config.id, ui.side.value);
    lastVideoTime = -1;
    running = true;
    ui.stop.disabled = false;
    ui.export.disabled = false;
    setStatus(`${config.name} · côté ${ui.side.value === "right" ? "droit" : "gauche"}`);
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    setStatus(explain(err));
    ui.start.disabled = false;
  }
}

function stop() {
  running = false;
  stopCamera(video);
  clearOverlay(ctx, canvas.width, canvas.height);
  ui.start.disabled = false;
  ui.stop.disabled = true;
  setStatus("Caméra arrêtée.");
}

function resetSession() {
  if (!engine) return;
  engine.reset();
  recorder = new SessionRecorder(config.id, ui.side.value);
  render({ angleMain: null, angleOther: null, messages: [] });
}

function exportSession() {
  if (!recorder) return;
  const blob = new Blob([JSON.stringify(recorder.build(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `seance-${config.id}-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function show(message) {
  ui.message.textContent = message;
}

function render(frame) {
  const now = performance.now();
  const fmt = (v) => (v == null ? "–" : `${Math.round(v)}°`);
  ui.reps.textContent = `${engine.reps} / ${config.targetReps}`;
  ui.angleMain.textContent = fmt(frame.angleMain);
  ui.angleOther.textContent = fmt(frame.angleOther);

  // Un message reste affiché 2 secondes pour avoir le temps d'être lu.
  if (frame.messages.length) {
    shownMessage = frame.messages[0];
    messageUntil = now + 2000;
  }
  if (engine.reps >= config.targetReps) {
    show(config.messages.done);
  } else if (now < messageUntil) {
    show(shownMessage);
  } else {
    show(config.messages.ready);
  }
}

function loop() {
  if (!running) return;
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = detector.detectForVideo(video, performance.now());
    const landmarks = result.landmarks?.[0];
    clearOverlay(ctx, canvas.width, canvas.height);

    if (landmarks) {
      const frame = engine.process(landmarks, canvas.width, canvas.height, performance.now());
      frame.events.forEach((event) => recorder.addEvent(event));
      render(frame);
      drawPose(ctx, landmarks, canvas.width, canvas.height, engine.side, frame.messages.length > 0);
    } else {
      render({ angleMain: null, angleOther: null, messages: [config.messages.noPerson] });
    }
  }
  requestAnimationFrame(loop);
}

ui.start.addEventListener("click", start);
ui.stop.addEventListener("click", stop);
ui.reset.addEventListener("click", resetSession);
ui.export.addEventListener("click", exportSession);
ui.side.addEventListener("change", () => {
  if (running) resetWithNewSide();
});

function resetWithNewSide() {
  engine.setSide(ui.side.value);
  recorder = new SessionRecorder(config.id, ui.side.value);
  render({ angleMain: null, angleOther: null, messages: [] });
}
