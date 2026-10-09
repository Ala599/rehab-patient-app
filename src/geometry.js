// Géométrie 2D. Toutes les fonctions travaillent en PIXELS : les coordonnées
// normalisées de MediaPipe (0 à 1) déformeraient les angles selon le format de la vidéo.

export function toPixels(landmark, width, height) {
  return {
    x: landmark.x * width,
    y: landmark.y * height,
    visibility: landmark.visibility ?? 1,
  };
}

export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Angle en degrés au point b, formé par les segments b->a et b->c.
// 180° = bras tendu, petit angle = coude très plié.
export function angleBetween(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const norm = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (norm === 0) return null;
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / norm));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Inclinaison (degrés) du segment top->bottom par rapport à la verticale de l'image.
// y est orienté vers le bas dans l'image.
export function tiltFromVertical(top, bottom) {
  const dx = bottom.x - top.x;
  const dy = bottom.y - top.y;
  if (dx === 0 && dy === 0) return null;
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
}
