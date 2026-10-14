// STUB de test : simule MediaPipe en fabriquant un squelette dont les deux coudes suivent un scénario.
const W = 640, H = 480, L = 96;

const tri = (t, max, min, period = 40) => {
  const ph = (t % period) / period;
  return ph < 0.5 ? max + (min - max) * (ph / 0.5) : min + (max - min) * ((ph - 0.5) / 0.5);
};

function arm(lm, idx, sx, sy, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  const shoulder = [sx, sy];
  const elbow = [sx, sy + L];
  const wrist = [sx + L * Math.sin(a), sy + L - L * Math.cos(a)];
  [shoulder, elbow, wrist].forEach((p, i) => {
    lm[idx[i]] = { x: p[0] / W, y: p[1] / H, z: 0, visibility: 1 };
  });
}

export async function createDetector() {
  return {
    detectForVideo() {
      const sim = globalThis.__sim;
      const t = sim.t++;
      let left = 165;
      let right = 140;
      if (sim.mode === "healthy") left = tri(t, 165, 60);
      if (sim.mode === "affected" || sim.mode === "series") right = tri(t, 140, 85);
      const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
      arm(lm, [11, 13, 15], 380, 160, left);
      arm(lm, [12, 14, 16], 260, 160, right);
      lm[23] = { x: 380 / W, y: 380 / H, z: 0, visibility: 1 };
      lm[24] = { x: 260 / W, y: 380 / H, z: 0, visibility: 1 };
      return { landmarks: [lm] };
    },
  };
}
