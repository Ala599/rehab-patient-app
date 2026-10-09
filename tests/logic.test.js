import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { angleBetween, tiltFromVertical } from "../src/geometry.js";
import { RepCounter } from "../src/repCounter.js";
import { ExerciseEngine } from "../src/exerciseEngine.js";

const config = JSON.parse(
  readFileSync(new URL("../config/exercises/elbow_flexion.json", import.meta.url), "utf8")
);

const near = (actual, expected, tol = 0.5) =>
  assert.ok(Math.abs(actual - expected) <= tol, `attendu ~${expected}, obtenu ${actual}`);

test("angle droit = 90°, bras tendu = 180°", () => {
  near(angleBetween({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 90);
  near(angleBetween({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }), 180);
});

test("inclinaison du tronc par rapport à la verticale", () => {
  near(tiltFromVertical({ x: 0, y: 0 }, { x: 0, y: 10 }), 0);
  near(tiltFromVertical({ x: 0, y: 0 }, { x: 10, y: 10 }), 45);
});

function feed(counter, angles) {
  return angles.map((a, i) => counter.update(a, i * 100)).filter(Boolean);
}

test("une répétition complète est comptée une seule fois", () => {
  const counter = new RepCounter(config);
  const events = feed(counter, [170, 140, 100, 65, 100, 155, 170]);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "rep");
  assert.equal(counter.count, 1);
});

test("un mouvement trop court est signalé comme partiel", () => {
  const counter = new RepCounter(config);
  const events = feed(counter, [170, 140, 110, 100, 155]);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "partial");
  assert.equal(counter.count, 0);
});

test("un petit tremblement n'est pas compté", () => {
  const counter = new RepCounter(config);
  const events = feed(counter, [170, 168, 149, 152, 170, 166]);
  assert.equal(events.length, 0);
});

// Points de test : bras droit (12, 14, 16) avec un angle donné au coude.
function makeLandmarks(elbowAngleDeg, { wristVisibility = 1, hipShift = 0 } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  lm[11] = { x: 0.4, y: 0.4, z: 0, visibility: 1 };
  lm[12] = { x: 0.5, y: 0.4, z: 0, visibility: 1 };
  lm[13] = { x: 0.4, y: 0.6, z: 0, visibility: 1 };
  lm[15] = { x: 0.4, y: 0.8, z: 0, visibility: 1 };
  lm[23] = { x: 0.4 + hipShift, y: 0.8, z: 0, visibility: 1 };
  lm[24] = { x: 0.5 + hipShift, y: 0.8, z: 0, visibility: 1 };
  lm[14] = { x: 0.5, y: 0.6, z: 0, visibility: 1 };
  const a = (elbowAngleDeg * Math.PI) / 180;
  lm[16] = {
    x: 0.5 + 0.2 * Math.sin(a),
    y: 0.6 - 0.2 * Math.cos(a),
    z: 0,
    visibility: wristVisibility,
  };
  return lm;
}

test("le moteur mesure l'angle du coude du côté choisi", () => {
  const engine = new ExerciseEngine(config, "right");
  const frame = engine.process(makeLandmarks(120), 100, 100, 0);
  assert.equal(frame.visible, true);
  near(frame.angleMain, 120);
  assert.deepEqual(frame.messages, []);
});

test("le moteur compte une répétition sur une séquence réaliste", () => {
  const engine = new ExerciseEngine(config, "right");
  // Mouvement tendu -> plié -> tendu, interpolé en images (la caméra en fournit ~30 par seconde).
  const keyframes = [170, 60, 170];
  const sequence = [];
  for (let k = 0; k < keyframes.length - 1; k++) {
    for (let step = 0; step < 15; step++) {
      sequence.push(keyframes[k] + ((keyframes[k + 1] - keyframes[k]) * step) / 15);
    }
  }
  sequence.push(170, 170, 170);
  sequence.forEach((angle, i) => engine.process(makeLandmarks(angle), 100, 100, i * 33));
  assert.equal(engine.reps, 1);
});

test("poignet peu visible : message et aucun comptage", () => {
  const engine = new ExerciseEngine(config, "right");
  const frame = engine.process(makeLandmarks(120, { wristVisibility: 0.1 }), 100, 100, 0);
  assert.equal(frame.visible, false);
  assert.equal(frame.angleMain, null);
  assert.ok(frame.messages.includes(config.messages.lowVisibility));
});

test("tronc penché : message de correction", () => {
  const engine = new ExerciseEngine(config, "right");
  const frame = engine.process(makeLandmarks(120, { hipShift: 0.15 }), 100, 100, 0);
  assert.ok(frame.messages.includes("Restez droit sur la chaise"));
});
