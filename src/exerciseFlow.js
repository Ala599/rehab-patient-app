// Séance d'exercice, intégrée à l'onglet "Aujourd'hui".
//
// Déroulement :
//   1. Calibration du côté SAIN    (3 mouvements au maximum)
//   2. Calibration du côté ATTEINT (3 mouvements au maximum)
//   3. Résultat : amplitude de chaque côté, écart entre les deux, cible adaptée
//   4. Série d'exercices avec la cible adaptée au patient
//   5. "Terminer et enregistrer" : la séance est ajoutée à l'historique

import { startCamera, stopCamera } from "./camera.js";
import { createDetector } from "./poseDetector.js";
import { ExerciseEngine } from "./exerciseEngine.js";
import { SessionRecorder } from "./sessionSummary.js";
import { clearOverlay, drawPose } from "./drawing.js";
import { CalibrationSession, computeAsymmetry, personalizeConfig } from "./calibration.js";
import { $ } from "./dom.js";

const PHASE = {
  IDLE: "idle",
  CAL_HEALTHY: "cal-healthy",
  CAL_AFFECTED: "cal-affected",
  REVIEW: "review",
  SERIES: "series",
};

const sideLabel = (side) => (side === "right" ? "droit" : "gauche");

// onSaved : appelé après l'enregistrement d'une séance. onClosed : appelé à chaque fermeture.
export function createExerciseFlow({ store, onSaved, onClosed }) {
  const root = $("exercise");
  const video = $("video");
  const canvas = $("overlay");
  const ctx = canvas.getContext("2d");

  const ui = {
    status: $("status"),
    side: $("side"),
    start: $("start"),
    stop: $("stop"),
    steps: $("steps"),
    message: $("message"),
    calActions: $("cal-actions"),
    finishMeasure: $("finish-measure"),
    skipCal: $("skip-cal"),
    review: $("review"),
    reviewList: $("review-list"),
    beginSeries: $("begin-series"),
    redoCal: $("redo-cal"),
    repsLabel: $("reps-label"),
    reps: $("reps"),
    angleMain: $("angle-main"),
    angleOther: $("angle-other"),
    seriesActions: $("series-actions"),
    reset: $("reset"),
    finishSession: $("finish-session"),
  };

  let config = null;
  let seriesConfig = null; // fiche de la série (adaptée au patient, ou fiche par défaut)
  let detector = null;
  let engine = null;
  let recorder = null;
  let calibration = null;
  let results = { healthy: null, affected: null };
  let review = null;
  let running = false;
  let phase = PHASE.IDLE;
  let lastVideoTime = -1;
  let shownMessage = "";
  let messageUntil = 0;

  const isCalibration = () => phase === PHASE.CAL_HEALTHY || phase === PHASE.CAL_AFFECTED;

  async function loadConfig() {
    const response = await fetch("./config/exercises/elbow_flexion.json");
    if (!response.ok) throw new Error("Impossible de charger la fiche d'exercice.");
    return response.json();
  }

  function setStatus(text) {
    ui.status.textContent = text;
  }

  function flash(text, ms = 3000) {
    shownMessage = text;
    messageUntil = performance.now() + ms;
    ui.message.textContent = text;
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

  // ---------- Phases ----------

  function setPhase(next) {
    phase = next;
    const order = { [PHASE.CAL_HEALTHY]: 0, [PHASE.CAL_AFFECTED]: 1, [PHASE.REVIEW]: 2, [PHASE.SERIES]: 2 };
    const index = order[phase] ?? -1;
    ui.steps.querySelectorAll("li").forEach((li, i) => {
      li.classList.toggle("current", phase === PHASE.REVIEW ? false : i === index);
      li.classList.toggle("done", phase === PHASE.REVIEW ? i < 2 : i < index);
    });

    ui.calActions.hidden = !isCalibration();
    ui.review.hidden = phase !== PHASE.REVIEW;
    ui.seriesActions.hidden = phase !== PHASE.SERIES;
    ui.repsLabel.textContent = phase === PHASE.SERIES ? "Répétitions" : "Mouvements mesurés";
    ui.finishMeasure.disabled = true;
    messageUntil = 0;

    if (isCalibration()) {
      calibration = new CalibrationSession(config.calibration);
      ui.reps.textContent = `0 / ${calibration.total}`;
    }
  }

  function startCalibration() {
    results = { healthy: null, affected: null };
    review = null;
    engine.setSide(ui.side.value);
    engine.setConfig(config);
    engine.counting = false;
    recorder = new SessionRecorder(config.id, ui.side.value);
    setPhase(PHASE.CAL_HEALTHY);
    setStatus(`${config.name} · côté atteint : ${sideLabel(ui.side.value)}`);
  }

  function completeStep(result) {
    if (phase === PHASE.CAL_HEALTHY) {
      results.healthy = result;
      setPhase(PHASE.CAL_AFFECTED);
    } else if (phase === PHASE.CAL_AFFECTED) {
      results.affected = result;
      finishCalibration();
    }
  }

  function finishCalibration() {
    const asymmetry = computeAsymmetry(results.healthy, results.affected);
    const custom = personalizeConfig(config, results.affected);
    seriesConfig = custom;
    review = {
      healthy: results.healthy,
      affected: results.affected,
      asymmetry,
      personalized: { startAngle: custom.startAngle, targetAngle: custom.targetAngle, tolerance: custom.tolerance },
    };
    showReview();
    setPhase(PHASE.REVIEW);
  }

  function showReview() {
    const rows = [
      ["Amplitude côté sain", `${Math.round(review.healthy.rom)}°`],
      ["Amplitude côté atteint", `${Math.round(review.affected.rom)}°`],
      ["Écart entre les deux côtés", review.asymmetry ? `${review.asymmetry.percent} %` : "–"],
      ["Cible de la série", `plier jusqu'à ${Math.round(review.personalized.targetAngle)}°`],
    ];
    ui.reviewList.replaceChildren(
      ...rows.map(([label, value]) => {
        const row = document.createElement("div");
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = value;
        row.append(dt, dd);
        return row;
      })
    );
  }

  function beginSeries() {
    engine.setConfig(seriesConfig);
    engine.counting = true;
    recorder = new SessionRecorder(config.id, ui.side.value);
    if (review) recorder.setCalibration(review);
    setPhase(PHASE.SERIES);
    ui.reps.textContent = `0 / ${seriesConfig.targetReps}`;
  }

  function skipCalibration() {
    review = null;
    seriesConfig = config;
    beginSeries();
  }

  function finishMeasureNow() {
    const result = calibration?.summarize();
    if (result) completeStep(result);
  }

  function resetSeries() {
    engine.reset();
    recorder = new SessionRecorder(config.id, ui.side.value);
    if (review) recorder.setCalibration(review);
    ui.reps.textContent = `0 / ${seriesConfig.targetReps}`;
  }

  function finishSession() {
    if (!recorder) return;
    const summary = recorder.build();
    if (summary.repsCompleted < 1) {
      flash("Faites au moins une répétition avant de terminer.");
      return;
    }
    store.addSession(summary, seriesConfig.targetReps);
    close();
    onSaved?.();
  }

  // ---------- Caméra ----------

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
      lastVideoTime = -1;
      running = true;
      startCalibration();
      requestAnimationFrame(loop);
    } catch (err) {
      console.error(err);
      setStatus(explain(err));
      ui.start.disabled = false;
    }
  }

  function resetUi() {
    setPhase(PHASE.IDLE);
    ui.start.disabled = false;
    ui.message.textContent = "Démarrez la caméra pour commencer";
    ui.reps.textContent = "0 / 3";
    ui.angleMain.textContent = "–";
    ui.angleOther.textContent = "–";
    setStatus("Choisissez le côté atteint, puis démarrez la caméra.");
  }

  function open() {
    root.hidden = false;
    ui.side.value = store.data.affectedSide;
    running = false;
    resetUi();
  }

  function close() {
    running = false;
    if (video.srcObject) stopCamera(video);
    clearOverlay(ctx, canvas.width, canvas.height);
    setPhase(PHASE.IDLE);
    root.hidden = true;
    onClosed?.();
  }

  // Demande confirmation si une série avec des répétitions est en cours.
  function requestClose() {
    if (root.hidden) return true;
    if (phase === PHASE.SERIES && recorder && recorder.reps.length > 0) {
      if (!window.confirm("Quitter sans enregistrer cette séance ?")) return false;
    }
    close();
    return true;
  }

  // ---------- Affichage ----------

  function currentInstruction() {
    const m = config.messages;
    if (phase === PHASE.CAL_HEALTHY) return `${m.calibrationHealthy} (${calibration.count} / ${calibration.total})`;
    if (phase === PHASE.CAL_AFFECTED) return `${m.calibrationAffected} (${calibration.count} / ${calibration.total})`;
    if (phase === PHASE.REVIEW) return m.reviewReady;
    if (phase === PHASE.SERIES && engine.reps >= seriesConfig.targetReps) return m.done;
    return m.ready;
  }

  function render(frame) {
    const now = performance.now();
    const fmt = (v) => (v == null ? "–" : `${Math.round(v)}°`);
    ui.angleMain.textContent = fmt(frame.angleMain);
    ui.angleOther.textContent = fmt(frame.angleOther);

    if (isCalibration()) {
      ui.reps.textContent = `${calibration.count} / ${calibration.total}`;
    } else if (phase === PHASE.SERIES) {
      ui.reps.textContent = `${engine.reps} / ${seriesConfig.targetReps}`;
    }

    // Un message reste affiché 2 secondes pour avoir le temps d'être lu.
    if (frame.messages.length) {
      shownMessage = frame.messages[0];
      messageUntil = now + 2000;
    }
    ui.message.textContent = now < messageUntil ? shownMessage : currentInstruction();
  }

  // Pendant la mesure du côté sain, la visibilité du bras atteint n'est pas utile.
  function relevantMessages(frame) {
    if (phase !== PHASE.CAL_HEALTHY) return frame.messages;
    const kept = frame.messages.filter((m) => m !== config.messages.lowVisibility);
    if (frame.angleOther == null) kept.unshift(config.messages.calibrationHealthyHidden);
    return kept;
  }

  function handlePhase(frame) {
    if (isCalibration()) {
      const angle = phase === PHASE.CAL_HEALTHY ? frame.angleOther : frame.angleMain;
      const state = calibration.update(angle);
      ui.finishMeasure.disabled = !calibration.canFinish;
      if (state.done) completeStep(state.result);
    } else if (phase === PHASE.SERIES) {
      frame.events.forEach((event) => recorder.addEvent(event));
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
        handlePhase(frame);
        frame.messages = relevantMessages(frame);
        render(frame);
        const highlighted = phase === PHASE.CAL_HEALTHY ? engine.otherSide : engine.side;
        drawPose(ctx, landmarks, canvas.width, canvas.height, highlighted, frame.messages.length > 0);
      } else {
        render({ angleMain: null, angleOther: null, messages: [config.messages.noPerson] });
      }
    }
    requestAnimationFrame(loop);
  }

  // ---------- Événements ----------

  ui.start.addEventListener("click", start);
  ui.stop.addEventListener("click", requestClose);
  ui.finishMeasure.addEventListener("click", finishMeasureNow);
  ui.skipCal.addEventListener("click", skipCalibration);
  ui.beginSeries.addEventListener("click", beginSeries);
  ui.redoCal.addEventListener("click", startCalibration);
  ui.reset.addEventListener("click", resetSeries);
  ui.finishSession.addEventListener("click", finishSession);
  ui.side.addEventListener("change", () => {
    store.setAffectedSide(ui.side.value);
    if (running) startCalibration();
  });

  return { open, close, requestClose };
}
