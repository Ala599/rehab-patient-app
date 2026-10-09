// Enveloppe autour de MediaPipe Pose Landmarker (version web).
// Tout se calcule sur l'appareil : aucune image n'est envoyée sur internet par votre code.
// (Le modèle et les fichiers WebAssembly sont seulement téléchargés au chargement.)

import {
  FilesetResolver,
  PoseLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

// Si vous changez la version dans l'import ci-dessus, changez-la aussi ici.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export async function createDetector() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  try {
    return await PoseLandmarker.createFromOptions(vision, options("GPU"));
  } catch (err) {
    console.warn("GPU indisponible, repli sur le processeur", err);
    return PoseLandmarker.createFromOptions(vision, options("CPU"));
  }
}
