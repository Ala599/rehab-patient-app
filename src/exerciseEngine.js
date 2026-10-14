// Applique la fiche de configuration d'un exercice aux points détectés.
// Aucun code spécifique à un exercice : tout vient du fichier JSON.
// Ce module ne touche pas au DOM, donc il se teste avec Node.

import { angleBetween, midpoint, tiltFromVertical, toPixels } from "./geometry.js";
import { Ema } from "./smoothing.js";
import { RepCounter } from "./repCounter.js";

const SHOULDERS = [11, 12];
const HIPS = [23, 24];

export class ExerciseEngine {
  constructor(config, side = "right") {
    this.config = config;
    this.counting = true; // false pendant la calibration : on mesure sans compter de répétitions
    this.setSide(side);
  }

  // Remplace la fiche (par exemple après la calibration) et repart de zéro.
  setConfig(config) {
    this.config = config;
    this.reset();
  }

  setSide(side) {
    this.side = side;
    this.otherSide = side === "right" ? "left" : "right";
    this.reset();
  }

  reset() {
    this.counter = new RepCounter(this.config);
    // Force du lissage : plus alpha est proche de 1, plus la mesure suit le mouvement de près
    // (amplitude mieux mesurée) mais plus elle tremble. Voir le README.
    const alpha = this.config.smoothingAlpha ?? 0.7;
    this.emaMain = new Ema(alpha);
    this.emaOther = new Ema(alpha);
    this.reps = 0;
    this.partialReps = 0;
  }

  // landmarks : les 33 points MediaPipe (coordonnées normalisées)
  process(landmarks, width, height, tMs) {
    const cfg = this.config;
    const minVis = cfg.minVisibility ?? 0.5;
    const pick = (side) => cfg.landmarks[side].map((i) => toPixels(landmarks[i], width, height));
    const main = pick(this.side);
    const other = pick(this.otherSide);
    const isVisible = (pts) => pts.every((p) => p.visibility >= minVis);

    const messages = [];
    const events = [];
    let angleMain = null;
    let angleOther = null;

    const mainVisible = isVisible(main);
    if (mainVisible) {
      angleMain = this.emaMain.update(angleBetween(...main));
      const event = this.counting ? this.counter.update(angleMain, tMs) : null;
      if (event) {
        events.push(event);
        if (event.type === "rep") this.reps += 1;
        if (event.type === "partial") {
          this.partialReps += 1;
          messages.push(cfg.messages.partial);
        }
      }
    } else {
      messages.push(cfg.messages.lowVisibility);
    }

    if (isVisible(other)) {
      angleOther = this.emaOther.update(angleBetween(...other));
    }

    for (const check of cfg.checks ?? []) {
      if (check.id === "trunk_lean") {
        const tilt = this.trunkTilt(landmarks, width, height, minVis);
        if (tilt !== null && tilt > check.maxTiltDeg) messages.push(check.message);
      }
    }

    return { visible: mainVisible, angleMain, angleOther, messages, events };
  }

  trunkTilt(landmarks, width, height, minVis) {
    const pts = [...SHOULDERS, ...HIPS].map((i) => toPixels(landmarks[i], width, height));
    if (!pts.every((p) => p.visibility >= minVis)) return null;
    const shoulders = midpoint(pts[0], pts[1]);
    const hips = midpoint(pts[2], pts[3]);
    return tiltFromVertical(shoulders, hips);
  }
}
