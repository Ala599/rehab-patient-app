// Lissage exponentiel : réduit le tremblement de la mesure d'une image à l'autre.
// alpha proche de 1 = réactif, proche de 0 = très lissé.
export class Ema {
  constructor(alpha = 0.4) {
    this.alpha = alpha;
    this.value = null;
  }
  update(raw) {
    if (raw == null) return this.value;
    this.value = this.value == null ? raw : this.alpha * raw + (1 - this.alpha) * this.value;
    return this.value;
  }
  reset() {
    this.value = null;
  }
}
