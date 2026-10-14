// Construit l'objet de sortie d'une séance : c'est ce petit objet (et jamais la vidéo)
// qui sera envoyé au backend.

const round = (n, digits = 1) => (n == null ? null : Number(n.toFixed(digits)));

export class SessionRecorder {
  constructor(exerciseId, side) {
    this.exerciseId = exerciseId;
    this.side = side;
    this.startedAt = new Date();
    this.reps = [];
    this.partialReps = 0;
    this.calibration = null;
  }

  // review = { healthy, affected, asymmetry, personalized } produit par la calibration
  setCalibration(review) {
    this.calibration = review;
  }

  addEvent(event) {
    if (event.type === "rep") this.reps.push(event);
    if (event.type === "partial") this.partialReps += 1;
  }

  build() {
    const minAngles = this.reps.map((r) => r.minAngle);
    const roms = this.reps.map((r) => r.rom);
    const durations = this.reps.map((r) => r.durationMs / 1000);
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const avgRom = avg(roms);

    // Écart entre l'amplitude moyenne des répétitions et l'amplitude du côté sain mesurée à la calibration.
    const healthyRom = this.calibration?.healthy?.rom;
    const seriesAsymmetryPercent =
      avgRom != null && healthyRom > 0 ? Math.round(((healthyRom - avgRom) / healthyRom) * 100) : null;

    return {
      exerciseId: this.exerciseId,
      side: this.side,
      startedAt: this.startedAt.toISOString(),
      durationSec: round((Date.now() - this.startedAt.getTime()) / 1000, 0),
      repsCompleted: this.reps.length,
      partialReps: this.partialReps,
      bestMinAngle: minAngles.length ? round(Math.min(...minAngles)) : null,
      avgMinAngle: round(avg(minAngles)),
      avgRom: round(avgRom),
      avgRepDurationSec: round(avg(durations)),
      calibration: this.calibration,
      seriesAsymmetryPercent,
    };
  }
}
