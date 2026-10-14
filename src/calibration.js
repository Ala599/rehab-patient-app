// Calibration : mesure l'amplitude de mouvement (ROM) de chaque côté, calcule l'écart
// entre les deux côtés (asymétrie) et adapte la cible de la série à la capacité du patient.
// Aucun accès au navigateur : ce module se teste avec Node.
//
// Rappel : ces mesures sont indicatives. Les seuils qui comptent (écart acceptable,
// alerte...) doivent être définis et validés par le médecin ou le kiné.

const round = (n, digits = 0) => Number(n.toFixed(digits));

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Détecte les mouvements aller-retour d'un angle (sommet -> creux -> remontée)
// sans connaître d'avance les seuils : c'est ce qui permet de mesurer un bras limité.
// "prominence" = variation minimale (en degrés) pour qu'un changement de sens compte.
export class SwingDetector {
  constructor(prominence = 12) {
    this.prominence = prominence;
    this.direction = null; // "down" (flexion), "up" (extension) ou null au départ
    this.high = null;
    this.low = null;
    this.peak = null;
  }

  // Retourne { maxAngle, minAngle, rom } quand un mouvement de flexion est terminé, sinon null.
  update(angle) {
    if (angle == null) return null;
    const p = this.prominence;

    if (this.high === null) {
      this.high = angle;
      this.low = angle;
      return null;
    }

    if (this.direction === null) {
      this.high = Math.max(this.high, angle);
      this.low = Math.min(this.low, angle);
      if (this.high - angle >= p) {
        this.direction = "down";
        this.peak = this.high;
        this.low = angle;
      } else if (angle - this.low >= p) {
        this.direction = "up";
        this.high = angle;
      }
      return null;
    }

    if (this.direction === "down") {
      if (angle < this.low) {
        this.low = angle;
        return null;
      }
      if (angle - this.low >= p) {
        const swing =
          this.peak == null
            ? null
            : { maxAngle: this.peak, minAngle: this.low, rom: this.peak - this.low };
        this.direction = "up";
        this.high = angle;
        return swing;
      }
      return null;
    }

    // direction === "up"
    if (angle > this.high) {
      this.high = angle;
      return null;
    }
    if (this.high - angle >= p) {
      this.peak = this.high;
      this.direction = "down";
      this.low = angle;
    }
    return null;
  }
}

// Mesure un côté : on attend N mouvements, puis on prend la médiane (robuste aux erreurs isolées).
export class CalibrationSession {
  constructor({ cycles = 3, prominenceDeg = 12, minRomDeg = 15 } = {}) {
    this.total = cycles;
    this.minRomDeg = minRomDeg;
    this.detector = new SwingDetector(prominenceDeg);
    this.swings = [];
  }

  get count() {
    return Math.min(this.swings.length, this.total);
  }

  get canFinish() {
    return this.swings.length >= 1;
  }

  update(angle) {
    const swing = this.detector.update(angle);
    if (swing && swing.rom >= this.minRomDeg && this.swings.length < this.total) {
      this.swings.push(swing);
    }
    const done = this.swings.length >= this.total;
    return { done, count: this.count, total: this.total, result: done ? this.summarize() : null };
  }

  summarize() {
    if (!this.swings.length) return null;
    return {
      maxAngle: round(median(this.swings.map((s) => s.maxAngle)), 1),
      minAngle: round(median(this.swings.map((s) => s.minAngle)), 1),
      rom: round(median(this.swings.map((s) => s.rom)), 1),
      cycles: this.swings.length,
    };
  }
}

// Écart entre les deux côtés, en pourcentage de l'amplitude du côté sain.
// Positif = le côté atteint a moins d'amplitude que le côté sain. Valeur indicative, sans seuil clinique.
export function computeAsymmetry(healthy, affected) {
  if (!healthy || !affected || !(healthy.rom > 0)) return null;
  return {
    percent: Math.round(((healthy.rom - affected.rom) / healthy.rom) * 100),
    romHealthy: round(healthy.rom, 1),
    romAffected: round(affected.rom, 1),
    flexionGapDeg: round(affected.minAngle - healthy.minAngle, 1), // flexion en moins du côté atteint
    extensionGapDeg: round(healthy.maxAngle - affected.maxAngle, 1), // extension en moins du côté atteint
  };
}

// Adapte les seuils de l'exercice à la capacité mesurée du côté atteint.
// Sans cela, un bras qui ne peut pas se tendre à 160° ne compterait jamais aucune répétition.
export function personalizeConfig(config, affected) {
  const fraction = config.personalization?.targetFraction ?? 0.8;
  const rom = affected.rom;
  return {
    ...config,
    startAngle: round(affected.maxAngle, 1),
    targetAngle: round(affected.maxAngle - fraction * rom, 1),
    tolerance: Math.max(5, Math.round(rom * 0.1)),
    minTravel: Math.max(5, Math.round(rom * 0.2)),
  };
}
