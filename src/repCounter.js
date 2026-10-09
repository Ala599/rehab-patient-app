// Compte les répétitions avec une petite machine à états.
// Deux seuils différents (hystérésis) pour ne pas compter deux fois à cause du tremblement.
//
//   extended  -> le bras est tendu (angle >= seuil d'extension)
//   moving    -> le patient a quitté la position tendue
//   retour en extended : répétition complète si la cible a été atteinte, sinon partielle.

export class RepCounter {
  constructor({ startAngle, targetAngle, tolerance = 10, minTravel = 15 }) {
    this.extendedThreshold = startAngle - tolerance;
    this.flexedThreshold = targetAngle + tolerance;
    this.minTravel = minTravel; // mouvement minimal pour qu'on parle d'une tentative
    this.reset();
  }

  reset() {
    this.state = "unknown";
    this.minAngle = Infinity;
    this.startedAt = 0;
    this.reachedTarget = false;
    this.count = 0;
    this.partialCount = 0;
  }

  // Retourne null, ou un événement { type: "rep" | "partial", count, minAngle, durationMs }.
  update(angle, tMs) {
    if (angle == null) return null;

    if (this.state === "unknown") {
      if (angle >= this.extendedThreshold) this.state = "extended";
      return null;
    }

    if (this.state === "extended") {
      if (angle < this.extendedThreshold) {
        this.state = "moving";
        this.minAngle = angle;
        this.startedAt = tMs;
        this.reachedTarget = false;
      }
      return null;
    }

    // state === "moving"
    this.minAngle = Math.min(this.minAngle, angle);
    if (angle <= this.flexedThreshold) this.reachedTarget = true;

    if (angle >= this.extendedThreshold) {
      const event = {
        minAngle: this.minAngle,
        durationMs: tMs - this.startedAt,
      };
      this.state = "extended";
      if (this.reachedTarget) {
        this.count += 1;
        return { type: "rep", count: this.count, ...event };
      }
      if (this.extendedThreshold - this.minAngle >= this.minTravel) {
        this.partialCount += 1;
        return { type: "partial", count: this.partialCount, ...event };
      }
    }
    return null;
  }
}
