import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SwingDetector,
  CalibrationSession,
  computeAsymmetry,
  personalizeConfig,
} from "../src/calibration.js";
import { RepCounter } from "../src/repCounter.js";
import { ExerciseEngine } from "../src/exerciseEngine.js";
import { SessionRecorder } from "../src/sessionSummary.js";

const config = JSON.parse(
  readFileSync(new URL("../config/exercises/elbow_flexion.json", import.meta.url), "utf8")
);

const near = (actual, expected, tol = 1) =>
  assert.ok(Math.abs(actual - expected) <= tol, `attendu ~${expected}, obtenu ${actual}`);

// Suite d'angles : tendu -> plié -> tendu, répétée, avec N images par mouvement (~30 images/s).
function movement(maxAngle, minAngle, cycles, framesPerMove = 15) {
  const out = [maxAngle, maxAngle, maxAngle];
  for (let c = 0; c < cycles; c++) {
    for (let i = 1; i <= framesPerMove; i++) out.push(maxAngle + ((minAngle - maxAngle) * i) / framesPerMove);
    for (let i = 1; i <= framesPerMove; i++) out.push(minAngle + ((maxAngle - minAngle) * i) / framesPerMove);
  }
  out.push(maxAngle, maxAngle);
  return out;
}

test("SwingDetector détecte 3 mouvements et leur amplitude", () => {
  const detector = new SwingDetector(12);
  const swings = movement(165, 60, 3).map((a) => detector.update(a)).filter(Boolean);
  assert.equal(swings.length, 3);
  near(swings[0].rom, 105);
  near(swings[0].maxAngle, 165);
  near(swings[0].minAngle, 60);
});

test("SwingDetector ignore un tremblement de quelques degrés", () => {
  const detector = new SwingDetector(12);
  const noisy = Array.from({ length: 80 }, (_, i) => 150 + (i % 2 ? 3 : -3));
  assert.equal(noisy.map((a) => detector.update(a)).filter(Boolean).length, 0);
});

test("CalibrationSession se termine après 3 mouvements avec la médiane", () => {
  const session = new CalibrationSession(config.calibration);
  let last;
  for (const a of movement(160, 70, 3)) last = session.update(a);
  assert.equal(last.done, true);
  near(last.result.rom, 90);
  assert.equal(last.result.cycles, 3);
});

test("un côté très limité (amplitude 30°) est mesurable", () => {
  const session = new CalibrationSession(config.calibration);
  for (const a of movement(130, 100, 3)) session.update(a);
  assert.equal(session.count, 3);
  near(session.summarize().rom, 30);
});

test("canFinish devient vrai dès le premier mouvement", () => {
  const session = new CalibrationSession(config.calibration);
  assert.equal(session.canFinish, false);
  for (const a of movement(160, 70, 1)) session.update(a);
  assert.equal(session.canFinish, true);
});

test("asymétrie : 100° côté sain, 60° côté atteint = 40 %", () => {
  const result = computeAsymmetry(
    { maxAngle: 165, minAngle: 65, rom: 100 },
    { maxAngle: 140, minAngle: 80, rom: 60 }
  );
  assert.equal(result.percent, 40);
  assert.equal(result.flexionGapDeg, 15);
  assert.equal(result.extensionGapDeg, 25);
});

test("asymétrie : impossible à calculer sans amplitude du côté sain", () => {
  assert.equal(computeAsymmetry(null, { rom: 50 }), null);
  assert.equal(computeAsymmetry({ rom: 0 }, { rom: 50 }), null);
});

test("la fiche personnalisée s'adapte au côté atteint", () => {
  const custom = personalizeConfig(config, { maxAngle: 140, minAngle: 80, rom: 60 });
  assert.equal(custom.startAngle, 140);
  assert.equal(custom.targetAngle, 92); // 140 - 0,8 x 60
  assert.equal(custom.tolerance, 6);
});

test("sans personnalisation, un bras qui ne se tend pas à 150° ne compte rien", () => {
  const counter = new RepCounter(config);
  const events = movement(140, 85, 2).map((a, i) => counter.update(a, i * 33)).filter(Boolean);
  assert.equal(events.length, 0);
});

test("avec la fiche personnalisée, les mêmes mouvements sont comptés", () => {
  const custom = personalizeConfig(config, { maxAngle: 140, minAngle: 80, rom: 60 });
  const counter = new RepCounter(custom);
  const events = movement(140, 85, 2).map((a, i) => counter.update(a, i * 33)).filter(Boolean);
  assert.equal(events.filter((e) => e.type === "rep").length, 2);
  near(events[0].rom, 55);
});

function makeLandmarks(elbowAngleDeg) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  lm[11] = { x: 0.4, y: 0.4, z: 0, visibility: 1 };
  lm[12] = { x: 0.5, y: 0.4, z: 0, visibility: 1 };
  lm[13] = { x: 0.4, y: 0.6, z: 0, visibility: 1 };
  lm[15] = { x: 0.4, y: 0.8, z: 0, visibility: 1 };
  lm[23] = { x: 0.4, y: 0.8, z: 0, visibility: 1 };
  lm[24] = { x: 0.5, y: 0.8, z: 0, visibility: 1 };
  lm[14] = { x: 0.5, y: 0.6, z: 0, visibility: 1 };
  const a = (elbowAngleDeg * Math.PI) / 180;
  lm[16] = { x: 0.5 + 0.2 * Math.sin(a), y: 0.6 - 0.2 * Math.cos(a), z: 0, visibility: 1 };
  return lm;
}

test("le moteur ne compte pas pendant la calibration", () => {
  const engine = new ExerciseEngine(config, "right");
  engine.counting = false;
  movement(170, 55, 2).forEach((a, i) => engine.process(makeLandmarks(a), 100, 100, i * 33));
  assert.equal(engine.reps, 0);
  engine.counting = true;
  movement(170, 55, 2).forEach((a, i) => engine.process(makeLandmarks(a), 100, 100, i * 33));
  assert.equal(engine.reps, 2);
});

test("le résumé de séance contient la calibration et l'asymétrie de la série", () => {
  const recorder = new SessionRecorder("elbow_flexion", "right");
  recorder.setCalibration({ healthy: { rom: 100, minAngle: 65, maxAngle: 165 } });
  recorder.addEvent({ type: "rep", minAngle: 85, maxAngle: 140, rom: 55, durationMs: 2000 });
  recorder.addEvent({ type: "rep", minAngle: 80, maxAngle: 140, rom: 60, durationMs: 2200 });
  const summary = recorder.build();
  assert.equal(summary.repsCompleted, 2);
  near(summary.avgRom, 57.5, 0.1);
  assert.equal(summary.seriesAsymmetryPercent, 43);
  assert.ok(summary.calibration);
});

test("la mesure d'amplitude reste précise (à 6° près) pour un mouvement continu d'une seconde", () => {
  // 105° d'amplitude vraie, mouvement continu sans pause, 30 images par aller ou retour (~1 s à 30 images/s).
  // Un lissage trop fort rognerait les extrémités : avec alpha = 0,4 on mesurait environ 96°.
  const engine = new ExerciseEngine(config, "right");
  engine.counting = false;
  const session = new CalibrationSession(config.calibration);
  let last;
  movement(165, 60, 3, 30).forEach((a, i) => {
    const frame = engine.process(makeLandmarks(a), 100, 100, i * 33);
    last = session.update(frame.angleMain);
  });
  assert.equal(last.done, true);
  assert.ok(last.result.rom >= 99 && last.result.rom <= 106, `amplitude mesurée : ${last.result.rom}°`);
});
