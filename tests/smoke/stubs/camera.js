// STUB de test : simule une caméra.
export async function startCamera(video) {
  Object.defineProperty(video, "srcObject", { value: { getTracks: () => [] }, configurable: true, writable: true });
  Object.defineProperty(video, "readyState", { value: 4, configurable: true });
  Object.defineProperty(video, "videoWidth", { value: 640, configurable: true });
  Object.defineProperty(video, "videoHeight", { value: 480, configurable: true });
  let t = 0;
  Object.defineProperty(video, "currentTime", { get: () => ++t, configurable: true });
}
export function stopCamera(video) {
  video.srcObject = null;
}
