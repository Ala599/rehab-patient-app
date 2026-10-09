// Dessine le squelette par-dessus la vidéo. Pas de texte sur le canvas :
// la vidéo et le canvas sont retournés en miroir par le CSS, le texte serait inversé.

const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
];
const ARM = { left: [11, 13, 15], right: [12, 14, 16] };

const COLORS = { neutral: "#A9C9C3", ok: "#6EE7B7", warning: "#FBBF24" };

export function clearOverlay(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

export function drawPose(ctx, landmarks, width, height, activeSide, hasWarning) {
  const armSet = new Set(ARM[activeSide]);
  const visible = (i) => (landmarks[i].visibility ?? 1) >= 0.5;
  const point = (i) => ({ x: landmarks[i].x * width, y: landmarks[i].y * height });

  ctx.lineCap = "round";
  for (const [a, b] of CONNECTIONS) {
    if (!visible(a) || !visible(b)) continue;
    const isActive = armSet.has(a) && armSet.has(b);
    ctx.strokeStyle = isActive ? (hasWarning ? COLORS.warning : COLORS.ok) : COLORS.neutral;
    ctx.lineWidth = isActive ? 7 : 4;
    const pa = point(a);
    const pb = point(b);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  for (const i of new Set(CONNECTIONS.flat())) {
    if (!visible(i)) continue;
    const p = point(i);
    ctx.fillStyle = armSet.has(i) ? (hasWarning ? COLORS.warning : COLORS.ok) : COLORS.neutral;
    ctx.beginPath();
    ctx.arc(p.x, p.y, armSet.has(i) ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
