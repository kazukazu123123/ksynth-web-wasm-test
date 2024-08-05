class Limiter {
  constructor() {
    this.loudness = 1.0;
    this.attack = 100.0;
    this.falloff = 16000.0;
    this.strength = 1.0;
    this.min_thresh = 1.0;
  }

  limit(val) {
    let abs = Math.abs(val);
    if (this.loudness > abs) {
      this.loudness =
        (this.loudness * this.falloff + abs) / (this.falloff + 1.0);
    } else {
      this.loudness = (this.loudness * this.attack + abs) / (this.attack + 1.0);
    }

    if (this.loudness < this.min_thresh) {
      this.loudness = this.min_thresh;
    }

    let result =
      val / (this.loudness * this.strength + 2.0 * (1.0 - this.strength)) / 2.0;

    return result;
  }
}

window.Limiter = Limiter;
